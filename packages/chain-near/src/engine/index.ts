import type { ChainConfig, ChainHealth, EngineAdapter } from "@baret/core";
import { analyzeNear, type NearDeps } from "./pipeline.js";
import { nearRequestSchema } from "./request.js";

export { toTransaction } from "./decode.js";
export {
  type AccountHistory,
  FastNearHistory,
  HISTORY_SCAN_LIMIT,
  HistoryUnavailableError,
  NEAR_HISTORY_API,
  type NearHistory,
} from "./history.js";
export { type IntentsClient, ONECLICK_API, OneClickClient } from "./intents.js";
export {
  analyzeNear,
  assetOf,
  CODE_WINDOW_BLOCKS,
  decodeAccount,
  encodeAccount,
  FRESH_ACCOUNT_MS,
  type NearDeps,
  units,
  vaultRefusal,
} from "./pipeline.js";
export {
  type NearAction,
  type NearRequest,
  type NearTransaction,
  nearActionSchema,
  nearRequestSchema,
  nearTransactionSchema,
} from "./request.js";
export {
  JsonNearRpc,
  type NearAccessKey,
  type NearAccountState,
  type NearRpc,
  RpcUnavailableError,
} from "./rpc.js";

export const NEAR_ADAPTER_VERSION = "0.1.0";

/** Archival NEAR RPC per network, for code-change reads (TN.14). */
export const NEAR_ARCHIVAL_RPC: Record<string, string> = {
  "near:testnet": "https://archival-rpc.testnet.fastnear.com",
  "near:mainnet": "https://archival-rpc.mainnet.fastnear.com",
};

/** The Chain Signatures MPC contract per network (docs/chains/near.md §3). */
export const MPC_CONTRACTS: Record<string, readonly string[]> = {
  "near:testnet": ["v1.signer-prod.testnet"],
  "near:mainnet": ["v1.signer"],
};

/**
 * The NEAR family's EngineAdapter (ADR-0011). `depsFor` hands it one chain's RPC and
 * lists; the API builds them from the registry and its environment.
 */
export function createNearAdapter(depsFor: (chain: ChainConfig) => NearDeps): EngineAdapter {
  return {
    family: "near",
    version: NEAR_ADAPTER_VERSION,
    requestSchema: nearRequestSchema,
    analyze: (input) => analyzeNear(input, depsFor(input.chain)),
    async health(chain): Promise<ChainHealth> {
      const { rpc } = depsFor(chain);
      try {
        const id = await rpc.chainId();
        const want = chain.id.split(":")[1];
        if (id !== want) {
          return {
            reachable: true,
            rightChain: false,
            simulation: "none",
            detail: `expected chain ${want}, got ${id}`,
          };
        }
        await rpc.pin();
        return { reachable: true, rightChain: true, simulation: chain.features.simulation };
      } catch (err) {
        return {
          reachable: false,
          rightChain: false,
          simulation: "none",
          detail: (err as Error).message,
        };
      }
    },
  };
}
