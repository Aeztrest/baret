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
  /** An access key of an account; null when the account does not hold that key. */
  viewAccessKey(
    accountId: string,
    publicKey: string,
    blockHash: string,
  ): Promise<NearAccessKey | null>;
  /** The chain id the node serves ("testnet", "mainnet"). */
  chainId(): Promise<string>;
}

export interface NearAccessKey {
  permission:
    | "FullAccess"
    | {
        receiverId: string;
        /** Empty: every method of `receiverId`. */
        methodNames: string[];
        /** yoctoNEAR left for fees; null: unlimited. */
        allowance: bigint | null;
      };
}

export class RpcUnavailableError extends ChainUnavailableError {
  constructor(detail: string) {
    super(`NEAR RPC unavailable: ${detail}`);
    this.name = "RpcUnavailableError";
  }
}

/** 1111… is the hash of "no code". */
const NO_CODE = "11111111111111111111111111111111";

/** Pauses before the second and third try of a failed call (before jitter). */
export const RPC_RETRY_DELAYS_MS = [250, 1000] as const;
/** The longest `Retry-After` honoured: an analysis must still answer within its timeout. */
const MAX_RETRY_AFTER_MS = 2000;

export class JsonNearRpc implements NearRpc {
  constructor(
    private readonly url: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly retryDelaysMs: readonly number[] = RPC_RETRY_DELAYS_MS,
  ) {}

  /**
   * One JSON-RPC call. A network error, a 429 or a 5xx is tried again, up to twice, with a
   * growing pause (public NEAR RPCs rate limit in bursts): the server's `Retry-After` when
   * it sends one (capped), otherwise the next delay, each with +-20% jitter so concurrent
   * analyses do not retry in step. A last failure is RpcUnavailableError, which the API
   * answers as 503, never as a verdict.
   */
  private async call(
    method: string,
    params: unknown,
  ): Promise<{ result?: unknown; error?: unknown }> {
    let last = "";
    let wait = 0;
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      if (attempt > 0) {
        const base = wait || (this.retryDelaysMs[attempt - 1] ?? 0);
        await new Promise((r) => setTimeout(r, base * (0.8 + Math.random() * 0.4)));
      }
      wait = 0;
      let res: Response;
      try {
        res = await this.fetchImpl(this.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: "baret", method, params }),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) {
        last = (e as Error).message;
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        last = `HTTP ${res.status}`;
        wait = retryAfterMs(res.headers.get("retry-after"));
        continue;
      }
      if (!res.ok) throw new RpcUnavailableError(`HTTP ${res.status}`);
      return (await res.json()) as { result?: unknown; error?: unknown };
    }
    throw new RpcUnavailableError(last);
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
      args_base64: bytesToBase64(new TextEncoder().encode(JSON.stringify(args))),
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

  async viewAccessKey(
    accountId: string,
    publicKey: string,
    blockHash: string,
  ): Promise<NearAccessKey | null> {
    const { result, error } = await this.call("query", {
      request_type: "view_access_key",
      block_id: blockHash,
      account_id: accountId,
      public_key: publicKey,
    });
    if (error) {
      if (
        isUnknownAccount(error) ||
        /UNKNOWN_ACCESS_KEY|does not exist/i.test(JSON.stringify(error))
      )
        return null;
      throw new RpcUnavailableError(`view_access_key ${accountId}`);
    }
    // Older nodes answer an unknown key inside `result.error`.
    const r = result as {
      error?: string;
      permission?:
        | "FullAccess"
        | {
            FunctionCall: {
              receiver_id: string;
              method_names: string[];
              allowance: string | null;
            };
          };
    };
    if (r.error || !r.permission) return null;
    if (r.permission === "FullAccess") return { permission: "FullAccess" };
    const fc = r.permission.FunctionCall;
    return {
      permission: {
        receiverId: fc.receiver_id,
        methodNames: fc.method_names,
        allowance: fc.allowance === null ? null : BigInt(fc.allowance),
      },
    };
  }

  async chainId(): Promise<string> {
    const { result, error } = await this.call("status", []);
    const id = (result as { chain_id?: string } | undefined)?.chain_id;
    if (error || !id) throw new RpcUnavailableError("status");
    return id;
  }
}

/** Base64 of any bytes (btoa alone throws on text outside Latin-1, e.g. a Turkish memo). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function isUnknownAccount(error: unknown): boolean {
  const text = JSON.stringify(error);
  return /UNKNOWN_ACCOUNT|does not exist|CodeDoesNotExist|MethodNotFound/i.test(text);
}

/** A `Retry-After` header (seconds or an HTTP date) in ms, capped; 0 when absent or bad. */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (!header) return 0;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(ms, MAX_RETRY_AFTER_MS);
}
