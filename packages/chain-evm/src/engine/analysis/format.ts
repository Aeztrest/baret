import { parseCaip19 } from "@baret/core";
import { type Address, formatUnits, getAddress, isAddress } from "viem";
import type { EvmContext, TokenMeta } from "./context.js";

/**
 * A token whose symbol or decimals could not be read: named by its short address and
 * counted in base units. Guessing 18 decimals would print a confident, wrong amount.
 */
export function unknownToken(token: Address): TokenMeta {
  return { symbol: `${token.slice(0, 6)}...${token.slice(-4)}`, decimals: 0 };
}

/** Symbol and decimals of a token, or of the chain's native coin when `token` is null. */
export function tokenMeta(ctx: EvmContext, token: Address | null): TokenMeta {
  if (token === null) {
    const native = ctx.network.chain.nativeAsset;
    return { symbol: native.symbol, decimals: native.decimals };
  }
  return ctx.tokens.get(token) ?? unknownToken(token);
}

/** Base units to a plain decimal string, without the symbol. */
export function formatAmount(raw: bigint, decimals: number): string {
  return formatUnits(raw, decimals);
}

export function formatPercent(p: number): string {
  return `${Number(p.toFixed(2))}%`;
}

/**
 * A CAIP-19 asset id on this chain as the EVM side knows it: null for the native coin
 * (`slip44:*`), the checksummed address for `erc20:` / `erc721:`, undefined for anything
 * else (another chain, an unknown namespace) — which callers treat as "not this asset".
 */
export function assetAddress(ctx: EvmContext, id: string): Address | null | undefined {
  const parsed = parseCaip19(id);
  if (!parsed || parsed.chain !== ctx.network.chain.id) return undefined;
  if (parsed.assetNamespace === "slip44") return null;
  if (
    (parsed.assetNamespace === "erc20" || parsed.assetNamespace === "erc721") &&
    isAddress(parsed.assetReference, { strict: false })
  ) {
    return getAddress(parsed.assetReference);
  }
  return undefined;
}
