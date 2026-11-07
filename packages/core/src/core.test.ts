import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  analyzeRequestSchema,
  chainConfigSchema,
  createPolicy,
  FINDING_CODES,
  FINDING_SPECS,
  familyOf,
  findingCodeFromV1,
  fromBaseUnits,
  type GuardPolicyV1,
  guardPolicySchema,
  migratePolicyV1,
  POLICY_FIELDS,
  POLICY_TEMPLATE_NAMES,
  POLICY_TEMPLATES,
  type PolicyChainContext,
  parseCaip10,
  parseCaip19,
  toBaseUnits,
  toCaip10,
  V1_FINDING_CODE_MAP,
  verdictSchema,
} from "./index.js";

const MONAD_TESTNET = "eip155:10143";
const USDC_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const USDC = { id: `${MONAD_TESTNET}/erc20:${USDC_ADDRESS}`, decimals: 6 };
const MON = { id: `${MONAD_TESTNET}/slip44:60`, decimals: 18 };
const CHAIN: PolicyChainContext = {
  paymentAssets: [USDC],
  native: { ...MON, floors: { strict: "0.5", balanced: "0.1" } },
};

describe("identifiers", () => {
  it("parses CAIP-10 and CAIP-19 on every family", () => {
    expect(parseCaip10("eip155:143:0xabc")).toEqual({ chain: "eip155:143", address: "0xabc" });
    expect(parseCaip10("stellar:pubnet:GABC")?.chain).toBe("stellar:pubnet");
    expect(parseCaip19("casper:casper-test/cep18:hash-01ab")).toEqual({
      chain: "casper:casper-test",
      assetNamespace: "cep18",
      assetReference: "hash-01ab",
    });
  });

  it("maps namespaces to families and refuses unknown ones", () => {
    expect(familyOf("eip155:10143")).toBe("evm");
    expect(familyOf("stellar:testnet")).toBe("stellar");
    expect(familyOf("casper:casper")).toBe("casper");
    expect(familyOf("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBeNull();
    expect(familyOf("not-a-chain")).toBeNull();
  });

  it("refuses to build an invalid account id", () => {
    expect(() => toCaip10("eip155:1", "has space")).toThrow();
  });
});

describe("units", () => {
  it("converts whole units to base units and back", () => {
    expect(toBaseUnits("12.5", 6)).toBe("12500000");
    expect(toBaseUnits("0.1", 18)).toBe("100000000000000000");
    expect(toBaseUnits("0", 6)).toBe("0");
    expect(fromBaseUnits("12500000", 6)).toBe("12.5");
    expect(fromBaseUnits("5", 6)).toBe("0.000005");
    expect(fromBaseUnits("7", 0)).toBe("7");
  });

  it("refuses more decimals than the asset has", () => {
    expect(() => toBaseUnits("0.0000001", 6)).toThrow();
  });
});

describe("policy schema", () => {
  it("POLICY_FIELDS lists exactly the leaves of the schema", () => {
    const leaves: string[] = [];
    const walk = (schema: z.ZodType, path: string[]) => {
      if (schema instanceof z.ZodObject) {
        for (const [key, child] of Object.entries(schema.shape)) {
          walk(child as z.ZodType, [...path, key]);
        }
      } else if (path.length > 1) {
        leaves.push(path.join("."));
      }
    };
    walk(guardPolicySchema, []);
    expect([...leaves].sort()).toEqual([...POLICY_FIELDS].sort());
  });

  it("every template is a valid policy", () => {
    for (const name of POLICY_TEMPLATE_NAMES) {
      expect(() => guardPolicySchema.parse(POLICY_TEMPLATES[name])).not.toThrow();
      expect(() => guardPolicySchema.parse(createPolicy(name, CHAIN))).not.toThrow();
    }
  });

  it("createPolicy fills the chain's payment asset caps and native floor in base units", () => {
    const p = createPolicy("balanced", CHAIN);
    expect(p.core.x402.allowedAssets).toEqual([USDC.id]);
    expect(p.core.x402.caps).toEqual([
      { asset: USDC.id, perTx: "5000000", perHour: "25000000", perDay: "100000000" },
    ]);
    expect(p.core.minPostBalances).toEqual([{ asset: MON.id, min: "100000000000000000" }]);
    expect(createPolicy("permissive", CHAIN).core.minPostBalances).toEqual([]);
  });

  it("createPolicy returns a copy, never the template itself", () => {
    const p = createPolicy("strict", CHAIN);
    p.core.compliance.allowedCountries.push("TR");
    expect(POLICY_TEMPLATES.strict.core.compliance.allowedCountries).toEqual([]);
  });
});

describe("findings", () => {
  it("every rule names real policy fields", () => {
    for (const code of FINDING_CODES) {
      for (const field of FINDING_SPECS[code].rule.fields) {
        expect(POLICY_FIELDS, `${code} → ${field}`).toContain(field);
      }
    }
  });

  it("family-only codes are tied to family or core rules", () => {
    for (const code of FINDING_CODES) {
      const spec = FINDING_SPECS[code];
      if (spec.families === "all") continue;
      for (const field of spec.rule.fields) {
        const section = field.split(".")[0] ?? "";
        expect(["core", ...spec.families], `${code} → ${field}`).toContain(section);
      }
    }
  });

  it("maps v1 codes onto v2 codes", () => {
    for (const target of Object.values(V1_FINDING_CODE_MAP)) {
      expect(FINDING_CODES).toContain(target);
    }
    expect(findingCodeFromV1("ERC20_APPROVAL_UNLIMITED")).toBe("APPROVAL_UNLIMITED");
    expect(findingCodeFromV1("LOOKALIKE_ADDRESS")).toBe("LOOKALIKE_ADDRESS");
    expect(findingCodeFromV1("NOT_A_CODE")).toBeNull();
  });
});

/**
 * The Metropolis templates (@baret/guard 0.1.4, policy-templates.ts) as Metropolis's
 * createPolicy() returned them on Monad testnet: the testnet USDC as the only asset.
 */
const v1 = (over: Partial<GuardPolicyV1>): GuardPolicyV1 => ({
  requireSuccessfulSimulation: true,
  blockRiskyContracts: true,
  blockUnknownContractExposure: false,
  blockUnlimitedApprovals: true,
  blockSetApprovalForAll: true,
  blockPermit: true,
  blockSelfdestruct: true,
  blockDelegatecall: true,
  blockOwnershipTransfer: true,
  maxLossPercent: 50,
  minPostUsdcBalance: null,
  minPostNativeBalance: "0.1",
  blockKnownMalicious: true,
  minNansenTrustLevel: "new",
  requireComplianceCheck: false,
  allowedCountries: [],
  minComplianceTier: null,
  maxGas: 10_000_000,
  requireMemo: false,
  maxPerTxCap: "5",
  maxHourlyCap: "25",
  maxDailyCap: "100",
  allowedAssets: [USDC_ADDRESS],
  allowedMerchantOrigins: [],
  allowWarnings: true,
  ...over,
});
const V1_TEMPLATES = {
  strict: v1({
    blockUnknownContractExposure: true,
    maxLossPercent: 10,
    minPostNativeBalance: "0.5",
    minNansenTrustLevel: "established",
    maxGas: 2_000_000,
    requireMemo: true,
    maxPerTxCap: "1",
    maxHourlyCap: "5",
    maxDailyCap: "20",
    allowWarnings: false,
  }),
  balanced: v1({}),
  permissive: v1({
    blockRiskyContracts: false,
    blockUnlimitedApprovals: false,
    blockSetApprovalForAll: false,
    blockPermit: false,
    blockDelegatecall: false,
    blockOwnershipTransfer: false,
    maxLossPercent: null,
    minPostNativeBalance: null,
    maxGas: null,
    maxPerTxCap: "50",
    maxHourlyCap: "250",
    maxDailyCap: "1000",
  }),
} as const;

describe("migratePolicyV1", () => {
  const ctx = { chain: MONAD_TESTNET, native: MON, usdc: USDC };

  it.each(POLICY_TEMPLATE_NAMES)(
    "the Metropolis %s template becomes the v2 %s template (core and evm)",
    (name) => {
      const migrated = migratePolicyV1(V1_TEMPLATES[name], ctx);
      const expected = createPolicy(name, CHAIN);
      expect(migrated.core).toEqual(expected.core);
      expect(migrated.evm).toEqual(expected.evm);
      expect(() => guardPolicySchema.parse(migrated)).not.toThrow();
    },
  );

  it("without the chain's USDC, caps are dropped (payments blocked), never loosened", () => {
    const migrated = migratePolicyV1(V1_TEMPLATES.balanced, { ...ctx, usdc: null });
    expect(migrated.core.x402.caps).toEqual([]);
    expect(migrated.core.x402.allowedAssets).toEqual([USDC.id]);
  });

  it("rejects something that is not a v1 policy", () => {
    expect(() => migratePolicyV1({ version: 2 }, ctx)).toThrow();
  });
});

describe("analyze request", () => {
  const base = { chain: MONAD_TESTNET, request: { kind: "raw", raw: "0x01" } };

  it("accepts a request with a template or a policy", () => {
    expect(analyzeRequestSchema.safeParse({ ...base, policyTemplate: "strict" }).success).toBe(
      true,
    );
    expect(
      analyzeRequestSchema.safeParse({ ...base, policy: createPolicy("balanced", CHAIN) }).success,
    ).toBe(true);
  });

  it("refuses both a policy and a template, a missing request, or a bad chain id", () => {
    const policy = createPolicy("balanced", CHAIN);
    expect(
      analyzeRequestSchema.safeParse({ ...base, policy, policyTemplate: "strict" }).success,
    ).toBe(false);
    expect(analyzeRequestSchema.safeParse({ chain: MONAD_TESTNET }).success).toBe(false);
    expect(analyzeRequestSchema.safeParse({ ...base, chain: "10143" }).success).toBe(false);
  });
});

describe("verdict", () => {
  const verdict = {
    decision: "blocked",
    findings: [
      { code: "APPROVAL_UNLIMITED", severity: "high", values: {}, blocking: true },
    ] as const,
    firedRules: [],
    suggestions: [],
    confidence: "high",
    estimatedChanges: [],
    allowances: [],
    sources: [{ name: "reputation-registry", status: "ok" }],
    chain: MONAD_TESTNET,
    pinnedAt: { kind: "block", value: "123" },
    expiresAt: 1_800_000_000,
    meta: {
      requestId: "r1",
      engineVersion: "0.2.0",
      adapterVersion: "0.2.0",
      simulation: "trace",
      analyzedAt: "2026-11-07T00:00:00Z",
    },
  };

  it("accepts a consistent verdict", () => {
    expect(verdictSchema.safeParse(verdict).success).toBe(true);
  });

  it("refuses a decision that contradicts its findings", () => {
    expect(verdictSchema.safeParse({ ...verdict, decision: "safe" }).success).toBe(false);
    expect(verdictSchema.safeParse({ ...verdict, decision: "caution" }).success).toBe(false);
    expect(verdictSchema.safeParse({ ...verdict, decision: "blocked", findings: [] }).success).toBe(
      false,
    );
  });
});

describe("chain config", () => {
  const monad = {
    id: MONAD_TESTNET,
    family: "evm",
    name: "Monad testnet",
    network: "testnet",
    envSlug: "MONAD_TESTNET",
    nativeAsset: { id: MON.id, symbol: "MON", decimals: 18 },
    usdc: { id: USDC.id, symbol: "USDC", decimals: 6 },
    explorer: {
      tx: "https://testnet.monadexplorer.com/tx/{hash}",
      address: "https://testnet.monadexplorer.com/address/{address}",
    },
    features: { simulation: "trace", x402: true, spendLimit: "vault", audit: true, rpcBatch: true },
    policyFloors: { strict: "0.5", balanced: "0.1" },
    faucetUrl: "https://faucet.monad.xyz",
  };

  it("accepts a valid entry and refuses a family that contradicts the namespace", () => {
    expect(chainConfigSchema.safeParse(monad).success).toBe(true);
    expect(chainConfigSchema.safeParse({ ...monad, family: "stellar" }).success).toBe(false);
  });
});
