/**
 * The demo agent. For each scenario it builds the transaction, asks Baret first, and
 * signs on Safe, asks its human on Caution (`gate.ts`; `--approve` / `--deny` answer for a
 * recorded run, no terminal means no) and refuses on Blocked or no answer, with a function
 * call key that reaches nothing but the vault.
 * `--force` sends a refused request anyway, to show the second line of defence: the
 * vault (or NEAR's key permissions) refuses it on chain.
 *
 * The Chain Signatures scenarios (evm-*) ask Baret twice: about the NEAR call that asks
 * the vault to sign, and about the EVM transfer itself on its own chain. Both must be
 * Safe. Then the vault's MPC signature is assembled into the EVM transaction and sent.
 *
 *   pnpm --filter @baret/demo-near agent -- pay
 *   pnpm --filter @baret/demo-near agent -- wrong-receiver --force
 *   pnpm --filter @baret/demo-near agent -- evm-pay
 */
import { createInterface } from "node:readline/promises";
import { getChain } from "@baret/chains";
import { Account, actions, JsonRpcProvider, KeyPair, KeyPairSigner, PublicKey } from "near-api-js";
import {
  BARET_API,
  CHAIN,
  EXPLORER,
  agentEnv as env,
  agentEnvOr as envOr,
  RPC_URL,
} from "./agent-env.js";
import {
  EVM_CHAIN,
  EVM_CHAIN_ID,
  evmAccounts,
  type MpcSignature,
  signedTransaction,
  vaultEvmAddress,
} from "./evm.js";
import { gate, humanAnswerSource, isYes } from "./gate.js";
import { buildAction, type EvmBase, SCENARIOS, type ScenarioName } from "./scenarios.js";

const name = process.argv.slice(2).find((a) => !a.startsWith("--")) as ScenarioName | undefined;
const force = process.argv.includes("--force");
if (!name || !(name in SCENARIOS)) {
  console.error(
    `usage: agent <${Object.keys(SCENARIOS).join("|")}> [--force] [--approve | --deny]`,
  );
  process.exit(2);
}
const isEvm = name.startsWith("evm-");

const evmRpcUrl = getChain(EVM_CHAIN)?.publicRpcUrl;
async function evmRpc(method: string, params: unknown[]): Promise<string> {
  if (!evmRpcUrl) throw new Error(`${EVM_CHAIN} has no public RPC in the registry`);
  const res = await fetch(evmRpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (typeof body.result !== "string")
    throw new Error(`${method}: ${body.error?.message ?? res.status}`);
  return body.result;
}

const vaultId = env("NEAR_VAULT_ID");
const evm = isEvm ? evmAccounts() : null;
const evmFrom = isEvm ? await vaultEvmAddress(RPC_URL, vaultId) : null;

/** Nonce and fees of the vault's EVM address, read from the chain now. */
async function evmBase(from: string): Promise<EvmBase> {
  const [nonce, gasPrice, tip] = await Promise.all([
    evmRpc("eth_getTransactionCount", [from, "pending"]),
    evmRpc("eth_gasPrice", []),
    evmRpc("eth_maxPriorityFeePerGas", []),
  ]);
  return {
    chain_id: EVM_CHAIN_ID,
    nonce: Number(BigInt(nonce)),
    max_priority_fee_per_gas: BigInt(tip).toString(),
    max_fee_per_gas: (2n * BigInt(gasPrice)).toString(),
    gas_limit: 21000,
  };
}

const ids = {
  agent: env("NEAR_AGENT_ID"),
  vault: vaultId,
  shop: env("NEAR_SHOP_ID"),
  attacker: envOr("NEAR_ATTACKER_ID", "drain-it-all.testnet"),
  attackerKey: KeyPair.fromRandom("ed25519").getPublicKey().toString(),
  ...(evm ? { evmShop: evm.shop, evmAttacker: evm.attacker } : {}),
};
const action = buildAction(name, ids, evmFrom ? await evmBase(evmFrom) : undefined);

console.log(`\nScenario: ${SCENARIOS[name]}`);
if (evmFrom) console.log(`The vault's EVM address (Chain Signatures, path eip155): ${evmFrom}`);

type Finding = { code: string; blocking: boolean; details?: { reason?: string } };

/** One /v1/analyze call. Fail-closed: no verdict (timeout, error, bad answer) is null. */
async function ask(label: string, body: object): Promise<string | null> {
  console.log(`Asking Baret about ${label} (${BARET_API})...`);
  try {
    const res = await fetch(`${BARET_API}/v1/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const v = (await res.json()) as {
      decision?: string;
      findings?: Finding[];
      error?: { code: string };
    };
    if (!res.ok || !v.decision) {
      console.log(`  Baret did not answer (${res.status} ${v.error?.code ?? ""}).`);
      return null;
    }
    console.log(`  Baret: ${v.decision.toUpperCase()}`);
    for (const f of v.findings ?? []) {
      const why = f.details?.reason ? ` (${f.details.reason})` : "";
      console.log(`    - ${f.code}${why}${f.blocking ? "  [blocks]" : ""}`);
    }
    return v.decision;
  } catch (e) {
    console.log(`  Baret did not answer (${(e as Error).name}).`);
    return null;
  }
}

// The key the agent will sign with goes along, so Baret also checks that the transaction
// stays inside what that function call key may do (E_KEY_NOT_ALLOWED otherwise).
const fcPublicKey = KeyPair.fromString(env("NEAR_AGENT_FC_KEY") as `ed25519:${string}`)
  .getPublicKey()
  .toString();
const verdicts = [
  await ask("the NEAR call", {
    chain: CHAIN,
    request: { kind: "transaction", tx: { ...action.tx, publicKey: fcPublicKey } },
    policyTemplate: "balanced",
  }),
];
if (action.evm && evmFrom) {
  verdicts.push(
    await ask(`the ${EVM_CHAIN} transfer`, {
      chain: EVM_CHAIN,
      request: {
        kind: "call",
        tx: {
          from: evmFrom,
          to: action.evm.to,
          value: action.evm.value,
          gas: String(action.evm.gas_limit),
          maxFeePerGas: action.evm.max_fee_per_gas,
          maxPriorityFeePerGas: action.evm.max_priority_fee_per_gas,
          nonce: action.evm.nonce,
        },
      },
      policyTemplate: "balanced",
    }),
  );
}

/** Caution: the agent stops and asks its human. Only an explicit yes signs. */
async function humanApproves(): Promise<boolean> {
  const source = humanAnswerSource(process.argv, Boolean(process.stdin.isTTY));
  if (source === "nobody") {
    console.log("Caution, and no human to ask (no terminal): not signed.");
    return false;
  }
  if (source !== "ask") {
    console.log(`Caution: asking the human... (recorded answer: ${source})`);
    return source === "approve";
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return isYes(await rl.question("Caution: sign this anyway? [y/N] "));
  } finally {
    rl.close();
  }
}

const decision = gate(verdicts);
let send = decision === "sign";
if (decision === "ask") {
  send = await humanApproves();
  console.log(send ? "The human approved: signing." : "The human did not approve: not signed.");
}
if (!send && !force) {
  if (decision === "refuse") console.log("Not signed: Baret blocked it or gave no answer.");
  process.exit(verdicts.includes(null) ? 1 : 0);
}
if (!send) console.log("--force: sending anyway, to show the chain refuse it.");

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
let out: Awaited<ReturnType<Account["signAndSendTransaction"]>>;
try {
  out = await agent.signAndSendTransaction({
    receiverId: action.tx.receiverId,
    actions: built,
    throwOnFailure: true,
  });
} catch (e) {
  console.log(`Refused on chain: ${(e as Error).message.slice(0, 300)}`);
  process.exit(0);
}
console.log(`Sent on NEAR: ${EXPLORER}/txns/${out.transaction.hash}`);

if (action.evm) {
  const value = (out.status as { SuccessValue?: string }).SuccessValue;
  const sig = value
    ? (JSON.parse(Buffer.from(value, "base64").toString()) as MpcSignature | null)
    : null;
  if (!sig?.big_r) {
    console.log("The MPC network gave no signature; the vault returned the spend to its window.");
    process.exit(1);
  }
  const raw = signedTransaction(action.evm, sig);
  const hash = await evmRpc("eth_sendRawTransaction", [raw]);
  const template = getChain(EVM_CHAIN)?.explorer.tx ?? "{hash}";
  console.log(`Sent on ${EVM_CHAIN}: ${template.replace("{hash}", hash)}`);
}
