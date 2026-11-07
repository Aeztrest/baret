import { ChainUnavailableError } from "@baret/core";
import {
  type Address,
  BaseError,
  CallExecutionError,
  ContractFunctionRevertedError,
  createPublicClient,
  erc20Abi,
  getAddress,
  type Hex,
  http,
  isAddress,
  type PublicClient,
  parseAbi,
} from "viem";

/** Where and how to reach one EVM chain's nodes. */
export interface EvmRpcConfig {
  chainId: number;
  rpcUrl: string;
  /** Node for debug_traceCall when the main RPC lacks it; the same URL when it has it. */
  traceRpcUrl: string;
  timeoutMs: number;
  /**
   * Send reads as JSON-RPC batches. Some nodes reject debug_traceCall inside a batch
   * (Baret-GOAT); the chain registry's `features.rpcBatch` decides.
   */
  batch: boolean;
}

export interface CallParams {
  from: Address;
  to: Address | null;
  data: Hex;
  value: bigint;
  gas: bigint | null;
}

export type CallOutcome =
  | { ok: true; returnData: Hex }
  | { ok: false; revertReason: string | null; revertData: Hex | null };

/** One `callTracer` frame, as returned by `debug_traceCall` with `withLog`. */
export interface RawCallFrame {
  type: string;
  from: string;
  to?: string;
  value?: string;
  gas?: string;
  gasUsed?: string;
  input?: string;
  output?: string;
  error?: string;
  revertReason?: string;
  calls?: RawCallFrame[];
  logs?: { address: string; topics: string[]; data: string }[];
}

/**
 * The RPC did not answer. Distinct from a revert, which is a valid answer. A
 * ChainUnavailableError, so the API answers 503 and never a verdict.
 */
export class RpcUnavailableError extends ChainUnavailableError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RpcUnavailableError";
  }
}

/**
 * The chain reads the analysis needs. An interface so tests drive the whole
 * pipeline with an in-memory fake instead of a node. Implementations throw
 * RpcUnavailableError when the node does not answer; the API turns that into
 * a 503, never into a verdict.
 */
export interface EvmRpc {
  getChainId(): Promise<number>;
  /**
   * Throws RpcUnavailableError unless every node this adapter uses (reads and
   * traces) is on the expected chain. An answer about another chain's state
   * is worse than no answer.
   */
  verifyChain(): Promise<void>;
  getBlockNumber(): Promise<bigint>;
  getGasPrice(): Promise<bigint>;
  getBalance(address: Address, block: bigint): Promise<bigint>;
  getCode(address: Address, block: bigint): Promise<Hex>;
  getStorageAt(address: Address, slot: Hex, block: bigint): Promise<Hex>;
  call(params: CallParams, block: bigint): Promise<CallOutcome>;
  estimateGas(params: CallParams, block: bigint): Promise<bigint | null>;
  /** Null when the node does not offer `debug_traceCall`. */
  traceCall(params: CallParams, block: bigint): Promise<RawCallFrame | null>;
  erc20Balance(token: Address, owner: Address, block: bigint): Promise<bigint | null>;
  erc20Meta(token: Address): Promise<{ symbol: string | null; decimals: number | null }>;
  /** Which of `addresses` are vaults the PaymentGuardFactory deployed. A failed read is "no". */
  factoryVaults(factory: Address, addresses: readonly Address[], block: bigint): Promise<Address[]>;
  /** A vault's `owner()`, at the head. Null when the address has none or the read failed. */
  vaultOwner(vault: Address): Promise<Address | null>;
}

const FACTORY_ABI = parseAbi(["function isVault(address vault) view returns (bool)"]);
const OWNER_ABI = parseAbi(["function owner() view returns (address)"]);

const toHex = (n: bigint) => `0x${n.toString(16)}` as Hex;

function revertReasonOf(err: unknown): string | null {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) return reverted.reason ?? null;
    return err.shortMessage;
  }
  return null;
}

/** A node answering "execution reverted" is a result; anything else is an outage. */
function isRevert(err: unknown): boolean {
  if (!(err instanceof BaseError)) return false;
  const msg = `${err.shortMessage} ${err.details ?? ""}`.toLowerCase();
  return (
    err instanceof CallExecutionError &&
    (msg.includes("revert") || msg.includes("out of gas") || msg.includes("insufficient"))
  );
}

/**
 * A node that answers "too many requests" or a 5xx is asked again, each time
 * after twice the wait: 0.25 s, 0.5 s, 1 s, 2 s (under 4 s in all). A burst of
 * checks, such as a page of demo panels loading together, then waits instead
 * of failing: without this the plan's per-second limit turned an honest
 * request into "Can't reach Baret". A node that is really down still fails,
 * and the request still gets no verdict.
 */
const RETRY = { retryCount: 4, retryDelay: 250 } as const;

export class ViemEvmRpc implements EvmRpc {
  private readonly client: PublicClient;
  private traceSupported: boolean | null = null;
  private readonly expectedChainId: number;
  private chainVerified = false;

  private readonly traceClient: PublicClient | null;

  /**
   * Reads go to `rpcUrl` as JSON-RPC batches (when the chain allows it), so one
   * analysis is a handful of HTTP requests instead of dozens. Traces go to
   * `traceRpcUrl`, which may be another node when the main plan has no
   * debug_traceCall.
   */
  constructor(config: EvmRpcConfig) {
    const timeoutMs = config.timeoutMs;
    this.expectedChainId = config.chainId;
    this.traceClient =
      config.traceRpcUrl === config.rpcUrl
        ? null
        : createPublicClient({
            transport: http(config.traceRpcUrl, { timeout: timeoutMs, ...RETRY }),
          });
    this.client = createPublicClient({
      batch: { multicall: false },
      transport: http(config.rpcUrl, {
        timeout: timeoutMs,
        ...RETRY,
        ...(config.batch ? { batch: { wait: 10 } } : {}),
      }),
    });
  }

  private async guard<T>(what: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      throw new RpcUnavailableError(`${what} failed`, { cause });
    }
  }

  getChainId() {
    return this.guard("eth_chainId", () => this.client.getChainId());
  }

  async verifyChain(): Promise<void> {
    if (this.chainVerified) return;
    const clients = [this.client, ...(this.traceClient ? [this.traceClient] : [])];
    const ids = await this.guard("eth_chainId", () =>
      Promise.all(clients.map((c) => c.getChainId())),
    );
    const wrong = ids.find((id) => id !== this.expectedChainId);
    if (wrong !== undefined) {
      throw new RpcUnavailableError(
        `RPC is on chain ${wrong}, expected chain ${this.expectedChainId}`,
      );
    }
    this.chainVerified = true;
  }

  getBlockNumber() {
    return this.guard("eth_blockNumber", () => this.client.getBlockNumber({ cacheTime: 0 }));
  }

  getGasPrice() {
    return this.guard("eth_gasPrice", () => this.client.getGasPrice());
  }

  getBalance(address: Address, block: bigint) {
    return this.guard("eth_getBalance", () =>
      this.client.getBalance({ address, blockNumber: block }),
    );
  }

  getCode(address: Address, block: bigint) {
    return this.guard("eth_getCode", async () => {
      const code = await this.client.getCode({ address, blockNumber: block });
      return code ?? "0x";
    });
  }

  getStorageAt(address: Address, slot: Hex, block: bigint) {
    return this.guard("eth_getStorageAt", async () => {
      const v = await this.client.getStorageAt({ address, slot, blockNumber: block });
      return v ?? "0x";
    });
  }

  async call(params: CallParams, block: bigint): Promise<CallOutcome> {
    try {
      const res = await this.client.call({
        account: params.from,
        to: params.to ?? undefined,
        data: params.data,
        value: params.value,
        ...(params.gas != null ? { gas: params.gas } : {}),
        blockNumber: block,
      });
      return { ok: true, returnData: res.data ?? "0x" };
    } catch (err) {
      if (isRevert(err)) {
        const data =
          err instanceof BaseError
            ? ((
                err.walk((e) => typeof (e as { data?: unknown }).data === "string") as {
                  data?: Hex;
                } | null
              )?.data ?? null)
            : null;
        return { ok: false, revertReason: revertReasonOf(err), revertData: data };
      }
      throw new RpcUnavailableError("eth_call failed", { cause: err });
    }
  }

  async estimateGas(params: CallParams, block: bigint): Promise<bigint | null> {
    try {
      return await this.client.estimateGas({
        account: params.from,
        to: params.to ?? undefined,
        data: params.data,
        value: params.value,
        blockNumber: block,
      });
    } catch {
      // A revert makes estimation fail too; the call result already says so.
      return null;
    }
  }

  async traceCall(params: CallParams, block: bigint): Promise<RawCallFrame | null> {
    if (this.traceSupported === false) return null;
    const callObject: Record<string, string> = {
      from: params.from,
      data: params.data,
      value: toHex(params.value),
    };
    if (params.to) callObject.to = params.to;
    if (params.gas != null) callObject.gas = toHex(params.gas);
    try {
      // debug_ methods are not in viem's typed RPC schema.
      const request = (this.traceClient ?? this.client).request as unknown as (args: {
        method: string;
        params: unknown[];
      }) => Promise<unknown>;
      const frame = (await request({
        method: "debug_traceCall",
        params: [
          callObject,
          toHex(block),
          { tracer: "callTracer", tracerConfig: { withLog: true } },
        ],
      })) as RawCallFrame;
      this.traceSupported = true;
      return frame;
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("method") && (msg.includes("not") || msg.includes("unsupported"))) {
        this.traceSupported = false;
      }
      return null;
    }
  }

  async erc20Balance(token: Address, owner: Address, block: bigint): Promise<bigint | null> {
    try {
      return await this.client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
        blockNumber: block,
      });
    } catch {
      return null;
    }
  }

  async factoryVaults(factory: Address, addresses: readonly Address[], block: bigint) {
    const answers = await Promise.all(
      addresses.map((a) =>
        this.client
          .readContract({
            address: factory,
            abi: FACTORY_ABI,
            functionName: "isVault",
            args: [a],
            blockNumber: block,
          })
          .catch(() => false),
      ),
    );
    return addresses.filter((_, i) => answers[i] === true);
  }

  async vaultOwner(vault: Address) {
    try {
      const owner = await this.client.readContract({
        address: vault,
        abi: OWNER_ABI,
        functionName: "owner",
      });
      return isAddress(owner) ? getAddress(owner) : null;
    } catch {
      return null;
    }
  }

  async erc20Meta(token: Address) {
    const [symbol, decimals] = await Promise.all([
      this.client
        .readContract({ address: token, abi: erc20Abi, functionName: "symbol" })
        .catch(() => null),
      this.client
        .readContract({ address: token, abi: erc20Abi, functionName: "decimals" })
        .catch(() => null),
    ]);
    return { symbol, decimals };
  }
}
