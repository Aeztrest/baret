/**
 * The demo agent. For each scenario it builds the transaction, asks Baret first, and
 * signs only on Safe, with a function call key that reaches nothing but the vault's
 * `execute_transfer`. `--force` sends a refused request anyway, to show the second line
 * of defence: the vault (or NEAR's key permissions) refuses it on chain.
 *
 *   pnpm --filter @baret/demo-near agent -- pay
 *   pnpm --filter @baret/demo-near agent -- wrong-receiver --force
 */
import { Account, actions, JsonRpcProvider, KeyPair, KeyPairSigner, PublicKey } from "near-api-js";
import { BARET_API, CHAIN, EXPLORER, env, envOr, RPC_URL } from "./env.js";
import { buildAction, SCENARIOS, type ScenarioName } from "./scenarios.js";

const name = process.argv.slice(2).find((a) => !a.startsWith("--")) as ScenarioName | undefined;
const force = process.argv.includes("--force");
if (!name || !(name in SCENARIOS)) {
  console.error(`usage: agent <${Object.keys(SCENARIOS).join("|")}> [--force]`);
  process.exit(2);
}

const ids = {
  agent: env("NEAR_AGENT_ID"),
  vault: env("NEAR_VAULT_ID"),
  shop: env("NEAR_SHOP_ID"),
  attacker: envOr("NEAR_ATTACKER_ID", "drain-it-all.testnet"),
  attackerKey: KeyPair.fromRandom("ed25519").getPublicKey().toString(),
};
const action = buildAction(name, ids);

console.log(`\nScenario: ${SCENARIOS[name]}`);
console.log(`Asking Baret (${BARET_API}) before signing...`);

const res = await fetch(`${BARET_API}/v1/analyze`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    chain: CHAIN,
    request: { kind: "transaction", tx: action.tx },
    policyTemplate: "balanced",
  }),
  signal: AbortSignal.timeout(60_000),
});
const verdict = (await res.json()) as {
  decision?: string;
  findings?: { code: string; blocking: boolean; details?: { reason?: string } }[];
  error?: { code: string; message: string };
};
if (!res.ok || !verdict.decision) {
  // Fail-closed: no verdict, no signature.
  console.log(`Baret did not answer (${res.status} ${verdict.error?.code ?? ""}). Not signing.`);
  process.exit(1);
}
console.log(`Baret: ${verdict.decision.toUpperCase()}`);
for (const f of verdict.findings ?? []) {
  const why = f.details?.reason ? ` (${f.details.reason})` : "";
  console.log(`  - ${f.code}${why}${f.blocking ? "  [blocks]" : ""}`);
}

if (verdict.decision !== "safe" && !force) {
  console.log("Not signed: the agent signs only what Baret calls Safe.");
  process.exit(0);
}
if (verdict.decision !== "safe")
  console.log("--force: sending anyway, to show the chain refuse it.");

const provider = new JsonRpcProvider({ url: RPC_URL });
const signer = KeyPairSigner.fromSecretKey(env("NEAR_AGENT_FC_KEY") as `ed25519:${string}`);
const agent = new Account(ids.agent, provider, signer);
const built = action.tx.actions.map((a) =>
  a.type === "AddKey"
    ? actions.addFullAccessKey(PublicKey.from(String(a.publicKey)))
    : actions.functionCall(
        String(a.methodName),
        a.args as object,
        BigInt(String(a.gas)),
        BigInt(String(a.deposit)),
      ),
);
try {
  const out = await agent.signAndSendTransaction({
    receiverId: action.tx.receiverId,
    actions: built,
    throwOnFailure: true,
  });
  const hash = out.transaction.hash;
  console.log(`Sent: ${EXPLORER}/txns/${hash}`);
} catch (e) {
  console.log(`Refused on chain: ${(e as Error).message.slice(0, 300)}`);
}
