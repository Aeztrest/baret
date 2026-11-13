import { MarketClient, type Verdict } from "@baret/agent-market";
import {
  createEvmAdapter,
  type EvmDeps,
  MAX_TX_GAS,
  OnchainRegistrySource,
  ViemEvmRpc,
} from "@baret/chain-evm/engine";
import {
  createNearAdapter,
  FastNearHistory,
  JsonNearRpc,
  MPC_CONTRACTS,
  NEAR_ARCHIVAL_RPC,
  NEAR_HISTORY_API,
  type NearDeps,
  ONECLICK_API,
  OneClickClient,
} from "@baret/chain-near/engine";
import { getDeployment, getShowcase, knownAddresses } from "@baret/chains";
import type { ChainConfig } from "@baret/core";
import { createEngine } from "@baret/engine";

import { buildApp } from "./app.js";
import { type ChainEndpoints, loadConfig } from "./config.js";

/** Registry addresses are stored checksummed (packages/chains), so they are used as they are. */
const addr = (a: string) => a as `0x${string}`;

/**
 * The API's composition root: configuration → per-chain dependencies → adapters → engine
 * → HTTP. The only place that knows which families exist.
 */
const config = loadConfig();
const endpoints = new Map(config.chains.map((c) => [c.chain.id, c]));
const evmDeps = new Map<string, EvmDeps>();

function evmDepsFor(chain: ChainConfig): EvmDeps {
  const cached = evmDeps.get(chain.id);
  if (cached) return cached;
  const ep = endpoints.get(chain.id) as ChainEndpoints;
  const chainId = Number(chain.id.split(":")[1]);
  const registry = getDeployment(chain.id, "ReputationRegistry");
  const factory = getDeployment(chain.id, "PaymentGuardFactory");
  const deps: EvmDeps = {
    network: {
      chain,
      chainId,
      usdcAddress: chain.usdc ? addr(chain.usdc.id.split(":").pop() as string) : null,
      // Baret's own contracts and the listed demo contracts (rule: addresses are data).
      knownContracts: knownAddresses(chain.id).map(addr),
      paymentGuardFactoryAddress: factory ? addr(factory.address) : null,
      cleanverse: null, // compliance provider: TASKS.md T1.7
    },
    rpc: new ViemEvmRpc({
      chainId,
      rpcUrl: ep.rpcUrl,
      traceRpcUrl: ep.traceRpcUrl,
      timeoutMs: config.requestTimeoutMs,
      batch: chain.features.rpcBatch,
    }),
    sources: {
      reputation: null, // reputation provider (Nansen): TASKS.md T1.7
      registry: registry
        ? new OnchainRegistrySource(ep.rpcUrl, addr(registry.address), config.requestTimeoutMs)
        : null,
      compliance: null, // TASKS.md T1.7
    },
    maxTxGas: MAX_TX_GAS[chain.id] ?? null,
  };
  evmDeps.set(chain.id, deps);
  return deps;
}

const nearDeps = new Map<string, NearDeps>();

/** One NEAR chain's RPC and lists (ADR-0011). Reported accounts come from the showcase data. */
function nearDepsFor(chain: ChainConfig): NearDeps {
  const cached = nearDeps.get(chain.id);
  if (cached) return cached;
  const ep = endpoints.get(chain.id) as ChainEndpoints;
  const showcase = Object.values(getShowcase(chain.id));
  const deps: NearDeps = {
    rpc: new JsonNearRpc(ep.rpcUrl, config.requestTimeoutMs),
    knownContracts: knownAddresses(chain.id),
    flagged: new Map(
      showcase.filter((e) => e.reported).map((e) => [e.address, e.reportedAs ?? "REPORTED"]),
    ),
    mpcContracts: MPC_CONTRACTS[chain.id] ?? [],
  };
  // NEAR Intents is mainnet only: elsewhere a request carrying a quote fails closed.
  const oneClick = ONECLICK_API[chain.id];
  if (oneClick) deps.intents = new OneClickClient(oneClick, config.requestTimeoutMs);
  // Counterparty history (TN.14): FastNEAR's transaction index and an archival node.
  const history = NEAR_HISTORY_API[chain.id];
  if (history) deps.history = new FastNearHistory(history, config.requestTimeoutMs);
  // The shared blocklist (TN.14), when it is deployed on this chain (registry).
  const blocklist = getDeployment(chain.id, "BaretBlocklist");
  if (blocklist) deps.blocklist = blocklist.address;
  const archival = NEAR_ARCHIVAL_RPC[chain.id];
  if (archival) deps.archive = new JsonNearRpc(archival, config.requestTimeoutMs);
  nearDeps.set(chain.id, deps);
  return deps;
}

const evm = createEvmAdapter(evmDepsFor);
const near = createNearAdapter(nearDepsFor);
const adapters = { evm, near } as const;
const engine = createEngine({
  adapters,
  chains: config.chains.map((c) => c.chain).filter((c) => c.family in adapters),
  verdictTtlSeconds: config.verdictTtlSeconds,
});

const app = await buildApp({
  config,
  engine,
  health: (chain) => (chain.family === "near" ? near : evm).health(chain),
  commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
  // A hire is analysed in process, by the same engine as /v1/analyze; any error is "no
  // verdict", which the deliverable says plainly (never Safe).
  market: config.market
    ? {
        secret: config.market.webhookSecret,
        client: new MarketClient(config.market.token, config.market.apiUrl),
        analyze: async (body) => (await engine.analyze(body)) as Verdict,
      }
    : null,
});

if (engine.chains.length === 0) {
  app.log.warn("no chain is enabled: set CHAIN_<SLUG>_RPC_URL (docs/operations/environments.md)");
}
app.log.info(
  config.market ? "Agent Market webhook on POST /v1/market/webhook" : "Agent Market webhook off",
);
if (config.apiKeys.length === 0) {
  app.log.warn("BARET_API_KEYS is empty: /v1 endpoints are open. Set it before production.");
}

await app.listen({ port: config.port, host: config.host });
