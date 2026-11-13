/**
 * Reads the demo vault's state for the web panel (/near, TN.9): JSON-RPC over plain
 * fetch, no near-api-js, so it runs in a browser bundle without a chain library.
 * Every read is a view call or view_account; nothing here signs.
 */
import { getChain, getDeployment, getShowcase } from "@baret/chains";
import { type AgentAction, buildAction, type ScenarioName } from "./scenarios.js";

export const DEMO_CHAIN = "near:testnet" as const;

/** The demo accounts, from the registry (packages/chains/deployments/near-testnet.json). */
export function demoAccounts(): {
  vault: string;
  shop: string;
  newShop: string | undefined;
  agent: string;
  owner: string;
} {
  const vault = getDeployment(DEMO_CHAIN, "BaretVault")?.address;
  const shop = getShowcase(DEMO_CHAIN).DemoShop?.address;
  const agent = getShowcase(DEMO_CHAIN).DemoAgent?.address;
  if (!vault || !shop || !agent)
    throw new Error("near:testnet demo accounts missing from registry");
  const newShop = getShowcase(DEMO_CHAIN).DemoNewShop?.address;
  return { vault, shop, newShop, agent, owner: vault.slice(vault.indexOf(".") + 1) };
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
  /** Who the vault may pay in NEAR. */
  receivers: string[];
  /** Who each asset may pay (vault 0.2 lists them per asset; 0.1 had one shared list). */
  receiversByAsset: { asset: string; receivers: string[] }[];
  limits: VaultLimit[];
  /** The contract's `get_version`; null for 0.1, which has no such view. */
  version: string | null;
  /**
   * Access keys on the vault's own account. 0: nobody can replace its code except the
   * owner through `update_contract`; more: whoever holds one can.
   */
  accessKeys: number;
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
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
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
  /** 0.2: `[asset, [receiver…]]`; 0.1: one list of account ids for every asset. */
  receivers: ([string, string[]] | string)[];
  limits: [string, { per_transfer: string; per_day: string }][];
}

/** Both vault versions as per-asset lists (0.1's shared list applies to every asset). */
function perAsset(p: PolicyView): { asset: string; receivers: string[] }[] {
  const shared = p.receivers.filter((r): r is string => typeof r === "string");
  if (shared.length > 0) return p.limits.map(([asset]) => ({ asset, receivers: shared }));
  return p.receivers
    .filter((r): r is [string, string[]] => Array.isArray(r))
    .map(([asset, receivers]) => ({ asset, receivers }));
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
  const [policy, spent, remaining, account, keys, version] = await Promise.all([
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
    rpc(
      url,
      "query",
      { request_type: "view_access_key_list", block_id: block, account_id: vault },
      f,
    ) as Promise<{ keys?: unknown[] }>,
    // 0.1 has no get_version: its absence is an answer, not a failure.
    (view(url, block, vault, "get_version", {}, f) as Promise<string>).catch(() => null),
  ]);
  const byAsset = perAsset(policy);
  return {
    owner: policy.owner,
    paused: policy.paused,
    agents: policy.agents,
    receivers: byAsset.find((r) => r.asset === "native")?.receivers ?? [],
    receiversByAsset: byAsset,
    version: typeof version === "string" ? version : null,
    accessKeys: Array.isArray(keys.keys) ? keys.keys.length : 0,
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
    ...(a.newShop ? { newShop: a.newShop } : {}),
    attacker: "drain-it-all.testnet",
    attackerKey: PANEL_ATTACKER_KEY,
  });
  return {
    chain: DEMO_CHAIN,
    request: { kind: "transaction", tx: action.tx },
    policyTemplate: "balanced",
  };
}
