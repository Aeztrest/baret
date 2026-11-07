import type {
  ChainConfig,
  FindingDraft as CoreFindingDraft,
  GuardPolicy,
  PaymentContext,
  PolicyField,
  ReputationTrustLevel,
  SourceStatus,
} from "@baret/core";
import type { Address, Hex } from "viem";
import type { NormalizedTx } from "../simulation/decode.js";
import type { CallTrace } from "../simulation/trace.js";
import type { EvmEffects } from "./effects.js";

/**
 * Everything the EVM detectors and policy rules read. Built by the pipeline, which does
 * all the I/O; detectors are pure functions of this object. Ported from Metropolis
 * `analysis/context.ts`, with GuardPolicy v2 and the chain taken from the registry.
 */

/** One EVM chain as the analysis sees it: the registry entry plus deployment facts. */
export interface EvmNetwork {
  chain: ChainConfig;
  chainId: number;
  /** The canonical USDC, from the registry. */
  usdcAddress: Address | null;
  /** Contracts Baret vouches for on this chain (listed + its own deployments + vaults). */
  knownContracts: Address[];
  paymentGuardFactoryAddress: Address | null;
  /** Cleanverse's identity (A-Pass) and asset-policy contracts, when the chain has them. */
  cleanverse: { apass: Address; policy: Address } | null;
}

export interface TokenMeta {
  symbol: string;
  decimals: number;
}

/** A source lookup: the answers, or null when the source did not answer. */
export interface Lookup<T> {
  status: SourceStatus["status"];
  data: Map<Address, T> | null;
}

/** What a reputation provider says about one address (Nansen today; provider-neutral). */
export interface ReputationProfile {
  trustLevel: ReputationTrustLevel;
  flagged: boolean;
  freshWallet: boolean;
  whale: boolean;
}

/** An entry in Baret's on-chain ReputationRegistry. */
export interface RegistryEntry {
  flagged: boolean;
  /** 1 low … 4 critical; 3 and above is a blocklist entry. */
  severity: number;
  reasonCode: string;
}

export const REGISTRY_BLOCKLIST_SEVERITY = 3;

/** An active identity credential (Cleanverse A-Pass), or null when the address has none. */
export interface Credential {
  /** Unix seconds; null when it does not expire. */
  expiresAt: number | null;
  /** ISO 3166-1 alpha-2 codes the credential carries. Can be empty. */
  countries: string[];
  tier: number;
}

export interface DelegateCall {
  /** The contract whose storage and funds the borrowed code runs with. */
  contract: Address;
  codeFrom: Address;
  /** The target is the contract's own EIP-1967 implementation: a standard proxy. */
  standardProxy: boolean;
  /** The call was undone. Still listed, so a proxy is recognised in a failed simulation too. */
  reverted: boolean;
}

export interface EvmContext {
  network: EvmNetwork;
  policy: GuardPolicy;
  now: number;
  user: Address;
  tx: NormalizedTx | null;
  simulation: {
    ran: boolean;
    ok: boolean;
    revertReason: string | null;
    /** The raw revert data, when the node returned it: a typed error can be decoded from it. */
    revertData: Hex | null;
    traced: boolean;
    /** The gas limit the network will charge for: the sender's, else the estimate. */
    gasLimit: bigint | null;
  };
  trace: CallTrace | null;
  effects: EvmEffects;
  delegateCalls: DelegateCall[];
  selfdestructs: Address[];
  /** Touched addresses that hold code. */
  contracts: Address[];
  /** Addresses whose code was read and is empty: wallets. Not read: in neither list. */
  codeless: Address[];
  /** Addresses that receive funds, rights or calls from the user. */
  counterparties: Address[];
  /** Addresses that receive value from the user (compliance applies to these). */
  recipients: Address[];
  tokens: Map<Address, TokenMeta>;
  /** Balances at the simulation block, base units. Null when the read failed. */
  balancesBefore: { native: bigint | null; tokens: Map<Address, bigint | null> };
  /** The network fee in native base units, null when it cannot be priced. */
  feeWei: bigint | null;
  reputation: Lookup<ReputationProfile>;
  registry: Lookup<RegistryEntry>;
  compliance: Lookup<Credential | null>;
  /** Compliant assets (CVA) the user sends: such a token moves only between credential holders. */
  gatedAssets: Address[];
  payment: PaymentContext | null;
}

/** A finding before the policy decides it, with the rule that produced it when several can. */
export interface FindingDraft extends CoreFindingDraft {
  rule?: PolicyField;
}

export type Detector = (ctx: EvmContext) => FindingDraft[];
