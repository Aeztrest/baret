import { base58 } from "@scure/base";
import { describe, expect, it } from "vitest";
import {
  type EvmTransfer,
  evmAccounts,
  evmAddressOf,
  fromHex,
  signedTransaction,
  signingHash,
  toHex,
  unsignedBytes,
} from "./evm.js";

/** The vector the vault's Rust test uses too (contracts/near/vault src/evm.rs, tests.rs). */
const TX: EvmTransfer = {
  chain_id: 10143,
  nonce: 7,
  max_priority_fee_per_gas: "2000000000",
  max_fee_per_gas: "60000000000",
  gas_limit: 21000,
  to: "0x5BB6fF1FCbE31ED8FBce6805852Ce279475522fc",
  value: "10000000000000000",
};

describe("EVM transfer bytes", () => {
  it("match viem's EIP-1559 serialisation and the vault's hash", () => {
    expect(toHex(unsignedBytes(TX))).toBe(
      "02f182279f078477359400850df8475800825208945bb6ff1fcbe31ed8fbce6805852ce279475522fc872386f26fc1000080c0",
    );
    expect(signingHash(TX)).toBe(
      "7ac1463ea822e31e7122d92e407fefee98f1e60d17c7ab6e2e2f410b8d1117ca",
    );
  });

  it("appends y parity, r and s from the MPC answer", () => {
    const raw = signedTransaction(TX, {
      big_r: { affine_point: `03${"11".repeat(32)}` },
      s: { scalar: "22".repeat(32) },
      recovery_id: 1,
    });
    expect(raw.startsWith("0x02f874")).toBe(true);
    expect(raw.endsWith(`01a0${"11".repeat(32)}a0${"22".repeat(32)}`)).toBe(true);
  });

  it("derives the address of a secp256k1 key (the generator: private key 1)", () => {
    const g = fromHex(
      "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" +
        "483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
    );
    expect(evmAddressOf(`secp256k1:${base58.encode(g)}`)).toBe(
      "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
    );
  });

  it("takes the receivers from the registry", () => {
    const { shop, attacker } = evmAccounts();
    expect(shop).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(attacker).not.toBe(shop);
  });
});
