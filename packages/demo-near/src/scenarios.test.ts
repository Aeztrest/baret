import { describe, expect, it } from "vitest";
import { buildAction, SCENARIOS, type ScenarioName } from "./scenarios.js";

const ids = {
  agent: "baret-agent.owner.testnet",
  vault: "baret-vault.owner.testnet",
  shop: "baret-shop.owner.testnet",
  attacker: "drain-it-all.testnet",
  attackerKey: "ed25519:11111111111111111111111111111111",
};

describe("demo scenarios", () => {
  it("pays through the vault in every payment scenario, signed by the agent", () => {
    for (const name of ["pay", "over-limit", "wrong-receiver"] as ScenarioName[]) {
      const { tx } = buildAction(name, ids);
      expect(tx.signerId).toBe(ids.agent);
      expect(tx.receiverId).toBe(ids.vault);
      expect(tx.actions[0]).toMatchObject({
        type: "FunctionCall",
        methodName: "execute_transfer",
        deposit: "0",
      });
    }
  });

  it("expects only the normal payment to go through", () => {
    const expected = Object.fromEntries(
      (Object.keys(SCENARIOS) as ScenarioName[]).map((n) => [n, buildAction(n, ids).expect]),
    );
    expect(expected).toEqual({
      pay: "paid",
      "over-limit": "refused",
      "wrong-receiver": "refused",
      "add-key": "refused",
    });
  });

  it("makes the injection add a full access key to the agent's own account", () => {
    const { tx } = buildAction("add-key", ids);
    expect(tx).toEqual({
      signerId: ids.agent,
      receiverId: ids.agent,
      actions: [{ type: "AddKey", publicKey: ids.attackerKey, accessKey: "FullAccess" }],
    });
  });
});
