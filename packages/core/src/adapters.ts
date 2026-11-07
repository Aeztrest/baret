import type { ZodType } from "zod";
import type { PaymentContext, SimulationMode, SourceStatus } from "./analyze.js";
import type { ChainConfig } from "./chain-config.js";
import type { Allowance, BalanceChange } from "./effects.js";
import type { FindingCode } from "./findings.js";
import type { Caip10, Family } from "./ids.js";
import type { GuardPolicy, PolicyField } from "./policy.js";

/**
 * The contract between the engine and a chain family (ADR-0003).
 * docs/architecture/chain-adapters.md explains it; this file is the authority.
 *
 * Phase 1 shape (D9): the adapter runs its family's whole analysis (decode, simulate,
 * effects, detectors, policy rules) and hands the engine finding drafts; the engine decides,
 * assembles and validates the verdict. When the universal detectors move into the engine
 * with the second family (TASKS.md T3.7), this interface gains the finer steps
 * (decode / simulate / effects → core `Effects`).
 */

/** The chain state every read of one analysis uses. */
export interface StatePin {
  kind: "block" | "ledger" | "state-root";
  value: string;
}

/** A detector's output before the policy decides blocking. */
export interface FindingDraft {
  code: FindingCode;
  values: Record<string, string>;
  details?: Record<string, unknown>;
  /** The rule that produced it, for codes several rules can produce. */
  rule?: PolicyField;
}

export interface AdapterInput {
  chain: ChainConfig;
  /** Already validated against the adapter's `requestSchema`. */
  request: unknown;
  /** Whose balances the loss rules protect; null: the signer. */
  account: Caip10 | null;
  policy: GuardPolicy;
  payment: PaymentContext | null;
  /** Unix seconds. */
  now: number;
}

export interface AdapterResult {
  drafts: FindingDraft[];
  estimatedChanges: BalanceChange[];
  allowances: Allowance[];
  sources: SourceStatus[];
  pinnedAt: StatePin | null;
  simulation: SimulationMode;
  /** Before data-source gaps: the engine lowers it to low when a *_UNAVAILABLE finding exists. */
  confidence: "high" | "medium" | "low";
}

export interface ChainHealth {
  reachable: boolean;
  /** The RPC answered as the configured chain (not another network). */
  rightChain: boolean;
  simulation: SimulationMode;
  detail?: string;
}

/**
 * Server side: `@baret/chain-<family>/engine`. `analyze` throws InvalidRequestError for a
 * request it cannot analyse and ChainUnavailableError when the chain cannot be read.
 */
export interface EngineAdapter {
  family: Family;
  version: string;
  /** The family payload inside /v1/analyze `request`. */
  requestSchema: ZodType;
  analyze(input: AdapterInput): Promise<AdapterResult>;
  health(chain: ChainConfig): Promise<ChainHealth>;
}

export interface DerivedAccount {
  /** Hex or the family's encoding. */
  publicKey: string;
  /** The family's native address form. */
  address: string;
  caip10(chain: ChainConfig): Caip10;
}

export interface BalanceRow {
  asset: string;
  symbol: string | null;
  decimals: number;
  amount: string;
}

/**
 * Client side: `@baret/chain-<family>/wallet`. Kept free of simulation code so the
 * extension bundle stays small. Types are deliberately loose until the first wallet
 * adapter is ported (TASKS.md T2.2); tighten them there.
 */
export interface WalletAdapter<Tx = unknown, Signed = unknown> {
  family: Family;
  derivationPath(index: number): string;
  deriveAccount(seed: Uint8Array, index: number): DerivedAccount;
  balances(account: string, chain: ChainConfig): Promise<BalanceRow[]>;
  /** What wallet-core sends to /v1/analyze as `request`. */
  toAnalyzeRequest(tx: Tx): unknown;
  sign(tx: Tx, secretKey: Uint8Array, chain: ChainConfig): Promise<Signed>;
  send(signed: Signed, chain: ChainConfig): Promise<string>;
}
