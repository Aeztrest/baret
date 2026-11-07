/**
 * Metropolis parity layer (TASKS.md T1.6).
 *
 * Metropolis's own end-to-end tests (`metropolis.test.ts`, ported from
 * Baret-Metropolis/apps/server/src/application/analyze.test.ts) call `analyze(v1Request,
 * deps)` and assert on a v1 response. This file gives them exactly that, but runs the NEW
 * engine underneath: v1 request → v2 request → createEngine + createEvmAdapter → v2 verdict
 * → v1 response. If a Metropolis assertion holds here, the new engine reached the same
 * decision, findings, values, rules and balance changes.
 *
 * Every translation is listed below; nothing else is changed. Differences that are v2
 * design (new names) are translated; differences that are v2 behaviour are noted in the
 * test file where an assertion had to change.
 */

import { createEvmAdapter, type EvmSources } from "@baret/chain-evm/engine";
import { getChain } from "@baret/chains";
import {
  type ChainConfig,
  type Finding,
  migratePolicyV1,
  toCaip10,
  toCaip19,
  V1_FINDING_CODE_MAP,
  type Verdict,
} from "@baret/core";
import type { Address } from "viem";
import { createEngine } from "../../src/index.js";
import type { FakeRpc, V1NetworkConfig, V1Sources } from "./metropolis-fake.js";

export const MONAD_TESTNET = "eip155:10143";
const MAX_TX_GAS = 30_000_000n;

/** The v1 finding codes (@baret/guard 0.1.4 findings.ts). */
export const FINDING_CODES = [
  "SIMULATION_FAILED",
  "LOW_CONFIDENCE_INCOMPLETE_DATA",
  "ERC20_APPROVAL_GRANTED",
  "ERC20_APPROVAL_UNLIMITED",
  "NFT_OPERATOR_GRANTED",
  "APPROVAL_TO_WALLET",
  "PERMIT_SIGNATURE_DETECTED",
  "SIGNATURE_NOT_UNDERSTOOD",
  "SIGNATURE_UNRECOGNISED",
  "SIGNED_ORDER_DETECTED",
  "ORDER_PAYS_NOTHING",
  "RISKY_CONTRACT_INTERACTION",
  "UNKNOWN_CONTRACT_EXPOSURE",
  "VALUE_KEPT_BY_UNKNOWN_CONTRACT",
  "CALL_TO_ADDRESS_WITHOUT_CODE",
  "SELFDESTRUCT_CALL",
  "DELEGATECALL_DETECTED",
  "ACCOUNT_CODE_DELEGATION",
  "OWNERSHIP_TRANSFER",
  "KNOWN_MALICIOUS_ADDRESS",
  "LOOKALIKE_ADDRESS",
  "NANSEN_FLAGGED_FRESH_WALLET",
  "NANSEN_FLAGGED_WHALE_COUNTERPARTY",
  "NANSEN_TRUST_BELOW_MINIMUM",
  "REPUTATION_DATA_UNAVAILABLE",
  "COMPLIANCE_NO_CREDENTIAL",
  "COMPLIANCE_EXPIRED",
  "COMPLIANCE_TIER_INSUFFICIENT",
  "COMPLIANCE_COUNTRY_DISALLOWED",
  "COMPLIANCE_DATA_UNAVAILABLE",
  "DEEP_CALL_NESTING",
  "HIGH_OPERATION_COUNT",
  "EXCESSIVE_GAS",
  "ESTIMATED_LOSS_EXCEEDS_MAX",
  "LOSS_PERCENT_UNAVAILABLE",
  "POST_BALANCE_TOO_LOW",
  "POST_BALANCE_UNAVAILABLE",
  "X402_DESTINATION_MISMATCH",
  "X402_ASSET_MISMATCH",
  "X402_NON_CANONICAL_ASSET",
  "X402_ASSET_NOT_ALLOWED",
  "X402_MEMO_MISSING",
  "X402_MERCHANT_NOT_ALLOWED",
  "X402_PER_TX_CAP_EXCEEDED",
  "X402_HOURLY_CAP_EXCEEDED",
  "X402_DAILY_CAP_EXCEEDED",
  "X402_SPEND_HISTORY_UNAVAILABLE",
] as const;

// ---------------------------------------------------------------------------
// v1 shapes (loose: only what the tests read)

export interface V1Request {
  network: "testnet" | "mainnet";
  transaction?: Record<string, unknown>;
  typedData?: Record<string, unknown>;
  userWallet?: string;
  policy?: Record<string, unknown> | undefined;
  policyTemplate?: "strict" | "balanced" | "permissive";
  payment?: {
    origin: string;
    payTo: string;
    asset: string;
    amount: string;
    memo?: string | null;
    spendHistory?: { amount: string; timestamp: number }[];
  };
  integratorRequestId?: string;
}

export interface V1Response {
  decision: Verdict["decision"];
  findings: (Omit<Finding, "code"> & { code: string })[];
  firedRules: { rule: string | null; code: string; limit: string | null; actual: string | null }[];
  suggestions: { code: string; values: Record<string, string> }[];
  confidence: Verdict["confidence"];
  estimatedChanges: {
    account: string;
    asset: {
      kind: "native" | "erc20" | "erc721";
      address: string | null;
      symbol: string;
      decimals: number;
      tokenId?: string;
    };
    before: string | null;
    after: string | null;
    delta: string;
  }[];
  approvals: {
    owner: string;
    kind: "erc20" | "operator" | "permit";
    contract: string;
    symbol: string | null;
    decimals: number | null;
    spender: string;
    amount: string | null;
    unlimited: boolean;
  }[];
  sources: { name: string; status: string }[];
  expiresAt: string;
  meta: {
    requestId: string;
    network: string;
    chainId: number;
    analyzedAt: string;
    blockNumber: string | null;
    traced: boolean;
    integratorRequestId?: string;
  };
}

export interface V1Deps {
  config: { networks: Partial<Record<string, V1NetworkConfig>>; verdictTtlSeconds: number };
  rpcFor: (network: V1NetworkConfig) => FakeRpc;
  sourcesFor: (network: V1NetworkConfig) => V1Sources;
  now?: () => number;
}

// ---------------------------------------------------------------------------
// v1 → v2

const TRUST = { new: "new", established: "known", identified: "trusted" } as const;

function chainFor(network: V1NetworkConfig): ChainConfig {
  const base = getChain(MONAD_TESTNET) as ChainConfig;
  return {
    ...base,
    usdc: network.usdcAddress
      ? { id: toCaip19(MONAD_TESTNET, "erc20", network.usdcAddress), symbol: "USDC", decimals: 6 }
      : null,
  };
}

function sourcesFor(v1: V1Sources): EvmSources {
  return {
    reputation: v1.nansen && {
      name: "nansen",
      lookup: async (as) => {
        const answers = await (v1.nansen as NonNullable<V1Sources["nansen"]>).lookup(as);
        return new Map(
          [...answers].map(([a, p]) => [a, { ...p, trustLevel: TRUST[p.trustLevel] }]),
        );
      },
    },
    registry: v1.registry,
    compliance: v1.compliance,
  };
}

function toV2Request(req: V1Request, chain: ChainConfig): Record<string, unknown> {
  const t = req.transaction;
  const request = t
    ? "raw" in t
      ? { kind: "raw", raw: t.raw }
      : { kind: "call", tx: t }
    : { kind: "typed-data", typedData: req.typedData };
  const native = { id: chain.nativeAsset.id, decimals: chain.nativeAsset.decimals };
  const usdc = chain.usdc ? { id: chain.usdc.id, decimals: chain.usdc.decimals } : null;
  const p = req.payment;
  return {
    chain: chain.id,
    request,
    ...(req.policy
      ? { policy: migratePolicyV1(req.policy, { chain: chain.id, native, usdc }) }
      : {}),
    ...(req.policyTemplate ? { policyTemplate: req.policyTemplate } : {}),
    ...(req.userWallet ? { account: toCaip10(chain.id, req.userWallet) } : {}),
    ...(p
      ? {
          payment: {
            origin: p.origin,
            requirements: {
              scheme: "exact",
              network: chain.id,
              payTo: p.payTo,
              asset: toCaip19(chain.id, "erc20", p.asset),
              amount: p.amount,
              ...(p.memo !== undefined ? { memo: p.memo } : {}),
            },
            ...(p.spendHistory
              ? {
                  spendHistory: p.spendHistory.map((s) => ({
                    ...s,
                    asset: toCaip19(chain.id, "erc20", p.asset),
                  })),
                }
              : {}),
          },
        }
      : {}),
    ...(req.integratorRequestId ? { integratorRequestId: req.integratorRequestId } : {}),
  };
}

// ---------------------------------------------------------------------------
// v2 → v1

const V2_TO_V1_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(V1_FINDING_CODE_MAP).map(([v1, v2]) => [v2, v1]),
);

/** v2 rule path → v1 field. Paths that cover several v1 fields are resolved by code. */
function v1Rule(rule: string | null, code: string, values: Record<string, string>): string | null {
  if (rule === null) return null;
  const byCode: Record<string, string> = {
    X402_PER_TX_CAP_EXCEEDED: "maxPerTxCap",
    X402_HOURLY_CAP_EXCEEDED: "maxHourlyCap",
    X402_DAILY_CAP_EXCEEDED: "maxDailyCap",
    X402_SPEND_HISTORY_UNAVAILABLE: "maxHourlyCap",
  };
  if (rule === "core.x402.caps") return byCode[code] ?? rule;
  if (rule === "core.minPostBalances") {
    return values.asset === "USDC" ? "minPostUsdcBalance" : "minPostNativeBalance";
  }
  const map: Record<string, string> = {
    "core.blockAuthorityChanges": "blockOwnershipTransfer",
    "core.minReputationTrust": "minNansenTrustLevel",
    "core.compliance.required": "requireComplianceCheck",
    "core.compliance.allowedCountries": "allowedCountries",
    "core.compliance.minTier": "minComplianceTier",
    "core.x402.requireMemo": "requireMemo",
    "core.x402.allowedAssets": "allowedAssets",
    "core.x402.allowedMerchantOrigins": "allowedMerchantOrigins",
    "evm.maxGas": "maxGas",
  };
  return map[rule] ?? rule.split(".").pop() ?? rule;
}

/** Detail keys v2 adds for its new unified codes; v1 did not have them. */
function v1Details(code: string, details: Record<string, unknown> | undefined) {
  if (!details) return undefined;
  const { standard: _s, kind: _k, unit: _u, ...rest } = details;
  if (code === "APPROVAL_UNLIMITED" || code === "APPROVAL_GRANTED") {
    return Object.keys(rest).length > 0 ? rest : undefined;
  }
  if (code === "AUTHORITY_CHANGE" || code === "EXCESSIVE_FEE") {
    return Object.keys(rest).length > 0 ? rest : undefined;
  }
  if (code === "KNOWN_MALICIOUS_ADDRESS" && "provider" in details) {
    const { provider, ...others } = details;
    return { ...others, nansen: provider };
  }
  if (code === "REPUTATION_DATA_UNAVAILABLE" && Array.isArray(details.sources)) {
    return {
      ...details,
      sources: details.sources.map((s) => (s === "reputation-provider" ? "nansen" : s)),
    };
  }
  return details;
}

/** v2 trust levels in values back to Nansen's v1 names. */
const V1_TRUST: Record<string, string> = { known: "established", trusted: "identified" };
function v1Values(code: string, values: Record<string, string>): Record<string, string> {
  if (code !== "REPUTATION_TRUST_BELOW_MINIMUM") return values;
  const out = { ...values };
  for (const k of ["actual", "limit"] as const) {
    const level = out[k];
    if (level !== undefined) out[k] = V1_TRUST[level] ?? level;
  }
  return out;
}

const address = (caip: string) => caip.split(":").pop() as string;
const SOURCE_NAMES: Record<string, string> = { rpc: "alchemy", compliance: "cleanverse" };

function toV1Response(v: Verdict, req: V1Request): V1Response {
  return {
    decision: v.decision,
    findings: v.findings.map((f) => {
      const details = v1Details(f.code, f.details);
      return {
        code: V2_TO_V1_CODE[f.code] ?? f.code,
        severity: f.severity,
        values: v1Values(f.code, f.values),
        blocking: f.blocking,
        ...(details ? { details } : {}),
      };
    }),
    firedRules: v.firedRules.map((r) => {
      const values = v.findings.find((f) => f.code === r.code)?.values ?? {};
      const v1 = v1Values(r.code, { limit: r.limit ?? "", actual: r.actual ?? "" });
      return {
        rule: v1Rule(r.rule, r.code, values),
        code: V2_TO_V1_CODE[r.code] ?? r.code,
        limit: r.limit === null ? null : (v1.limit ?? r.limit),
        actual: r.actual === null ? null : (v1.actual ?? r.actual),
      };
    }),
    suggestions: v.suggestions.map((s) => ({ ...s, code: V2_TO_V1_CODE[s.code] ?? s.code })),
    confidence: v.confidence,
    estimatedChanges: v.estimatedChanges.map((c) => {
      const ref = c.asset.id.split("/")[1] ?? "";
      const kind =
        c.asset.kind === "native" ? "native" : c.asset.kind === "nft" ? "erc721" : "erc20";
      return {
        account: address(c.account),
        asset: {
          kind,
          address: kind === "native" ? null : (ref.split(":")[1] ?? null),
          symbol: c.asset.symbol ?? "",
          decimals: c.asset.decimals ?? 0,
          ...(c.asset.tokenId !== undefined ? { tokenId: c.asset.tokenId } : {}),
        },
        before: c.before,
        after: c.after,
        delta: c.delta,
      };
    }),
    approvals: v.allowances.map((a) => ({
      owner: address(a.owner),
      kind: a.via === "signature" ? "permit" : a.scope === "collection" ? "operator" : "erc20",
      contract: (a.asset.id.split("/")[1] ?? "").split(":")[1] ?? "",
      symbol: a.asset.symbol,
      decimals: a.asset.decimals,
      spender: address(a.spender),
      amount: a.amount,
      unlimited: a.unlimited,
    })),
    sources: v.sources.map((s) => ({ name: SOURCE_NAMES[s.name] ?? s.name, status: s.status })),
    expiresAt: new Date(v.expiresAt * 1000).toISOString(),
    meta: {
      requestId: v.meta.requestId,
      network: req.network,
      chainId: 10143,
      analyzedAt: v.meta.analyzedAt,
      blockNumber: v.pinnedAt?.value ?? null,
      traced: v.meta.simulation === "trace",
      ...(v.meta.integratorRequestId ? { integratorRequestId: v.meta.integratorRequestId } : {}),
    },
  };
}

// ---------------------------------------------------------------------------

/** Metropolis's `analyze(request, deps)`, running the new engine. */
export async function analyze(req: V1Request, deps: V1Deps): Promise<V1Response> {
  const network = deps.config.networks[req.network];
  if (!network) throw new Error(`this server does not serve Monad ${req.network}`);
  const chain = chainFor(network);
  const rpc = deps.rpcFor(network);
  const sources = sourcesFor(deps.sourcesFor(network));
  const engine = createEngine({
    adapters: {
      evm: createEvmAdapter(() => ({
        network: {
          chain,
          chainId: 10143,
          usdcAddress: network.usdcAddress,
          knownContracts: network.knownContracts,
          paymentGuardFactoryAddress: network.paymentGuardFactoryAddress,
          cleanverse: network.cleanverse,
        },
        rpc,
        sources,
        maxTxGas: MAX_TX_GAS,
      })),
    },
    chains: [chain],
    verdictTtlSeconds: deps.config.verdictTtlSeconds,
    ...(deps.now ? { now: deps.now } : {}),
  });
  const verdict = await engine.analyze(toV2Request(req, chain));
  return toV1Response(verdict, req);
}

/** The v1 request rule the tests check: a policy and a template are not sent together. */
export const analyzeRequestSchema = {
  safeParse: (req: V1Request) => ({
    success: !(req.policy !== undefined && req.policyTemplate !== undefined),
  }),
};

export type { Address };
