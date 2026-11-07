import {
  type Address,
  getAddress,
  type Hex,
  isAddress,
  parseTransaction,
  recoverTransactionAddress,
  type TransactionSerialized,
  zeroAddress,
} from "viem";
import type { CallRequest } from "../request.js";

/** The contracts named in an EIP-7702 authorization list, whatever the field is called. */
function delegationsOf(parsed: object): Address[] {
  const list = (parsed as { authorizationList?: unknown }).authorizationList;
  if (!Array.isArray(list)) return [];
  const out: Address[] = [];
  for (const item of list as { address?: unknown; contractAddress?: unknown }[]) {
    const target = item?.address ?? item?.contractAddress;
    // An entry that cannot be read still counts: the zero address stands for it.
    out.push(
      typeof target === "string" && isAddress(target, { strict: false })
        ? getAddress(target)
        : zeroAddress,
    );
  }
  return out;
}

/** A transaction in one shape, whatever the client sent. */
export interface NormalizedTx {
  from: Address;
  to: Address | null;
  value: bigint;
  data: Hex;
  /** The gas limit the sender set, if any. Some chains (Monad) charge for all of it. */
  gas: bigint | null;
  /** Price per gas the sender will pay at most, if set. */
  gasPrice: bigint | null;
  /**
   * EIP-7702: the contracts a signed transaction's authorization list hands an
   * account's code to. The simulation does not apply them, so they are carried
   * here and reported, never ignored.
   */
  delegations?: readonly Address[];
}

export class TxDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TxDecodeError";
  }
}

const big = (v: string | undefined): bigint | null => (v === undefined ? null : BigInt(v));

/**
 * @param sender who sends an unsigned serialized transaction (the request's
 *   `account`). A signed one names its own sender and ignores this.
 */
export async function decodeTransaction(
  input: CallRequest | { raw: string },
  chainId: number,
  sender: Address | null = null,
): Promise<NormalizedTx> {
  if ("raw" in input) {
    let parsed: ReturnType<typeof parseTransaction>;
    try {
      parsed = parseTransaction(input.raw as TransactionSerialized);
    } catch (err) {
      throw new TxDecodeError(
        `not a serialized transaction: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const signed = parsed.r !== undefined && parsed.s !== undefined;
    let from: Address;
    if (signed) {
      try {
        from = await recoverTransactionAddress({
          serializedTransaction: input.raw as TransactionSerialized,
        });
      } catch (err) {
        throw new TxDecodeError(
          `bad signature: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else if (sender) {
      from = sender;
    } else {
      throw new TxDecodeError("an unsigned transaction needs `account` as its sender");
    }
    const delegations = delegationsOf(parsed);
    // A legacy transaction with no chain id (pre-EIP-155) is valid on every
    // chain the account has the same nonce on: once signed it can be replayed
    // anywhere. It is not quietly taken for this chain's.
    if (parsed.chainId === undefined) {
      throw new TxDecodeError(
        `the transaction names no chain id: it could be replayed on any chain, expected ${chainId}`,
      );
    }
    if (parsed.chainId !== chainId) {
      throw new TxDecodeError(`signed for chain ${parsed.chainId}, expected ${chainId}`);
    }
    return {
      from,
      to: parsed.to ? getAddress(parsed.to) : null,
      value: parsed.value ?? 0n,
      data: parsed.data ?? "0x",
      gas: parsed.gas ?? null,
      gasPrice: parsed.maxFeePerGas ?? parsed.gasPrice ?? null,
      ...(delegations.length > 0 ? { delegations } : {}),
    };
  }

  return {
    from: getAddress(input.from),
    to: input.to ? getAddress(input.to) : null,
    value: big(input.value) ?? 0n,
    data: (input.data ?? "0x") as Hex,
    gas: big(input.gas),
    gasPrice: big(input.maxFeePerGas) ?? big(input.gasPrice),
  };
}
