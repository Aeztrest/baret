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
}

const NEAR = 10n ** 24n;
const GAS = "30000000000000";

export function buildAction(
  name: ScenarioName,
  ids: { agent: string; vault: string; shop: string; attacker: string; attackerKey: string },
): AgentAction {
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
  }
}
