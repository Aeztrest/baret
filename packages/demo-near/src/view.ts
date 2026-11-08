/**
 * Reads the demo vault's state for the web panel (/near, TN.9): JSON-RPC over plain
 * fetch, no near-api-js, so it runs in a browser bundle without a chain library.
 * Every read is a view call or view_account; nothing here signs.
 */
import { getChain, getDeployment, getShowcase } from "@baret/chains";
import { type AgentAction, buildAction, type ScenarioName } from "./scenarios.js";

export const DEMO_CHAIN = "near:testnet" as const;

/** The demo accounts, from the registry (packages/chains/deployments/near-testnet.json). */
export function demoAccounts(): { vault: string; shop: string; agent: string; owner: string } {
  const vault = getDeployment(DEMO_CHAIN, "BaretVault")?.address;
  const shop = getShowcase(DEMO_CHAIN).DemoShop?.address;
  const agent = getShowcase(DEMO_CHAIN).DemoAgent?.address;
  if (!vault || !shop || !agent)
    throw new Error("near:testnet demo accounts missing from registry");
  return { vault, shop, agent, owner: vault.slice(vault.indexOf(".") + 1) };
}

/** The chain's public RPC URL from the registry. */
export function demoRpcUrl(): string {
  const url = getChain(DEMO_CHAIN)?.publicRpcUrl;
  if (!url) throw new Error("near:testnet has no public RPC in the registry");
  return url;
}

export function explorerAccount(id: string): string {
  const template = getChain(DEMO_CHAIN)?.explorer.address;
  if (!template) throw new Error("near:testnet has no explorer in the registry");
  return template.replace("{address}", id);
}

export function explorerTx(hash: string): string {
  const template = getChain(DEMO_CHAIN)?.explorer.tx;
  if (!template) throw new Error("near:testnet has no explorer in the registry");
  return template.replace("{hash}", hash);
}

export interface VaultLimit {
  asset: string;
  perTransfer: bigint;
  perDay: bigint;
}

export interface VaultState {
  owner: string;
  paused: boolean;
  agents: string[];
  receivers: string[];
  limits: VaultLimit[];
  /** NATIVE ("native") spending in the rolling 24 hours, yoctoNEAR. */
  spentToday: bigint;
  /** The largest NEAR transfer the vault takes now: min(per transfer, what is left of the day). */
  nextTransferMax: bigint;
  /** The vault account's NEAR balance, yoctoNEAR. */
  balance: bigint;
  /** The block the reads were made at. */
  block: number;
}

type Fetch = typeof fetch;

async function rpc(url: string, method: string, params: unknown, f: Fetch): Promise<unknown> {
  const res = await f(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "baret", method, params }),
  });
  if (!res.ok) throw new Error(`NEAR RPC ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: unknown };
  if (body.error !== undefined || body.result === undefined) throw new Error("NEAR RPC error");
  return body.result;
}

function toBase64(s: string): string {
  return btoa(s);
}

async function view(
  url: string,
  block: number,
  account: string,
  method: string,
  args: object,
  f: Fetch,
): Promise<unknown> {
  const out = (await rpc(
    url,
    "query",
    {
      request_type: "call_function",
      block_id: block,
      account_id: account,
      method_name: method,
      args_base64: toBase64(JSON.stringify(args)),
    },
    f,
  )) as { result?: number[] };
  if (!Array.isArray(out.result)) throw new Error(`${method}: no result`);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(out.result)));
}

interface PolicyView {
  owner: string;
  paused: boolean;
  agents: string[];
  receivers: string[];
  limits: [string, { per_transfer: string; per_day: string }][];
}

/** The vault's policy, today's spending and its balance, all read at one final block. */
export async function readVault(
  vault: string,
  url: string = demoRpcUrl(),
  f: Fetch = fetch,
): Promise<VaultState> {
  const head = (await rpc(url, "block", { finality: "final" }, f)) as {
    header: { height: number };
  };
  const block = head.header.height;
  const [policy, spent, remaining, account] = await Promise.all([
    view(url, block, vault, "get_policy", {}, f) as Promise<PolicyView>,
    view(url, block, vault, "get_spent_today", { asset: "native" }, f) as Promise<string>,
    view(url, block, vault, "get_remaining", { asset: "native" }, f) as Promise<string>,
    rpc(
      url,
      "query",
      { request_type: "view_account", block_id: block, account_id: vault },
      f,
    ) as Promise<{
      amount: string;
    }>,
  ]);
  return {
    owner: policy.owner,
    paused: policy.paused,
    agents: policy.agents,
    receivers: policy.receivers,
    limits: policy.limits.map(([asset, l]) => ({
      asset,
      perTransfer: BigInt(l.per_transfer),
      perDay: BigInt(l.per_day),
    })),
    spentToday: BigInt(spent),
    nextTransferMax: BigInt(remaining),
    balance: BigInt(account.amount),
    block,
  };
}

/** yoctoNEAR to a short NEAR amount: at most 4 decimals, cut, no trailing zeros. */
export function formatNear(yocto: bigint): string {
  const neg = yocto < 0n;
  const v = neg ? -yocto : yocto;
  const whole = v / 10n ** 24n;
  const frac = ((v % 10n ** 24n) / 10n ** 20n).toString().padStart(4, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : `${whole}`;
  return neg && s !== "0" ? `-${s}` : s;
}

/**
 * The attacker's key in the add-key scenario on the panel: 32 zero bytes. It only has to
 * be a well-formed key; the panel never signs, it asks Baret.
 */
const PANEL_ATTACKER_KEY = "ed25519:11111111111111111111111111111111";

/** The /v1/analyze body for one of the agent's four requests, as the panel sends it. */
export function demoAnalyzeBody(name: ScenarioName): {
  chain: typeof DEMO_CHAIN;
  request: { kind: "transaction"; tx: AgentAction["tx"] };
  policyTemplate: "balanced";
} {
  const a = demoAccounts();
  const action = buildAction(name, {
    agent: a.agent,
    vault: a.vault,
    shop: a.shop,
    attacker: "drain-it-all.testnet",
    attackerKey: PANEL_ATTACKER_KEY,
  });
  return {
    chain: DEMO_CHAIN,
    request: { kind: "transaction", tx: action.tx },
    policyTemplate: "balanced",
  };
}
