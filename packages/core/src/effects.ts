import { z } from "zod";
import { caip2Schema, caip10Schema, caip19Schema } from "./ids.js";
import { baseUnitsSchema } from "./units.js";

/**
 * Effects: the chain-agnostic description of what a transaction or message would do.
 * Every family adapter produces this; universal detectors and the policy read only this.
 * A field is added here (by ADR) only when a universal detector or the policy needs it.
 * docs/architecture/engine.md §3.
 */

/** Signed integer in base units ("-1500000"). */
const signedBaseUnits = z.string().regex(/^-?\d+$/, "must be a signed integer in base units");

export const assetRefSchema = z
  .object({
    id: caip19Schema,
    /** "native", "fungible" (ERC-20, SEP-41, CEP-18, classic Stellar asset) or "nft". */
    kind: z.enum(["native", "fungible", "nft"]),
    symbol: z.string().nullable(),
    /** Null when the token's decimals could not be read (shown in base units). */
    decimals: z.number().int().nonnegative().nullable(),
    /** nft only: the piece, when known. */
    tokenId: z.string().optional(),
  })
  .strict();

export const balanceChangeSchema = z
  .object({
    account: caip10Schema,
    asset: assetRefSchema,
    /** Null when the balance before could not be read (an nft piece, a failed read). */
    before: baseUnitsSchema.nullable(),
    after: baseUnitsSchema.nullable(),
    delta: signedBaseUnits,
  })
  .strict();

export const allowanceSchema = z
  .object({
    owner: caip10Schema,
    spender: caip10Schema,
    asset: assetRefSchema,
    /** Base units; null for access to a whole collection, which has no amount. */
    amount: baseUnitsSchema.nullable(),
    /** At or above the family's unlimited threshold (EVM: the largest uint96). */
    unlimited: z.boolean(),
    /** token: one asset · collection: every item of a collection · item: one nft. */
    scope: z.enum(["token", "collection", "item"]),
    /** transaction: granted on chain now · signature: an off-chain approval (permit). */
    via: z.enum(["transaction", "signature"]),
    /** Unix seconds; null: no expiry. */
    expiresAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const AUTHORITY_CHANGE_KINDS = [
  "owner-transfer",
  "signer-added",
  "signer-removed",
  "threshold-changed",
  "master-key-removed",
  "code-delegation",
  "account-merge",
] as const;

export const authorityChangeSchema = z
  .object({
    account: caip10Schema,
    kind: z.enum(AUTHORITY_CHANGE_KINDS),
    /** The new owner / signer / delegate, when there is one. */
    to: caip10Schema.nullable(),
    details: z.record(z.string(), z.string()),
  })
  .strict();

export const COUNTERPARTY_ROLES = ["target", "spender", "recipient", "payee", "signer"] as const;

export const counterpartySchema = z
  .object({
    address: caip10Schema,
    roles: z.array(z.enum(COUNTERPARTY_ROLES)).min(1),
    /** Null: not known (the read failed or the family cannot tell). */
    isContract: z.boolean().nullable(),
  })
  .strict();

export const effectsSchema = z
  .object({
    chain: caip2Schema,
    /** Who signs and pays the fee. */
    actor: caip10Schema,
    balanceChanges: z.array(balanceChangeSchema),
    allowances: z.array(allowanceSchema),
    authorityChanges: z.array(authorityChangeSchema),
    counterparties: z.array(counterpartySchema),
    calls: z
      .object({
        depth: z.number().int().nonnegative(),
        operationCount: z.number().int().nonnegative(),
        reverted: z.boolean(),
        revertReason: z.string().nullable(),
      })
      .strict(),
    fee: z
      .object({
        asset: assetRefSchema,
        /** The most the transaction can cost. */
        max: baseUnitsSchema,
        estimated: baseUnitsSchema.nullable(),
      })
      .strict(),
    /** Present for a signed message (typed data, auth entry, personal message). */
    message: z
      .object({
        kind: z.enum(["typed-data", "auth-entry", "personal", "unknown"]),
        understood: z.boolean(),
        /** For display; the adapter's own short description. */
        summary: z.string(),
      })
      .strict()
      .nullable(),
    confidence: z.enum(["high", "medium", "low"]),
    /** What could not be determined; non-empty means LOW_CONFIDENCE_INCOMPLETE_DATA. */
    gaps: z.array(z.string()),
  })
  .strict();

export type AssetRef = z.infer<typeof assetRefSchema>;
export type BalanceChange = z.infer<typeof balanceChangeSchema>;
export type Allowance = z.infer<typeof allowanceSchema>;
export type AuthorityChange = z.infer<typeof authorityChangeSchema>;
export type Counterparty = z.infer<typeof counterpartySchema>;
export type Effects = z.infer<typeof effectsSchema>;
