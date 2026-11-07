import type { ZodType } from "zod";
import type { SimulationMode } from "./analyze.js";
import type { ChainConfig } from "./chain-config.js";
import type { Effects } from "./effects.js";
import type { FindingCode } from "./findings.js";
import type { Caip10, Family } from "./ids.js";
import type { GuardPolicy } from "./policy.js";

/**
 * The contract between the engine and a chain family (ADR-0003).
 * docs/architecture/chain-adapters.md describes each method; this file is the authority.
 */

/** The chain state every read of one analysis uses. */
export interface StatePin {
  kind: "block" | "ledger" | "state-root";
  value: string;
}

/** A detector's output before the policy decides severity display and blocking. */
export interface FindingDraft {
  code: FindingCode;
  values: Record<string, string>;
  details?: Record<string, unknown>;
}

export interface NoSimulation {
  simulated: false;
  /** Why: unsupported on this chain, the node failed, … Becomes a gap in Effects. */
  reason: string;
}

export interface FamilyDetectorInput<Tx, Sim> {
  tx: Tx;
  sim: Sim | NoSimulation;
  effects: Effects;
  policy: GuardPolicy;
  chain: ChainConfig;
}

/** Pure: no I/O. Every read happens before detectors run. */
export type FamilyDetector<Tx, Sim> = (input: FamilyDetectorInput<Tx, Sim>) => FindingDraft[];

export interface ChainHealth {
  reachable: boolean;
  /** The RPC answered as the configured chain (not another network). */
  rightChain: boolean;
  simulation: SimulationMode;
  detail?: string;
}

/** Server side: `@baret/chain-<family>/engine`. */
export interface EngineAdapter<Req = unknown, Tx = unknown, Sim = unknown> {
  family: Family;
  version: string;
  /** The family payload inside /v1/analyze `request`. */
  requestSchema: ZodType<Req>;
  /** Canonical form for comparisons (EVM: lower-case; Stellar/Casper: as is). */
  normaliseAddress(address: string): string;
  pin(chain: ChainConfig): Promise<StatePin>;
  decode(request: Req, chain: ChainConfig): Promise<Tx>;
  simulate(tx: Tx, pin: StatePin, chain: ChainConfig): Promise<Sim | NoSimulation>;
  effects(tx: Tx, sim: Sim | NoSimulation, chain: ChainConfig): Promise<Effects>;
  detectors: readonly FamilyDetector<Tx, Sim>[];
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
