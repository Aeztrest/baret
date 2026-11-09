import { describe, expect, it } from "vitest";
import { agentValues } from "./agent-env.js";

describe("the agent's settings", () => {
  it("reads only the allowlisted names, the environment first", () => {
    const v = agentValues(
      { NEAR_AGENT_ID: "a.testnet", NEAR_AGENT_FC_KEY: "ed25519:fc", SOMETHING_ELSE: "x" },
      { NEAR_AGENT_ID: "b.testnet", PATH: "/bin" },
    );
    expect(v).toEqual({ NEAR_AGENT_ID: "b.testnet", NEAR_AGENT_FC_KEY: "ed25519:fc" });
  });

  it("never picks up the owner's key from the environment", () => {
    const v = agentValues({}, { NEAR_OWNER_KEY: "ed25519:owner", NEAR_VAULT_KEY: "ed25519:v" });
    expect(Object.keys(v)).toEqual([]);
  });

  it("refuses to start when a full key sits in its file", () => {
    expect(() => agentValues({ NEAR_OWNER_KEY: "ed25519:owner" }, {})).toThrow(/NEAR_OWNER_KEY/);
    expect(() => agentValues({ NEAR_AGENT_KEY: "ed25519:full" }, {})).toThrow(/NEAR_AGENT_KEY/);
  });
});
