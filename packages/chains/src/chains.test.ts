import { createPolicy, guardPolicySchema, parseCaip19 } from "@baret/core";
import { describe, expect, it } from "vitest";
import {
  CHAINS,
  chainEnvName,
  enabledChains,
  getChain,
  getDeployment,
  getDeployments,
  getShowcase,
  knownAddresses,
  policyContext,
} from "./index.js";

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

describe("chain registry", () => {
  it("has unique ids and env slugs", () => {
    expect(new Set(CHAINS.map((c) => c.id)).size).toBe(CHAINS.length);
    expect(new Set(CHAINS.map((c) => c.envSlug)).size).toBe(CHAINS.length);
  });

  it("every asset id belongs to its own chain", () => {
    for (const c of CHAINS) {
      expect(parseCaip19(c.nativeAsset.id)?.chain).toBe(c.id);
      if (c.usdc) expect(parseCaip19(c.usdc.id)?.chain).toBe(c.id);
    }
  });

  it("finds Monad testnet and refuses an unknown chain", () => {
    expect(getChain("eip155:10143")?.name).toBe("Monad testnet");
    expect(getChain("eip155:1")).toBeNull();
  });

  it("enables a chain only when its RPC URL is set", () => {
    expect(enabledChains({})).toEqual([]);
    expect(enabledChains({ CHAIN_MONAD_TESTNET_RPC_URL: "  " })).toEqual([]);
    expect(
      enabledChains({ CHAIN_MONAD_TESTNET_RPC_URL: "https://rpc.example" }).map((c) => c.id),
    ).toEqual(["eip155:10143"]);
  });

  it("names chain variables from the slug", () => {
    const testnet = getChain("eip155:10143");
    expect(testnet && chainEnvName(testnet, "TRACE_RPC_URL")).toBe(
      "CHAIN_MONAD_TESTNET_TRACE_RPC_URL",
    );
  });

  it("fills a valid policy for every chain", () => {
    for (const c of CHAINS) {
      const p = createPolicy("balanced", policyContext(c));
      expect(() => guardPolicySchema.parse(p)).not.toThrow();
      if (c.usdc) expect(p.core.x402.allowedAssets).toEqual([c.usdc.id]);
      else expect(p.core.x402.allowedAssets).toEqual([]);
    }
  });
});

describe("deployments", () => {
  it("are recorded only for known chains, with addresses in the family's format", () => {
    for (const c of CHAINS) {
      for (const [name, d] of Object.entries(getDeployments(c.id))) {
        if (c.family === "evm") expect(d.address, name).toMatch(EVM_ADDRESS);
      }
    }
  });

  it("keeps demo addresses in the family's format and never lists an attack address", () => {
    for (const c of CHAINS) {
      for (const [name, e] of Object.entries(getShowcase(c.id))) {
        if (c.family === "evm") expect(e.address, name).toMatch(EVM_ADDRESS);
        if (e.kind === "account") expect(e.listed, name).toBe(false);
      }
    }
    const known = knownAddresses("eip155:10143");
    expect(known).toContain("0xEB9EA352613D8545d70a586C112C30D23D5C1888");
    for (const attack of ["NovaSwapDrainer", "DemoDrainer", "OrbitPoolSilent", "LaunchSaleProxy"]) {
      expect(known).not.toContain(getShowcase("eip155:10143")[attack]?.address);
    }
    expect(knownAddresses("eip155:143")).toEqual([]);
  });

  it("has the Monad testnet vault factory and reputation registry", () => {
    expect(getDeployment("eip155:10143", "PaymentGuardFactory")?.address).toBe(
      "0xDe897d4dF6E1c34aB868948dE035AE29D32eA822",
    );
    expect(getDeployment("eip155:10143", "ReputationRegistry")).not.toBeNull();
    expect(getDeployment("eip155:143", "PaymentGuardFactory")).toBeNull();
  });
});
