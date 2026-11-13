/**
 * Counterparty history for the NEAR detectors (TN.14): how old an account is, how much it
 * has done, and whether the signer has dealt with it before. NEAR RPC keeps no index of
 * an account's transactions, so this reads FastNEAR's transactions API, which lists the
 * transactions that touched an account (as signer, receiver or receipt) with timestamps.
 *
 * Every failure throws HistoryUnavailableError; the pipeline turns it into a Caution
 * (COUNTERPARTY_HISTORY_UNAVAILABLE), never into a pass.
 */

export interface AccountHistory {
  /** Transactions that touched the account; 0: it has never been used. */
  transactions: number;
  /** When the first of them landed (ms since epoch); null when there is none. */
  firstSeenMs: number | null;
}

export interface NearHistory {
  account(accountId: string): Promise<AccountHistory>;
  /**
   * Whether one transaction touched both accounts (a payment, a call, a receipt between
   * them). Reads at most `HISTORY_SCAN_LIMIT` of the busier account's latest transactions:
   * past that it answers from what it read, which can only miss an old contact (a Caution,
   * never a pass).
   */
  dealtWith(a: string, b: string): Promise<boolean>;
}

/** The FastNEAR transactions API per network. Mainnet and testnet only. */
export const NEAR_HISTORY_API: Record<string, string> = {
  "near:testnet": "https://tx.test.fastnear.com",
  "near:mainnet": "https://tx.main.fastnear.com",
};

const PAGE = 200;
/** Transactions read per account at most (5 pages): an analysis must answer in seconds. */
export const HISTORY_SCAN_LIMIT = 1000;

export class HistoryUnavailableError extends Error {
  constructor(detail: string) {
    super(`NEAR history unavailable: ${detail}`);
    this.name = "HistoryUnavailableError";
  }
}

interface Page {
  account_txs: { transaction_hash: string; tx_block_timestamp: string }[];
  txs_count: number;
  resume_token?: string;
}

export class FastNearHistory implements NearHistory {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async page(body: Record<string, unknown>): Promise<Page> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/v0/account`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new HistoryUnavailableError((e as Error).message);
    }
    if (!res.ok) throw new HistoryUnavailableError(`HTTP ${res.status}`);
    const p = (await res.json().catch(() => null)) as Page | null;
    if (!p || !Array.isArray(p.account_txs) || typeof p.txs_count !== "number")
      throw new HistoryUnavailableError("unexpected answer");
    return p;
  }

  async account(accountId: string): Promise<AccountHistory> {
    // Oldest first: the first transaction that touched an account is the one that made it.
    const p = await this.page({ account_id: accountId, desc: false, limit: 1 });
    const first = p.account_txs[0];
    return {
      transactions: p.txs_count,
      firstSeenMs: first ? nsToMs(first.tx_block_timestamp) : null,
    };
  }

  /** The latest transaction hashes of an account, up to HISTORY_SCAN_LIMIT. */
  private async hashes(accountId: string): Promise<Set<string>> {
    const hashes = new Set<string>();
    let token: string | undefined;
    do {
      const p = await this.page({
        account_id: accountId,
        desc: true,
        limit: PAGE,
        ...(token ? { resume_token: token } : {}),
      });
      for (const t of p.account_txs) hashes.add(t.transaction_hash);
      token = p.account_txs.length === PAGE ? p.resume_token : undefined;
    } while (token && hashes.size < HISTORY_SCAN_LIMIT);
    return hashes;
  }

  async dealtWith(a: string, b: string): Promise<boolean> {
    const [x, y] = await Promise.all([this.hashes(a), this.hashes(b)]);
    for (const h of x) if (y.has(h)) return true;
    return false;
  }
}

/** FastNEAR timestamps are nanoseconds as a decimal string. */
function nsToMs(ns: string): number | null {
  return /^\d+$/.test(ns) ? Number(BigInt(ns) / 1_000_000n) : null;
}
