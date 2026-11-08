/**
 * The EVM side of the Chain Signatures demo (TN.7): the vault on NEAR signs a Monad
 * testnet payment from an address derived from its own account, after its policy allows
 * it. This file builds the same EIP-1559 bytes the vault builds (contracts/near/vault
 * src/evm.rs), derives the vault's EVM address from the MPC key, and assembles the signed
 * transaction from the MPC answer. No chain library: a small RLP and keccak256.
 */
import { getShowcase } from "@baret/chains";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { base58 } from "@scure/base";

export const EVM_CHAIN = "eip155:10143" as const;
export const EVM_CHAIN_ID = 10143;
/** The vault's derivation path (EVM_PATH in the contract): one address for every EVM chain. */
export const EVM_PATH = "eip155";

/** The vault's request_evm_signature argument, field for field (EvmTransfer in Rust). */
export interface EvmTransfer {
  chain_id: number;
  nonce: number;
  max_priority_fee_per_gas: string;
  max_fee_per_gas: string;
  gas_limit: number;
  to: string;
  value: string;
}

/** The MPC network's ECDSA answer, as the vault's callback returns it. */
export interface MpcSignature {
  big_r: { affine_point: string };
  s: { scalar: string };
  recovery_id: number;
}

/** The demo's EVM receivers, from the registry: the shop on the vault's list, and an
 * address a prompt injection names (on Baret's reported list). */
export function evmAccounts(): { shop: string; attacker: string } {
  const s = getShowcase(EVM_CHAIN);
  const shop = s.ScrybeMerchant?.address;
  const attacker = s.DrainerSink?.address;
  if (!shop || !attacker) throw new Error("eip155:10143 demo accounts missing from registry");
  return { shop, attacker };
}

// ------------------------------------------------------------------ hex and RLP

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) throw new Error("bad hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}

function lengthPrefix(len: number, short: number, long: number): number[] {
  if (len < 56) return [short + len];
  const be: number[] = [];
  for (let n = len; n > 0; n = Math.floor(n / 256)) be.unshift(n % 256);
  return [long + be.length, ...be];
}

function rlpBytes(b: Uint8Array): number[] {
  if (b.length === 1 && (b[0] as number) < 0x80) return [b[0] as number];
  return [...lengthPrefix(b.length, 0x80, 0xb7), ...b];
}

function rlpUint(v: bigint): number[] {
  if (v < 0n) throw new Error("negative");
  const hex = v === 0n ? "" : v.toString(16);
  return rlpBytes(fromHex(hex.length % 2 ? `0${hex}` : hex));
}

function rlpList(items: number[][]): number[] {
  const body = items.flat();
  return [...lengthPrefix(body.length, 0xc0, 0xf7), ...body];
}

function fields(tx: EvmTransfer): number[][] {
  return [
    rlpUint(BigInt(tx.chain_id)),
    rlpUint(BigInt(tx.nonce)),
    rlpUint(BigInt(tx.max_priority_fee_per_gas)),
    rlpUint(BigInt(tx.max_fee_per_gas)),
    rlpUint(BigInt(tx.gas_limit)),
    rlpBytes(fromHex(tx.to)),
    rlpUint(BigInt(tx.value)),
    rlpBytes(new Uint8Array()),
    rlpList([]),
  ];
}

/** 0x02 || rlp(fields): the bytes the vault hashes and the MPC network signs. */
export function unsignedBytes(tx: EvmTransfer): Uint8Array {
  return Uint8Array.from([0x02, ...rlpList(fields(tx))]);
}

export function signingHash(tx: EvmTransfer): string {
  return toHex(keccak_256(unsignedBytes(tx)));
}

/** The raw signed transaction (0x…) for eth_sendRawTransaction. */
export function signedTransaction(tx: EvmTransfer, sig: MpcSignature): string {
  const point = fromHex(sig.big_r.affine_point);
  // Compressed point: one prefix byte, then x, which is r.
  const r = BigInt(`0x${toHex(point.slice(1))}`);
  const s = BigInt(`0x${sig.s.scalar}`);
  const signed = rlpList([...fields(tx), rlpUint(BigInt(sig.recovery_id)), rlpUint(r), rlpUint(s)]);
  return `0x02${toHex(Uint8Array.from(signed))}`;
}

/** The EVM address of a NEAR-style "secp256k1:<base58 of the 64-byte x||y>" public key. */
export function evmAddressOf(nearPublicKey: string): string {
  const raw = base58.decode(nearPublicKey.replace(/^secp256k1:/, ""));
  if (raw.length !== 64) throw new Error("expected a 64-byte secp256k1 public key");
  return `0x${toHex(keccak_256(raw).slice(12))}`;
}

/** The MPC signer of each NEAR network (the vault picks the same one from its account). */
const MPC: Record<string, string> = {
  testnet: "v1.signer-prod.testnet",
  mainnet: "v1.signer",
};

/**
 * The vault's EVM address: the MPC network's key derived for (vault, EVM_PATH), read
 * with the signer's `derived_public_key` view, hashed to an address.
 */
export async function vaultEvmAddress(
  nearRpcUrl: string,
  vault: string,
  f: typeof fetch = fetch,
): Promise<string> {
  const mpc = MPC[vault.endsWith(".testnet") ? "testnet" : "mainnet"] as string;
  const args = JSON.stringify({ path: EVM_PATH, predecessor: vault, domain_id: 0 });
  const res = await f(nearRpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "baret",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: mpc,
        method_name: "derived_public_key",
        args_base64: btoa(args),
      },
    }),
  });
  const body = (await res.json()) as { result?: { result?: number[] } };
  const bytes = body.result?.result;
  if (!Array.isArray(bytes)) throw new Error("derived_public_key: no answer");
  return evmAddressOf(JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes))) as string);
}
