import { z } from "zod";

/**
 * Chain-agnostic identifiers (ADR-0002).
 *
 *   chain    CAIP-2   eip155:10143 · stellar:pubnet · casper:casper-test · near:testnet
 *   account  CAIP-10  eip155:10143:0xabc… · stellar:pubnet:G… · casper:casper:01ab… ·
 *                     near:testnet:alice.testnet (an `_` in a NEAR account id is written %5F)
 *   asset    CAIP-19  eip155:143/erc20:0x… · stellar:pubnet/sep41:C… · casper:casper/cep18:… ·
 *                     near:testnet/nep141:usdc.testnet
 *
 * Shapes follow the CAIP specifications. Which asset namespaces each family uses is
 * decided in the adapters and documented in docs/architecture/engine.md §2.
 */

export const FAMILIES = ["evm", "stellar", "casper", "near"] as const;
export type Family = (typeof FAMILIES)[number];

/** CAIP-2 namespace → chain family. A namespace not listed here is not supported. */
export const NAMESPACE_FAMILY = {
  eip155: "evm",
  stellar: "stellar",
  casper: "casper",
  near: "near",
} as const satisfies Record<string, Family>;
export type Namespace = keyof typeof NAMESPACE_FAMILY;

const NAMESPACE = "[-a-z0-9]{3,8}";
const CHAIN_REF = "[-_a-zA-Z0-9]{1,32}";
const ACCOUNT_ADDRESS = "[-.%a-zA-Z0-9]{1,128}";
const ASSET_NAMESPACE = "[-a-z0-9]{3,8}";
const ASSET_REF = "[-.%a-zA-Z0-9]{1,128}";

const CAIP2 = new RegExp(`^(${NAMESPACE}):(${CHAIN_REF})$`);
const CAIP10 = new RegExp(`^(${NAMESPACE}:${CHAIN_REF}):(${ACCOUNT_ADDRESS})$`);
const CAIP19 = new RegExp(`^(${NAMESPACE}:${CHAIN_REF})/(${ASSET_NAMESPACE}):(${ASSET_REF})$`);

export const caip2Schema = z.string().regex(CAIP2, "must be a CAIP-2 chain id, e.g. eip155:10143");
export const caip10Schema = z
  .string()
  .regex(CAIP10, "must be a CAIP-10 account id, e.g. eip155:10143:0xabc…");
export const caip19Schema = z
  .string()
  .regex(CAIP19, "must be a CAIP-19 asset id, e.g. eip155:143/erc20:0xabc…");

export type Caip2 = z.infer<typeof caip2Schema>;
export type Caip10 = z.infer<typeof caip10Schema>;
export type Caip19 = z.infer<typeof caip19Schema>;

export interface ParsedChain {
  chain: Caip2;
  namespace: string;
  reference: string;
}
export interface ParsedAccount {
  chain: Caip2;
  address: string;
}
export interface ParsedAsset {
  chain: Caip2;
  assetNamespace: string;
  assetReference: string;
}

export function parseCaip2(id: string): ParsedChain | null {
  const m = CAIP2.exec(id);
  if (!m?.[1] || !m[2]) return null;
  return { chain: id, namespace: m[1], reference: m[2] };
}

export function parseCaip10(id: string): ParsedAccount | null {
  const m = CAIP10.exec(id);
  if (!m?.[1] || !m[2]) return null;
  return { chain: m[1], address: m[2] };
}

export function parseCaip19(id: string): ParsedAsset | null {
  const m = CAIP19.exec(id);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return { chain: m[1], assetNamespace: m[2], assetReference: m[3] };
}

export function toCaip10(chain: Caip2, address: string): Caip10 {
  const id = `${chain}:${address}`;
  if (!CAIP10.test(id)) throw new Error(`not a valid account for ${chain}: ${address}`);
  return id;
}

export function toCaip19(chain: Caip2, assetNamespace: string, assetReference: string): Caip19 {
  const id = `${chain}/${assetNamespace}:${assetReference}`;
  if (!CAIP19.test(id)) throw new Error(`not a valid asset id: ${id}`);
  return id;
}

/** The family of a chain, or null when its namespace is not supported. */
export function familyOf(chain: string): Family | null {
  const parsed = parseCaip2(chain);
  if (!parsed) return null;
  return (NAMESPACE_FAMILY as Record<string, Family>)[parsed.namespace] ?? null;
}
