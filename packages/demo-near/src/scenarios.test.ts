import { describe, expect, it } from "vitest";
import { buildAction, SCENARIOS, type ScenarioName } from "./scenarios.js";

const ids = {
  agent: "baret-agent.owner.testnet",
  vault: "baret-vault.owner.testnet",
  shop: "baret-shop.owner.testnet",
  attacker: "drain-it-all.testnet",
  attackerKey: "ed25519:11111111111111111111111111111111",
  evmShop: "0x1365566191bAA9872A64AcDce963751d5343ff49",
  evmAttacker: "0xac9517a70c88480c9fA7E9a280DA485F7f552C29",
};

const evmBase = {
  chain_id: 10143,
  nonce: 3,
  max_priority_fee_per_gas: "2000000000",
  max_fee_per_gas: "204000000000",
  gas_limit: 21000,
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
      (Object.keys(SCENARIOS) as ScenarioName[]).map((n) => [
        n,
        buildAction(n, ids, evmBase).expect,
      ]),
    );
    expect(expected).toEqual({
      pay: "paid",
      "over-limit": "refused",
      "wrong-receiver": "refused",
      "add-key": "refused",
      "evm-pay": "paid",
      "evm-wrong-receiver": "refused",
    });
  });

  it("asks the vault to sign an EVM transfer it can check, never a bare hash", () => {
    const a = buildAction("evm-pay", ids, evmBase);
    expect(a.tx.receiverId).toBe(ids.vault);
    expect(a.tx.actions[0]).toMatchObject({
      methodName: "request_evm_signature",
      args: { tx: { ...evmBase, to: ids.evmShop, value: "10000000000000000" } },
    });
    expect(() => buildAction("evm-pay", ids)).toThrow();
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
