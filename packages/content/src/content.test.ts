import { FINDING_CODES, FINDING_SPECS, POLICY_FIELDS, REPUTATION_TRUST_LEVELS } from "@baret/core";
import { describe, expect, it } from "vitest";
import { findings, policy } from "./index.js";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

describe("findings content", () => {
  it("has exactly one entry per finding code", () => {
    expect(Object.keys(findings).sort()).toEqual([...FINDING_CODES].sort());
  });

  it("interpolates only the values its code declares", () => {
    for (const [code, entry] of Object.entries(findings)) {
      const declared = new Set<string>(entry.values);
      const texts = Object.entries(entry).filter(
        ([k, v]) => typeof v === "string" && k !== "emitter",
      );
      for (const [key, text] of texts) {
        for (const name of placeholders(text as string)) {
          expect(declared.has(name as string), `${code}.${key} uses {${name}}`).toBe(true);
        }
      }
    }
  });

  it("names a family emitter only for family-only codes", () => {
    for (const [code, entry] of Object.entries(findings)) {
      const families = FINDING_SPECS[code as keyof typeof FINDING_SPECS].families;
      if (entry.emitter === "stellar" || entry.emitter === "casper") {
        expect(families, code).toEqual([entry.emitter]);
      }
    }
  });
});

describe("policy content", () => {
  it("has exactly one row per rule", () => {
    expect(Object.keys(policy.fields).sort()).toEqual([...POLICY_FIELDS].sort());
  });

  it("names the trust levels the engine uses", () => {
    expect(Object.keys(policy.fields["core.minReputationTrust"].options).sort()).toEqual(
      [...REPUTATION_TRUST_LEVELS].sort(),
    );
  });

  it("marks family rules with their family, and only those", () => {
    for (const [field, row] of Object.entries(policy.fields)) {
      const section = field.split(".")[0];
      const families = "families" in row ? row.families : undefined;
      if (section === "core") expect(families, field).toBeUndefined();
      else expect(families, field).toEqual([section]);
    }
  });
});
