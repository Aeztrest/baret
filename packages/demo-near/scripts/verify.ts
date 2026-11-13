/**
 * `pnpm near:verify`: checks the NEAR claims of the README against the live system, with
 * no key, no account and no .env file. For judges and reviewers (docs/hackathon/near-2026.md).
 *
 *   1. Reads the demo vault on NEAR testnet: version, policy, and that its account holds
 *      no access key (nobody can redeploy it around the rules).
 *   2. Sends the agent's requests to Baret's API (staging by default, BARET_API_URL to
 *      change it) and compares each verdict with what the README says.
 *   3. NEAR Intents on mainnet: asks 1Click for real quotes (no funds move) and checks
 *      an honest, a hostile and a forged one.
 *
 * Nothing is signed or sent to a chain. Exit code 0 when every check passes.
 */

import { evmAccounts } from "../src/evm.js";
import { depositFor, forge, getQuote, type IntentsQuote } from "../src/intents.js";
import { buildAction, type ScenarioName } from "../src/scenarios.js";
import { demoAccounts, demoAnalyzeBody, demoRpcUrl, formatNear, readVault } from "../src/view.js";

const API = process.env.BARET_API_URL ?? "https://baret-api-staging.onrender.com";
const a = demoAccounts();
const results: { check: string; ok: boolean; got: string }[] = [];
const record = (check: string, ok: boolean, got: string) => {
  results.push({ check, ok, got });
  console.log(`${ok ? "PASS" : "FAIL"}  ${check}\n      ${got}`);
};

interface Verdict {
  decision?: string;
  findings?: { code: string; details?: { reason?: string } }[];
  sources?: { name: string; status: string }[];
}

async function analyze(body: object): Promise<Verdict | null> {
  // The free staging instance sleeps when idle: the first call can take a minute.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${API}/v1/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
      const v = (await res.json()) as Verdict;
      if (v.decision) return v;
    } catch {
      // retried once
    }
  }
  return null;
}

const summary = (v: Verdict | null) =>
  v
    ? `${v.decision} ${(v.findings ?? []).map((f) => f.code + (f.details?.reason ? `(${f.details.reason})` : "")).join(", ")}`
    : "no answer";

async function expectVerdict(
  check: string,
  body: object,
  decision: string,
  code?: string,
  reason?: string,
): Promise<void> {
  const v = await analyze(body);
  const ok =
    v?.decision === decision &&
    (!code ||
      (v.findings ?? []).some((f) => f.code === code && (!reason || f.details?.reason === reason)));
  record(check, ok, summary(v));
}

const near = (tx: object) => ({
  chain: "near:testnet",
  request: { kind: "transaction", tx },
  policyTemplate: "balanced",
});

console.log(`Baret NEAR verification\nvault ${a.vault}\nAPI   ${API}\n`);

// ---------------------------------------------------------------- 1. the vault on chain
const vault = await readVault(a.vault);
record(
  "The vault's account holds no access key (code changes only through the owner's update_contract)",
  vault.accessKeys === 0,
  `${vault.accessKeys} key(s); contract ${vault.version ?? "0.1.0"}`,
);
const native = vault.limits.find((l) => l.asset === "native");
record(
  "The policy is on chain: NEAR limits and receivers per asset",
  Boolean(native) && vault.receivers.includes(a.shop),
  native
    ? `NEAR: ${formatNear(native.perTransfer)} per transfer, ${formatNear(native.perDay)} per day, spent today ${formatNear(vault.spentToday)}, receivers ${vault.receivers.join(", ")}`
    : "no NEAR limit",
);

// ---------------------------------------------------------------- 2. Baret before signing
const scenario = (n: ScenarioName) => demoAnalyzeBody(n);
await expectVerdict("A normal 0.1 NEAR payment to the shop is Safe", scenario("pay"), "safe");
await expectVerdict(
  "5 NEAR (over the per-transfer limit): Baret predicts the vault's refusal",
  scenario("over-limit"),
  "blocked",
  "SIMULATION_FAILED",
  "E_PER_TRANSFER_LIMIT",
);
await expectVerdict(
  "A receiver a prompt named: Baret predicts the vault's refusal",
  scenario("wrong-receiver"),
  "blocked",
  "SIMULATION_FAILED",
  "E_RECEIVER_NOT_ALLOWED",
);
await expectVerdict(
  "A prompt asks for a full access key: blocked as a change of control",
  scenario("add-key"),
  "blocked",
  "AUTHORITY_CHANGE",
);

// Several payments in one transaction draw on one window.
if (native) {
  const per = native.perTransfer;
  const room = vault.nextTransferMax > 0n ? native.perDay - vault.spentToday : 0n;
  const calls = Number(room / per) + 1;
  const call = {
    type: "FunctionCall",
    methodName: "execute_transfer",
    args: { asset: "native", receiver: a.shop, amount: per.toString() },
    gas: "30000000000000",
    deposit: "0",
  };
  await expectVerdict(
    `${calls} payments of ${formatNear(per)} NEAR in one transaction (more than is left today): refused`,
    near({ signerId: a.agent, receiverId: a.vault, actions: Array(calls).fill(call) }),
    "blocked",
    "SIMULATION_FAILED",
    "E_DAILY_LIMIT",
  );
}

// The EVM shop is listed for Monad only: paying it NEAR is refused (receivers per asset).
const evm = evmAccounts();
await expectVerdict(
  "The vault's EVM receiver cannot be paid in NEAR",
  near({
    signerId: a.agent,
    receiverId: a.vault,
    actions: [
      {
        type: "FunctionCall",
        methodName: "execute_transfer",
        args: { asset: "native", receiver: evm.shop.toLowerCase(), amount: "1" },
        gas: "30000000000000",
        deposit: "0",
      },
    ],
  }),
  "blocked",
  "SIMULATION_FAILED",
  "E_RECEIVER_NOT_ALLOWED",
);

// The vault's own rules can be changed only by its owner, and loosening them is never Safe.
const addReceiver = (signerId: string) =>
  near({
    signerId,
    receiverId: a.vault,
    actions: [
      {
        type: "FunctionCall",
        methodName: "add_receiver",
        args: { asset: "native", receiver: "drain-it-all.testnet" },
        gas: "30000000000000",
        deposit: "0",
      },
    ],
  });
await expectVerdict(
  "The agent tries to add a receiver to its own vault: Baret predicts the vault's refusal",
  addReceiver(a.agent),
  "blocked",
  "SIMULATION_FAILED",
  "E_NOT_OWNER",
);
await expectVerdict(
  "The owner (or an owner agent a prompt steered) adds a receiver: named, never Safe",
  addReceiver(a.owner),
  "caution",
  "VAULT_RECEIVER_ADDED",
);
await expectVerdict(
  "A payment above the signer's balance is refused with a reason, not an error",
  near({
    signerId: a.agent,
    receiverId: a.shop,
    actions: [{ type: "Transfer", deposit: (10n ** 30n).toString() }],
  }),
  "blocked",
  "SIMULATION_FAILED",
  "E_INSUFFICIENT_NEAR",
);

// Counterparties (TN.14): who the money goes to, read from FastNEAR's transaction index.
{
  const v = await analyze(scenario("pay"));
  const read = v?.sources?.some((x) => x.name === "near-history" && x.status === "ok");
  const codes = (v?.findings ?? []).map((f) => f.code);
  record(
    "The shop the agent has paid before: its history was read, nothing new about it",
    v?.decision === "safe" && Boolean(read) && !codes.includes("COUNTERPARTY_FIRST_PAYMENT"),
    `${summary(v)}; near-history ${v?.sources?.find((x) => x.name === "near-history")?.status ?? "absent"}`,
  );
}
{
  // An implicit account made up now: nobody has ever used it.
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const v = await analyze(
    near({
      signerId: a.owner,
      receiverId: fresh,
      actions: [{ type: "Transfer", deposit: (10n ** 23n).toString() }],
    }),
  );
  const codes = (v?.findings ?? []).map((f) => f.code);
  record(
    "Paying an account nobody has used: Caution (fresh, first contact), so the agent asks its human",
    v?.decision === "caution" &&
      codes.includes("REPUTATION_FRESH_ACCOUNT") &&
      codes.includes("COUNTERPARTY_FIRST_PAYMENT"),
    summary(v),
  );
}

if (a.newShop) {
  const v = await analyze(scenario("new-receiver"));
  const codes = (v?.findings ?? []).map((f) => f.code);
  record(
    "The agent pays a shop the owner listed but it never paid: Caution, so it asks its human",
    v?.decision === "caution" && codes.includes("COUNTERPARTY_FIRST_PAYMENT"),
    summary(v),
  );
}

// The agent's real function call key (public, read from chain) cannot add keys.
interface KeyList {
  result?: { keys?: { public_key: string; access_key: { permission: unknown } }[] };
}
/** The agent's keys from NEAR; a public RPC that rate limits gets a second, later try. */
async function agentKeys(): Promise<KeyList> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(demoRpcUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "query",
          params: { request_type: "view_access_key_list", finality: "final", account_id: a.agent },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const v = (await res.json()) as KeyList;
      if (res.ok && v.result?.keys) return v;
    } catch {
      // tried again below
    }
  }
  return {};
}
const keys = await agentKeys();
const fcKey = keys.result?.keys?.find((k) => k.access_key.permission !== "FullAccess");
if (fcKey) {
  const addKey = scenario("add-key").request.tx;
  await expectVerdict(
    "Signed with the agent's function call key, an AddKey is refused by NEAR itself",
    near({ ...addKey, publicKey: fcKey.public_key }),
    "blocked",
    "SIMULATION_FAILED",
    "E_KEY_NOT_ALLOWED",
  );
} else if (!keys.result?.keys) {
  // An RPC that rate limits or fails is not evidence that the key is missing.
  record("The agent holds a function call key", false, "could not read its keys (RPC error)");
} else {
  record("The agent holds a function call key", false, "none found on chain");
}

// Chain Signatures: the vault signs a Monad payment only within its policy.
const evmBase = {
  chain_id: 10143,
  nonce: 0,
  max_priority_fee_per_gas: "2000000000",
  max_fee_per_gas: "100000000000",
  gas_limit: 21000,
};
const ids = {
  agent: a.agent,
  vault: a.vault,
  shop: a.shop,
  attacker: "drain-it-all.testnet",
  attackerKey: "ed25519:11111111111111111111111111111111",
  evmShop: evm.shop,
  evmAttacker: evm.attacker,
};
await expectVerdict(
  "Chain Signatures: 0.01 MON to the EVM shop, signed by the vault, is Safe on the NEAR side",
  near(buildAction("evm-pay", ids, evmBase).tx),
  "safe",
);
await expectVerdict(
  "Chain Signatures: an EVM address a prompt named is refused",
  near(buildAction("evm-wrong-receiver", ids, evmBase).tx),
  "blocked",
  "SIMULATION_FAILED",
  "E_RECEIVER_NOT_ALLOWED",
);

// NEAR Intents (mainnet, nothing signed): real 1Click quotes, the agent being `aurora`.
const AGENT_MAINNET = "aurora";
const OTHER = "relay.near";
const [mine, theirs] = await Promise.all([getQuote(AGENT_MAINNET), getQuote(OTHER)]);
if (!mine || !theirs) {
  record("NEAR Intents: 1Click gives a quote", false, "1Click did not answer");
} else {
  const swap = (q: IntentsQuote) => ({
    chain: "near:mainnet",
    request: { kind: "transaction", tx: depositFor(AGENT_MAINNET, q), intents: q },
    policyTemplate: "balanced",
  });
  await expectVerdict(
    "NEAR Intents: the agent's own quote passes, with 1Click's app fee shown",
    swap(mine),
    "caution",
    "INTENTS_APP_FEE",
  );
  await expectVerdict(
    `NEAR Intents: a real quote paying ${OTHER} is blocked`,
    swap(theirs),
    "blocked",
    "INTENTS_RECIPIENT_MISMATCH",
  );
  await expectVerdict(
    "NEAR Intents: a forged quote (agent as recipient, another quote's deposit address) is blocked",
    swap(forge(mine, theirs)),
    "blocked",
    "INTENTS_QUOTE_UNVERIFIED",
  );
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
