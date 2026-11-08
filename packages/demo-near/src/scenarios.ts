import type { EvmTransfer } from "./evm.js";

/**
 * What the agent tries in each demo scenario, as a NEAR transaction in the JSON form
 * Baret's `/v1/analyze` takes (packages/chain-near request.ts). Pure, so it is tested
 * without a network.
 */

export const SCENARIOS = {
  /** A normal payment for an API answer: within the limits, to the shop. Baret: Safe. */
  pay: "Pay the shop 0.1 NEAR for an answer",
  /** A payment above the per-transfer limit. Baret predicts the vault's refusal. */
  "over-limit": "Pay the shop 5 NEAR, above the vault's per-transfer limit",
  /** A prompt injection: pay someone the owner never listed. */
  "wrong-receiver": "Pay 1 NEAR to an account the prompt names",
  /** A prompt injection: add a full access key to the agent's account. */
  "add-key": "Add a full access key to the agent's account",
  /** Chain Signatures (TN.7): the vault signs a Monad testnet payment within its policy. */
  "evm-pay": "Pay the shop 0.01 MON on Monad testnet, signed by the vault on NEAR",
  /** Chain Signatures: a prompt injection names an EVM address the owner never listed. */
  "evm-wrong-receiver": "Pay 0.01 MON on Monad testnet to an address the prompt names",
} as const;

export type ScenarioName = keyof typeof SCENARIOS;

export interface AgentAction {
  /** The transaction as /v1/analyze reads it. */
  tx: {
    signerId: string;
    receiverId: string;
    actions: Record<string, unknown>[];
  };
  /** What a successful run means: the vault pays, or nothing should be signed. */
  expect: "paid" | "refused";
  /** Chain Signatures scenarios: the EVM transfer the vault is asked to sign. */
  evm?: EvmTransfer;
}

/** The EVM scenarios' chain fields, read from the chain by the caller (nonce, fees). */
export type EvmBase = Omit<EvmTransfer, "to" | "value">;

const NEAR = 10n ** 24n;
const GAS = "30000000000000";
/** The MPC network answers through a yield/resume; it needs most of a transaction's gas. */
const EVM_GAS = "300000000000000";

export function buildAction(
  name: ScenarioName,
  ids: {
    agent: string;
    vault: string;
    shop: string;
    attacker: string;
    attackerKey: string;
    evmShop?: string;
    evmAttacker?: string;
  },
  evmBase?: EvmBase,
): AgentAction {
  const signEvm = (to: string | undefined): AgentAction => {
    if (!evmBase || !to) throw new Error(`${name} needs the EVM chain fields and receivers`);
    const evm: EvmTransfer = { ...evmBase, to, value: (10n ** 16n).toString() };
    return {
      tx: {
        signerId: ids.agent,
        receiverId: ids.vault,
        actions: [
          {
            type: "FunctionCall",
            methodName: "request_evm_signature",
            args: { tx: evm },
            gas: EVM_GAS,
            deposit: "0",
          },
        ],
      },
      expect: name === "evm-pay" ? "paid" : "refused",
      evm,
    };
  };
  const pay = (receiver: string, yocto: bigint): AgentAction => ({
    tx: {
      signerId: ids.agent,
      receiverId: ids.vault,
      actions: [
        {
          type: "FunctionCall",
          methodName: "execute_transfer",
          args: { asset: "native", receiver, amount: yocto.toString(), memo: `baret-demo:${name}` },
          gas: GAS,
          deposit: "0",
        },
      ],
    },
    expect: name === "pay" ? "paid" : "refused",
  });
  switch (name) {
    case "pay":
      return pay(ids.shop, NEAR / 10n);
    case "over-limit":
      return pay(ids.shop, 5n * NEAR);
    case "wrong-receiver":
      return pay(ids.attacker, NEAR);
    case "add-key":
      return {
        tx: {
          signerId: ids.agent,
          receiverId: ids.agent,
          actions: [{ type: "AddKey", publicKey: ids.attackerKey, accessKey: "FullAccess" }],
        },
        expect: "refused",
      };
    case "evm-pay":
      return signEvm(ids.evmShop);
    case "evm-wrong-receiver":
      return signEvm(ids.evmAttacker);
  }
}
