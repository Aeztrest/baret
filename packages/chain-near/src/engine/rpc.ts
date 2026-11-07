import { ChainUnavailableError } from "@baret/core";

/**
 * The NEAR RPC reads a preflight needs (docs/chains/near.md §2). Every read of one
 * analysis uses the same block (`pin`). A failed read throws RpcUnavailableError, which
 * the API answers as 503: an analysis never guesses past a missing read.
 */

export interface NearAccountState {
  /** yoctoNEAR. */
  amount: bigint;
  /** yoctoNEAR locked for staking. */
  locked: bigint;
  /** True when the account has a contract deployed. */
  hasCode: boolean;
  /** Bytes of storage used (each costs a deposit the account cannot spend). */
  storageUsage: bigint;
}

export interface NearRpc {
  /** The latest final block, which every later read is pinned to. */
  pin(): Promise<{ height: bigint; hash: string }>;
  /** null: the account does not exist. */
  viewAccount(accountId: string, blockHash: string): Promise<NearAccountState | null>;
  /** A view call; null when the method does not exist or panics. */
  callView(
    contract: string,
    method: string,
    args: object,
    blockHash: string,
  ): Promise<unknown | null>;
  /** The chain id the node serves ("testnet", "mainnet"). */
  chainId(): Promise<string>;
}

export class RpcUnavailableError extends ChainUnavailableError {
  constructor(detail: string) {
    super(`NEAR RPC unavailable: ${detail}`);
    this.name = "RpcUnavailableError";
  }
}

/** 1111… is the hash of "no code". */
const NO_CODE = "11111111111111111111111111111111";

export class JsonNearRpc implements NearRpc {
  constructor(
    private readonly url: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(
    method: string,
    params: unknown,
  ): Promise<{ result?: unknown; error?: unknown }> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "baret", method, params }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new RpcUnavailableError((e as Error).message);
    }
    if (!res.ok) throw new RpcUnavailableError(`HTTP ${res.status}`);
    return (await res.json()) as { result?: unknown; error?: unknown };
  }

  async pin(): Promise<{ height: bigint; hash: string }> {
    const { result, error } = await this.call("block", { finality: "final" });
    const header = (result as { header?: { height: number; hash: string } } | undefined)?.header;
    if (error || !header) throw new RpcUnavailableError("no final block");
    return { height: BigInt(header.height), hash: header.hash };
  }

  async viewAccount(accountId: string, blockHash: string): Promise<NearAccountState | null> {
    const { result, error } = await this.call("query", {
      request_type: "view_account",
      block_id: blockHash,
      account_id: accountId,
    });
    if (error) {
      if (isUnknownAccount(error)) return null;
      throw new RpcUnavailableError(`view_account ${accountId}`);
    }
    const r = result as {
      amount: string;
      locked: string;
      code_hash: string;
      storage_usage: number;
    };
    return {
      amount: BigInt(r.amount),
      locked: BigInt(r.locked),
      hasCode: r.code_hash !== NO_CODE,
      storageUsage: BigInt(r.storage_usage),
    };
  }

  async callView(
    contract: string,
    method: string,
    args: object,
    blockHash: string,
  ): Promise<unknown | null> {
    const { result, error } = await this.call("query", {
      request_type: "call_function",
      block_id: blockHash,
      account_id: contract,
      method_name: method,
      args_base64: btoa(JSON.stringify(args)),
    });
    if (error) {
      if (isUnknownAccount(error)) return null;
      throw new RpcUnavailableError(`${contract}.${method}`);
    }
    const r = result as { result?: number[]; error?: string };
    // A contract panic or a missing method answers with `error` inside the result.
    if (!r.result || r.error) return null;
    try {
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(r.result)));
    } catch {
      return null;
    }
  }

  async chainId(): Promise<string> {
    const { result, error } = await this.call("status", []);
    const id = (result as { chain_id?: string } | undefined)?.chain_id;
    if (error || !id) throw new RpcUnavailableError("status");
    return id;
  }
}

function isUnknownAccount(error: unknown): boolean {
  const text = JSON.stringify(error);
  return /UNKNOWN_ACCOUNT|does not exist|CodeDoesNotExist|MethodNotFound/i.test(text);
}
