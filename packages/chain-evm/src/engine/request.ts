import { z } from "zod";

/**
 * The EVM payload inside a /v1/analyze `request` (docs/architecture/chain-adapters.md §2).
 * Ported from Metropolis `@baret/guard` analyze.ts, with a `kind` field so the three
 * shapes are told apart explicitly.
 */

export const evmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");
const hex = z.string().regex(/^0x[0-9a-fA-F]*$/, "must be 0x-prefixed hex");
/** An integer in base units (wei, or a token's smallest unit), decimal or 0x hex. */
const rawAmount = z.union([z.string().regex(/^\d+$/), z.string().regex(/^0x[0-9a-fA-F]+$/)]);

/** An unsigned call, as a dApp hands it to `eth_sendTransaction`. */
export const callRequestSchema = z
  .object({
    from: evmAddressSchema,
    to: evmAddressSchema.nullable().optional(),
    value: rawAmount.optional(),
    data: hex.optional(),
    gas: rawAmount.optional(),
    maxFeePerGas: rawAmount.optional(),
    maxPriorityFeePerGas: rawAmount.optional(),
    gasPrice: rawAmount.optional(),
    nonce: z.number().int().nonnegative().optional(),
  })
  .strict();

/** An EIP-712 message, as a dApp hands it to `eth_signTypedData_v4`. */
export const typedDataSchema = z
  .object({
    signer: evmAddressSchema,
    domain: z.record(z.string(), z.unknown()),
    types: z.record(z.string(), z.array(z.object({ name: z.string(), type: z.string() }).strict())),
    primaryType: z.string(),
    message: z.record(z.string(), z.unknown()),
  })
  .strict();

export const evmRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("call"), tx: callRequestSchema }).strict(),
  /**
   * A serialized transaction. Signed: the sender is recovered from the signature.
   * Unsigned: the sender is the analysis' `account`, which is then required.
   */
  z.object({ kind: z.literal("raw"), raw: hex }).strict(),
  z.object({ kind: z.literal("typed-data"), typedData: typedDataSchema }).strict(),
]);

export type CallRequest = z.infer<typeof callRequestSchema>;
export type TypedDataRequest = z.infer<typeof typedDataSchema>;
export type EvmRequest = z.infer<typeof evmRequestSchema>;
