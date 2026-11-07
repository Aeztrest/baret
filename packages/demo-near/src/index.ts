/**
 * @baret/demo-near (ADR-0010, ADR-0011): the NEAR demo for NEAR HACKATHON 2026.
 *
 *   scripts/keys.ts       new testnet key pairs for the vault, the agent and the shop
 *   scripts/accounts.ts   the owner creates them as sub-accounts
 *   scripts/deploy.ts     deploys the vault wasm (from CI's artifact) and initialises it
 *   scripts/setup.ts      policy: limits, receivers, the agent; funds the vault
 *   scripts/agent-key.ts  gives the agent a function call key that reaches only the
 *                         vault's execute_transfer, with a fee allowance
 *   src/agent-cli.ts      the agent: asks Baret before every payment, then pays through
 *                         the vault with that key; four scenarios
 */
export { type AgentAction, buildAction, SCENARIOS, type ScenarioName } from "./scenarios.js";
