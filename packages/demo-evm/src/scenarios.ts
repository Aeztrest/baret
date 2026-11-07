import {
  type AnalyzeRequest,
  createPolicy,
  type Decision,
  type FindingCode,
  type PolicyChainContext,
} from "@baret/core";
import { type Address, parseEther } from "viem";
import { DEMO } from "./addresses.js";
import {
  agentCalls,
  claimhub,
  type DemoTx,
  launchpad,
  novaswap,
  orbityield,
  pixeldrop,
} from "./builders.js";
import { callRequest, type DemoRules, paymentRequest } from "./request.js";
import { agentPayments, type DemoPayment, scrybe } from "./x402.js";

/**
 * Every demo scenario with the verdict and the finding codes its site expects under
 * the rules it is checked with. Ported from Metropolis (apps/server/scripts/
 * demo-scenarios.ts) with the codes renamed to v2. Read by scripts/verify-live.ts,
 * which sends them to a Baret API and compares; the Cleanverse transfers wait for the
 * compliance provider (TASKS.md T1.7).
 */
export interface Scenario {
  name: string;
  body: AnalyzeRequest;
  decision: Decision;
  codes: FindingCode[];
}

/** USDC as the only payment asset, as the registry's policy context gives it. */
const CONTEXT: PolicyChainContext = {
  paymentAssets: [{ id: DEMO.usdcId, decimals: 6 }],
  native: { id: "eip155:10143/slip44:60", decimals: 18, floors: {} },
};

/** Balanced, with an hourly cap of `cap` USDC base units on USDC. */
export function hourlyCap(cap: bigint): DemoRules {
  const policy = createPolicy("balanced", CONTEXT);
  policy.core.x402.caps = [
    { asset: DEMO.usdcId, perTx: null, perHour: cap.toString(), perDay: null },
  ];
  return { policy };
}

const call = (tx: DemoTx, rules?: DemoRules) => callRequest(tx, rules);
const pay = (p: DemoPayment, rules?: DemoRules) => paymentRequest(p, rules);
const mon = (n: string) => parseEther(n);

export function demoScenarios(from: Address): Scenario[] {
  return [
    {
      name: "NovaSwap   honest swap",
      body: call(novaswap.swapMonForUsdc(from, mon("0.5"))),
      decision: "safe",
      codes: [],
    },
    {
      name: "NovaSwap   attack: unlimited approval to the look-alike",
      body: call(novaswap.attackApprove(from)),
      decision: "blocked",
      // The drainer was ground to copy the router's first and last characters.
      codes: ["APPROVAL_UNLIMITED", "KNOWN_MALICIOUS_ADDRESS", "LOOKALIKE_ADDRESS"],
    },
    {
      name: "PixelDrop  honest mint of 2",
      body: call(pixeldrop.mint(from, 2)),
      decision: "safe",
      codes: [],
    },
    {
      name: "PixelDrop  attack: whole collection to the drainer",
      body: call(pixeldrop.attackApproveAll(from)),
      decision: "blocked",
      codes: ["NFT_OPERATOR_GRANTED", "KNOWN_MALICIOUS_ADDRESS"],
    },
    {
      name: "OrbitYield honest stake",
      body: call(orbityield.stake(from, mon("1"))),
      decision: "safe",
      codes: [],
    },
    {
      name: "OrbitYield attack: silent pool, small",
      body: call(orbityield.attackStake(from, mon("0.1"))),
      decision: "blocked",
      codes: ["UNKNOWN_CONTRACT_EXPOSURE", "VALUE_KEPT_BY_UNKNOWN_CONTRACT"],
    },
    {
      name: "ClaimHub   honest claim",
      body: call(claimhub.claim(from)),
      decision: "safe",
      codes: [],
    },
    {
      name: "ClaimHub   attack: unlimited USDC to the drainer",
      body: call(claimhub.attackApprove(from)),
      decision: "blocked",
      codes: ["APPROVAL_UNLIMITED", "KNOWN_MALICIOUS_ADDRESS"],
    },
    {
      name: "LaunchPad  honest contribution",
      body: call(launchpad.contribute(from, mon("0.2"))),
      decision: "safe",
      codes: [],
    },
    {
      name: "LaunchPad  proxy sale",
      body: call(launchpad.attackContribute(from, mon("0.2"))),
      decision: "blocked",
      codes: ["UNKNOWN_CONTRACT_EXPOSURE", "UNKNOWN_CONTRACT_EXPOSURE", "DELEGATECALL_DETECTED"],
    },
    {
      name: "Scrybe     first answer, cap 0.25",
      body: pay(scrybe.pay(from, 0), hourlyCap(250_000n)),
      decision: "safe",
      codes: [],
    },
    {
      name: "Scrybe     sixth answer in the hour, cap 0.25",
      body: pay(scrybe.pay(from, 5), hourlyCap(250_000n)),
      decision: "blocked",
      codes: ["X402_HOURLY_CAP_EXCEEDED"],
    },
    {
      name: "Agents     pay a merchant",
      body: pay(agentPayments.pay(from)),
      decision: "safe",
      codes: [],
    },
    {
      name: "Agents     unlimited allowance",
      body: call(agentCalls.unlimitedAllowance(from)),
      decision: "blocked",
      codes: ["APPROVAL_UNLIMITED", "UNKNOWN_CONTRACT_EXPOSURE"],
    },
    {
      name: "Agents     pay the wrong address",
      body: pay(agentPayments.wrongPayee(from)),
      decision: "caution",
      codes: ["X402_DESTINATION_MISMATCH"],
    },
    {
      name: "Agents     pay with a look-alike token",
      body: pay(agentPayments.lookalikeToken(from)),
      decision: "blocked",
      codes: ["X402_ASSET_MISMATCH", "X402_NON_CANONICAL_ASSET"],
    },
    {
      name: "Agents     hand over a collection",
      body: call(agentCalls.operatorApproval(from)),
      decision: "blocked",
      // The operator is a wallet, not a marketplace contract.
      codes: ["NFT_OPERATOR_GRANTED", "APPROVAL_TO_WALLET"],
    },
    {
      name: "Agents     send to a flagged wallet",
      body: call(agentCalls.flaggedAddress(from)),
      decision: "blocked",
      codes: ["KNOWN_MALICIOUS_ADDRESS"],
    },
  ];
}
