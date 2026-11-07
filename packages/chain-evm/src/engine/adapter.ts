import type { ChainConfig, ChainHealth, EngineAdapter } from "@baret/core";
import { analyzeEvm, type EvmDeps } from "./pipeline.js";
import { evmRequestSchema } from "./request.js";

export const EVM_ADAPTER_VERSION = "0.2.0";

/**
 * The most gas one transaction may use, per chain. A request above it can never be
 * included, so it is refused as invalid instead of simulated (Metropolis: Monad, 30M).
 */
export const MAX_TX_GAS: Record<string, bigint> = {
  "eip155:10143": 30_000_000n,
  "eip155:143": 30_000_000n,
};

/**
 * The EVM family's EngineAdapter. `depsFor` hands it the network, RPC and sources of one
 * chain; the API builds them from the registry and its environment (TASKS.md T1.8).
 */
export function createEvmAdapter(depsFor: (chain: ChainConfig) => EvmDeps): EngineAdapter {
  return {
    family: "evm",
    version: EVM_ADAPTER_VERSION,
    requestSchema: evmRequestSchema,
    analyze: (input) => analyzeEvm(input, depsFor(input.chain)),
    async health(chain): Promise<ChainHealth> {
      const { rpc } = depsFor(chain);
      try {
        await rpc.verifyChain();
        await rpc.getBlockNumber();
        return { reachable: true, rightChain: true, simulation: chain.features.simulation };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        const wrongChain = /expected chain/.test(detail);
        return { reachable: wrongChain, rightChain: false, simulation: "none", detail };
      }
    },
  };
}
