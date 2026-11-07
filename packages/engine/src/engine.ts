import { randomUUID } from "node:crypto";
import { getChain, policyContext } from "@baret/chains";
import {
  type AnalyzeRequest,
  analyzeRequestSchema,
  type ChainConfig,
  ChainUnsupportedError,
  createPolicy,
  type EngineAdapter,
  type Family,
  type Finding,
  InvalidRequestError,
  type Suggestion,
  type Verdict,
  verdictSchema,
} from "@baret/core";
import { decide } from "./decide.js";

export const ENGINE_VERSION = "0.2.0";

export interface EngineOptions {
  /** One adapter per family this deployment serves. */
  adapters: Partial<Record<Family, EngineAdapter>>;
  /** The chains this deployment serves (from `enabledChains(env)`). */
  chains: readonly ChainConfig[];
  /** Seconds a verdict stays valid for signing. */
  verdictTtlSeconds: number;
  /** Unix seconds; injectable for tests. */
  now?: () => number;
}

export interface Engine {
  analyze(input: unknown): Promise<Verdict>;
  chains: readonly ChainConfig[];
}

/**
 * The analysis entry point (docs/architecture/engine.md §1): validate, resolve the chain
 * and its adapter, let the adapter analyse, decide under the policy, assemble the verdict
 * and check it against its schema before anyone sees it.
 *
 * Throws InvalidRequestError (400), ChainUnsupportedError (400) and, from adapters,
 * ChainUnavailableError (503). Never returns a verdict it could not complete.
 */
export function createEngine(options: EngineOptions): Engine {
  const served = new Map(options.chains.map((c) => [c.id, c]));

  async function analyze(input: unknown): Promise<Verdict> {
    const parsed = analyzeRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new InvalidRequestError(parsed.error.issues[0]?.message ?? "invalid request");
    const req: AnalyzeRequest = parsed.data;

    const chain = served.get(req.chain);
    if (!chain) {
      throw new ChainUnsupportedError(
        getChain(req.chain)
          ? `${req.chain} is not enabled on this deployment`
          : `${req.chain} is not a chain Baret supports`,
      );
    }
    const adapter = options.adapters[chain.family];
    if (!adapter) throw new ChainUnsupportedError(`no ${chain.family} adapter on this deployment`);
    const request = adapter.requestSchema.safeParse(req.request);
    if (!request.success) {
      throw new InvalidRequestError(request.error.issues[0]?.message ?? "invalid request");
    }

    const now = options.now?.() ?? Math.floor(Date.now() / 1000);
    const policy =
      req.policy ?? createPolicy(req.policyTemplate ?? "balanced", policyContext(chain));

    const result = await adapter.analyze({
      chain,
      request: request.data,
      account: req.account ?? null,
      policy,
      payment: req.payment ?? null,
      now,
    });

    const decided = decide(policy, result.drafts);
    const verdict: Verdict = {
      decision: decided.decision,
      findings: decided.findings,
      firedRules: decided.firedRules,
      suggestions: suggestionsFor(decided.findings),
      confidence: decided.findings.some((f) => f.code.endsWith("_UNAVAILABLE"))
        ? "low"
        : result.confidence,
      estimatedChanges: result.estimatedChanges,
      allowances: result.allowances,
      sources: result.sources,
      chain: chain.id,
      pinnedAt: result.pinnedAt,
      expiresAt: now + options.verdictTtlSeconds,
      meta: {
        requestId: randomUUID(),
        engineVersion: ENGINE_VERSION,
        adapterVersion: adapter.version,
        simulation: result.simulation,
        analyzedAt: new Date(now * 1000).toISOString(),
        ...(req.integratorRequestId ? { integratorRequestId: req.integratorRequestId } : {}),
      },
    };
    // The verdict is a contract with every client: never send one that breaks it.
    return verdictSchema.parse(verdict);
  }

  return { analyze, chains: options.chains };
}

/** An unlimited approval the same request only needs part of: suggest the bounded amount. */
function suggestionsFor(findings: readonly Finding[]): Suggestion[] {
  return findings
    .filter((f) => f.code === "APPROVAL_UNLIMITED" && f.values.amount)
    .map((f) => ({
      code: f.code,
      values: { amount: f.values.amount ?? "", asset: f.values.asset ?? "" },
    }));
}
