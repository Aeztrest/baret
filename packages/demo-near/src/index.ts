/**
 * @baret/demo-near (ADR-0010, ADR-0011): the NEAR demo for NEAR HACKATHON 2026.
 *
 *   scripts/keys.ts        new testnet key pairs for the vault, the agent and the shop
 *   scripts/accounts.ts    the owner creates them as sub-accounts
 *   scripts/deploy.ts      deploys the vault wasm (from CI's artifact) and initialises it
 *   scripts/setup.ts       policy: limits, receivers, the agent; funds the vault
 *   scripts/agent-key.ts   gives the agent a function call key that reaches only the
 *                          vault's execute_transfer, with a fee allowance
 *   src/agent-cli.ts       the agent: asks Baret before every payment, then pays through
 *                          the vault with that key; four scenarios
 *   src/view.ts            read-only vault state over plain fetch, for the web panel (/near)
 *   src/market-brief.ts    the Agent Market brief /near builds for a buyer (no JSON by hand)
 *
 * This entry point is browser-safe: it exports no near-api-js code.
 */
export {
  isNearAccount,
  type MarketBody,
  type MarketNetwork,
  marketBrief,
  nearToYocto,
  type TransferInput,
  type TransferProblem,
  transferBody,
} from "./market-brief.js";
export { type AgentAction, buildAction, SCENARIOS, type ScenarioName } from "./scenarios.js";
export {
  DEMO_CHAIN,
  demoAccounts,
  demoAnalyzeBody,
  demoRpcUrl,
  explorerAccount,
  explorerTx,
  formatNear,
  readVault,
  type VaultLimit,
  type VaultState,
} from "./view.js";
