import { z } from "zod";

/**
 * The NEAR payload inside a /v1/analyze `request` (docs/chains/near.md §2, ADR-0011).
 *
 *   { kind: "transaction", tx: { signerId, receiverId, actions } }   readable JSON
 *   { kind: "borsh", base64 }                                         an encoded transaction,
 *                                                                     signed or unsigned
 *
 * Amounts are yoctoNEAR (or token base units) as decimal strings; gas is in gas units.
 *
 * Either kind may carry `intents`: the NEAR Intents 1Click quote (POST /v0/quote answer)
 * the transaction deposits into (TN.8). Baret checks who the quote pays and that the
 * deposit matches it. Unknown fields of the quote are kept: the API adds fields.
 */

/** A NEAR account id: 2–64 chars, lowercase, digits, `-`, `_`, `.` separators. */
export const accountIdSchema = z
  .string()
  .regex(/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/, "must be a NEAR account id")
  .min(2)
  .max(64);

const amount = z.string().regex(/^\d+$/, "must be an integer in base units");

const accessKeySchema = z.union([
  z.literal("FullAccess"),
  z
    .object({
      receiverId: accountIdSchema,
      methodNames: z.array(z.string()),
      /** yoctoNEAR the key may spend on fees; null: unlimited. */
      allowance: amount.nullable(),
    })
    .strict(),
]);

export const nearActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CreateAccount") }).strict(),
  z
    .object({
      type: z.literal("DeployContract"),
      /** Size of the code, when known (the code itself is not needed). */
      codeBytes: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("FunctionCall"),
      methodName: z.string().min(1),
      /** The call's JSON arguments, or base64 when they are not JSON. */
      args: z.union([z.record(z.string(), z.unknown()), z.string()]),
      gas: amount,
      deposit: amount,
    })
    .strict(),
  z.object({ type: z.literal("Transfer"), deposit: amount }).strict(),
  z.object({ type: z.literal("Stake"), stake: amount, publicKey: z.string() }).strict(),
  z
    .object({ type: z.literal("AddKey"), publicKey: z.string(), accessKey: accessKeySchema })
    .strict(),
  z.object({ type: z.literal("DeleteKey"), publicKey: z.string() }).strict(),
  z.object({ type: z.literal("DeleteAccount"), beneficiaryId: accountIdSchema }).strict(),
]);

export const nearTransactionSchema = z
  .object({
    signerId: accountIdSchema,
    receiverId: accountIdSchema,
    actions: z.array(nearActionSchema).min(1).max(100),
    publicKey: z.string().optional(),
  })
  .strict();

export const intentsQuoteSchema = z
  .object({
    quote: z
      .object({
        amountIn: amount,
        amountOut: amount,
        amountInUsd: z.string().optional(),
        amountOutUsd: z.string().optional(),
        depositAddress: z.string().min(1).optional(),
        deadline: z.string().optional(),
      })
      .loose(),
    quoteRequest: z
      .object({
        dry: z.boolean(),
        originAsset: z.string().min(1),
        destinationAsset: z.string().min(1),
        recipient: z.string().min(1),
        refundTo: z.string().min(1),
        appFees: z
          .array(z.object({ recipient: z.string(), fee: z.number().nonnegative() }).loose())
          .optional(),
      })
      .loose(),
  })
  .loose();

export const nearRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("transaction"),
      tx: nearTransactionSchema,
      intents: intentsQuoteSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("borsh"),
      base64: z.string().min(1),
      intents: intentsQuoteSchema.optional(),
    })
    .strict(),
]);

export type IntentsQuote = z.infer<typeof intentsQuoteSchema>;

export type NearAction = z.infer<typeof nearActionSchema>;
export type NearTransaction = z.infer<typeof nearTransactionSchema>;
export type NearRequest = z.infer<typeof nearRequestSchema>;
