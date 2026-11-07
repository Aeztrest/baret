/**
 * @baret/demo-evm (ADR-0010): the EVM side of the web app's demo sites. Their
 * addresses (from the chain registry), the transactions each site builds, the x402
 * payments, and the `/v1/analyze` bodies for them. The only place outside
 * packages/chain-evm that may import viem.
 */
export {
  DEMO,
  DEMO_ACCOUNT,
  DEMO_CHAIN,
  DEMO_CHAIN_ID,
  DEMO_FAUCET,
  explorerTx,
} from "./addresses.js";
export {
  agentCalls,
  claimhub,
  DEMO_USDC_ABI,
  type DemoTx,
  launchpad,
  NOVASWAP_ROUTER_ABI,
  novaswap,
  orbityield,
  pixeldrop,
  quoteMonForUsdc,
  SITES_ABI,
} from "./builders.js";
export { callRequest, type DemoRules, paymentRequest } from "./request.js";
export { demoScenarios, hourlyCap, type Scenario } from "./scenarios.js";
export { agentPayments, type DemoPayment, type DemoTypedData, payment, scrybe } from "./x402.js";
