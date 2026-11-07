import { z } from "zod";
import { caip2Schema, caip19Schema, FAMILIES, familyOf } from "./ids.js";
import { decimalAmountSchema } from "./units.js";

/**
 * The shape of one chain's registry entry. The data lives in @baret/chains
 * (packages/chains/chains/*.json); the schema lives here so adapters can type against it.
 * docs/architecture/chain-adapters.md §4.
 */

const assetInfoSchema = z
  .object({
    id: caip19Schema,
    symbol: z.string().min(1),
    decimals: z.number().int().nonnegative(),
  })
  .strict();

export const chainConfigSchema = z
  .object({
    id: caip2Schema,
    family: z.enum(FAMILIES),
    name: z.string().min(1),
    network: z.enum(["mainnet", "testnet"]),
    /** Prefix of this chain's env variables: CHAIN_<envSlug>_RPC_URL, … */
    envSlug: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    nativeAsset: assetInfoSchema,
    /** The canonical USDC, when the chain has one; it is the default x402 payment asset. */
    usdc: assetInfoSchema.nullable(),
    explorer: z
      .object({
        /** URL templates with {hash} / {address}. */
        tx: z.string().includes("{hash}"),
        address: z.string().includes("{address}"),
      })
      .strict(),
    features: z
      .object({
        simulation: z.enum(["trace", "preflight", "speculative", "none"]),
        x402: z.boolean(),
        spendLimit: z.enum(["vault", "policy-signer"]).nullable(),
        audit: z.boolean(),
        /** Some RPCs reject debug_traceCall inside a JSON-RPC batch (Baret-GOAT lesson). */
        rpcBatch: z.boolean(),
      })
      .strict(),
    /** Native balance each template keeps, in whole units (0.1 MON is not 0.1 XLM). */
    policyFloors: z
      .object({ strict: decimalAmountSchema.nullable(), balanced: decimalAmountSchema.nullable() })
      .strict(),
    faucetUrl: z.url().nullable(),
  })
  .strict()
  .refine((c) => familyOf(c.id) === c.family, {
    message: "family must match the CAIP-2 namespace",
    path: ["family"],
  });

export type ChainConfig = z.infer<typeof chainConfigSchema>;
