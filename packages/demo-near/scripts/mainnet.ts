/**
 * The NEAR mainnet demo (ADR-0014), one step at a time, with real NEAR. Every other
 * setup script stops before a mainnet run; this one runs only on mainnet and only with
 * `--yes`. Keys come from .env.near (gitignored): NEAR_MAINNET_OWNER_KEY (the owner, also
 * the implicit account that funded it) and NEAR_MAINNET_AGENT_FC_KEY (written by `keys`).
 *
 *   pnpm mainnet keys                       the agent's function call key, into .env.near
 *   pnpm mainnet owner --yes                the funded implicit account creates baret.near
 *   pnpm mainnet contracts <vault.wasm> <blocklist.wasm> --yes
 *                                           vault and blocklist: created, deployed and
 *                                           initialised in one transaction each, so their
 *                                           accounts never hold a key; agent and shops
 *   pnpm mainnet policy --yes               tiny limits, the two shops, the agent
 *   pnpm mainnet report <tx hash> --yes     the owner reports and confirms the demo
 *                                           attacker account, with the refused payment
 *
 * The wasm files are the published builds (release near-vault-v0.2.1, the blocklist's
 * main CI build); `pnpm verify-vault` compares their hash with what is deployed.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { Account, actions, JsonRpcProvider, KeyPair, KeyPairSigner } from "near-api-js";
import { ENV_FILE, env, envOr } from "../src/env.js";

const RPC = envOr("NEAR_MAINNET_RPC_URL", "https://free.rpc.fastnear.com");
const EXPLORER = "https://nearblocks.io/txns";
const NEAR = 10n ** 24n;
const MILLI = NEAR / 1000n;
const GAS = 30_000_000_000_000n;

export const MAINNET = {
  owner: "baret.near",
  vault: "vault.baret.near",
  blocklist: "blocklist.baret.near",
  agent: "agent.baret.near",
  shop: "shop.baret.near",
  newShop: "newshop.baret.near",
  /** Never created: only baret.near could, so no stranger can own the name. */
  attacker: "drain-it-all.baret.near",
  /** Tiny on purpose: the contracts are not audited. */
  perTransfer: 50n * MILLI,
  perDay: 200n * MILLI,
} as const;

const [step, ...rest] = process.argv.slice(2);
const yes = rest.includes("--yes");
const provider = new JsonRpcProvider({ url: RPC });

function signer(): KeyPairSigner {
  return KeyPairSigner.fromSecretKey(env("NEAR_MAINNET_OWNER_KEY") as `ed25519:${string}`);
}
const ownerKey = () =>
  KeyPair.fromString(env("NEAR_MAINNET_OWNER_KEY") as `ed25519:${string}`).getPublicKey();

function needYes(plan: string): void {
  console.log(plan);
  if (!yes) {
    console.log("Dry run: add --yes to send it (real NEAR).");
    process.exit(0);
  }
}

async function balance(id: string): Promise<bigint> {
  const a = await provider.viewAccount({ accountId: id });
  return BigInt(a.amount);
}

const fmt = (y: bigint) => `${Number(y / MILLI) / 1000} NEAR`;
const link = (h: string) => `${EXPLORER}/${h}`;

if (step === "keys") {
  const text = readFileSync(ENV_FILE, "utf8");
  if (/^NEAR_MAINNET_AGENT_FC_KEY=/m.test(text)) {
    console.log("NEAR_MAINNET_AGENT_FC_KEY is already in .env.near");
  } else {
    const kp = KeyPair.fromRandom("ed25519");
    appendFileSync(ENV_FILE, `NEAR_MAINNET_AGENT_FC_KEY=${kp.toString()}\n`);
    console.log(`Agent function call key ${kp.getPublicKey().toString()} written to .env.near`);
  }
} else if (step === "owner") {
  const implicit = env("NEAR_MAINNET_OWNER_IMPLICIT");
  const have = await balance(implicit);
  // Prepaid gas is reserved at the gas price before it is refunded: keep 0.15 NEAR back.
  const send = have - 150n * MILLI;
  needYes(
    `${implicit} (${fmt(have)}) creates ${MAINNET.owner} with ${fmt(send)} through the near registrar.`,
  );
  const out = await new Account(implicit, provider, signer()).signAndSendTransaction({
    receiverId: "near",
    actions: [
      actions.functionCall(
        "create_account",
        { new_account_id: MAINNET.owner, new_public_key: ownerKey().toString() },
        100_000_000_000_000n,
        send,
      ),
    ],
    throwOnFailure: true,
  });
  console.log(`${MAINNET.owner} created: ${link(out.transaction.hash)}`);
} else if (step === "contracts") {
  const [vaultWasm, blocklistWasm] = rest.filter((a) => a.endsWith(".wasm"));
  if (!vaultWasm || !blocklistWasm) {
    console.error("usage: mainnet contracts <vault.wasm> <blocklist.wasm> --yes");
    process.exit(2);
  }
  const vaultCode = readFileSync(vaultWasm);
  const blocklistCode = readFileSync(blocklistWasm);
  // Storage is 10^19 yoctoNEAR a byte: the code, 5 % for state, plus what the vault pays out.
  const store = (n: number) => (BigInt(n) * 10n ** 19n * 105n) / 100n;
  const vaultFunds = store(vaultCode.length) + 550n * MILLI;
  const blocklistFunds = store(blocklistCode.length) + 50n * MILLI;
  const agentFc = KeyPair.fromString(
    env("NEAR_MAINNET_AGENT_FC_KEY") as `ed25519:${string}`,
  ).getPublicKey();
  needYes(
    [
      `From ${MAINNET.owner} (${fmt(await balance(MAINNET.owner))}):`,
      `  ${MAINNET.vault}: ${fmt(vaultFunds)}, vault code (${vaultCode.length} B), new(owner), no key`,
      `  ${MAINNET.blocklist}: ${fmt(blocklistFunds)}, blocklist code (${blocklistCode.length} B), new(owner, 2), no key`,
      `  ${MAINNET.agent}: 0.15 NEAR, the owner's full access key, a function call key for the vault's two agent methods`,
      `  ${MAINNET.shop}, ${MAINNET.newShop}: 0.02 NEAR each, the owner's key`,
    ].join("\n"),
  );
  const owner = new Account(MAINNET.owner, provider, signer());
  const send = async (receiverId: string, list: ReturnType<typeof actions.transfer>[]) => {
    const out = await owner.signAndSendTransaction({
      receiverId,
      actions: list,
      throwOnFailure: true,
    });
    console.log(`${receiverId}: ${link(out.transaction.hash)}`);
  };
  await send(MAINNET.vault, [
    actions.createAccount(),
    actions.transfer(vaultFunds),
    actions.deployContract(vaultCode),
    actions.functionCall("new", { owner: MAINNET.owner }, GAS, 0n),
  ]);
  await send(MAINNET.blocklist, [
    actions.createAccount(),
    actions.transfer(blocklistFunds),
    actions.deployContract(blocklistCode),
    actions.functionCall("new", { owner: MAINNET.owner, threshold: 2 }, GAS, 0n),
  ]);
  await send(MAINNET.agent, [
    actions.createAccount(),
    actions.transfer(150n * MILLI),
    actions.addFullAccessKey(ownerKey()),
    actions.addFunctionCallAccessKey(
      agentFc,
      MAINNET.vault,
      ["execute_transfer", "request_evm_signature"],
      100n * MILLI,
    ),
  ]);
  for (const shop of [MAINNET.shop, MAINNET.newShop]) {
    await send(shop, [
      actions.createAccount(),
      actions.transfer(20n * MILLI),
      actions.addFullAccessKey(ownerKey()),
    ]);
  }
} else if (step === "policy") {
  needYes(
    `${MAINNET.owner} sets ${MAINNET.vault}: ${fmt(MAINNET.perTransfer)} a payment, ${fmt(MAINNET.perDay)} a day; receivers ${MAINNET.shop}, ${MAINNET.newShop}; agent ${MAINNET.agent}`,
  );
  const out = await new Account(MAINNET.owner, provider, signer()).signAndSendTransaction({
    receiverId: MAINNET.vault,
    actions: [
      actions.functionCall(
        "set_limit",
        {
          asset: "native",
          per_transfer: MAINNET.perTransfer.toString(),
          per_day: MAINNET.perDay.toString(),
        },
        GAS,
        0n,
      ),
      actions.functionCall("add_receiver", { asset: "native", receiver: MAINNET.shop }, GAS, 0n),
      actions.functionCall("add_receiver", { asset: "native", receiver: MAINNET.newShop }, GAS, 0n),
      actions.functionCall("add_agent", { agent: MAINNET.agent }, GAS, 0n),
    ],
    throwOnFailure: true,
  });
  console.log(`Policy set: ${link(out.transaction.hash)}`);
} else if (step === "report") {
  const evidence = rest.find((a) => !a.startsWith("--"));
  if (!evidence) {
    console.error("usage: mainnet report <tx hash of the refused payment> --yes");
    process.exit(2);
  }
  needYes(
    `${MAINNET.owner} reports ${MAINNET.attacker} (PROMPT_INJECTION_PAYEE, ${evidence}) and confirms it.`,
  );
  const out = await new Account(MAINNET.owner, provider, signer()).signAndSendTransaction({
    receiverId: MAINNET.blocklist,
    actions: [
      actions.functionCall(
        "report",
        { account: MAINNET.attacker, reason: "PROMPT_INJECTION_PAYEE", evidence },
        GAS,
        10n * MILLI,
      ),
      actions.functionCall("confirm", { account: MAINNET.attacker }, GAS, 0n),
    ],
    throwOnFailure: true,
  });
  console.log(`Reported and confirmed: ${link(out.transaction.hash)}`);
} else {
  console.error(
    "usage: mainnet keys | owner | contracts <vault.wasm> <blocklist.wasm> | policy | report <tx> [--yes]",
  );
  process.exit(2);
}
