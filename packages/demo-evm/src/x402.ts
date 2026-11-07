import type { PaymentContext, SpendRecord } from "@baret/core";
import type { Address } from "viem";
import { DEMO } from "./addresses.js";

/**
 * x402 payments for Scrybe and the agents playground. A payment is an EIP-3009
 * `TransferWithAuthorization` message on the token, which the wallet signs and the
 * merchant's facilitator settles. Baret checks the message together with `payment`:
 * what the merchant's 402 asked for. Ported from Metropolis `@baret/demo` x402.ts and
 * moved to the v2 request (CAIP-19 assets, `requirements`).
 */

export interface DemoTypedData {
  signer: Address;
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

/** The message to sign and the 402's requirements, as the check needs them. */
export interface DemoPayment {
  typedData: DemoTypedData;
  payment: PaymentContext;
}

const TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

interface PaymentOptions {
  /** What the 402 asked for, in USDC base units. */
  amount: bigint;
  payTo?: Address;
  /** Where the signed message really sends the money. Defaults to `payTo`. */
  actualTo?: Address;
  /** The token the signed message really moves. Defaults to the real USDC. */
  actualAsset?: Address;
  memo?: string | null;
  /** Earlier payment amounts and times in the last 24 hours (base units, Unix seconds). */
  history?: readonly { amount: bigint; timestamp: number }[];
  /** Unix seconds; the message is valid for ten minutes from here. */
  now?: number;
}

/** An x402 payment as the check needs it. */
export function payment(from: Address, o: PaymentOptions): DemoPayment {
  const payTo = o.payTo ?? DEMO.scrybe.payTo;
  const token = o.actualAsset ?? DEMO.usdc;
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const spendHistory: SpendRecord[] = (o.history ?? []).map((h) => ({
    asset: DEMO.usdcId,
    amount: h.amount.toString(),
    timestamp: h.timestamp,
  }));
  return {
    typedData: {
      signer: from,
      domain: { name: "USDC", version: "2", chainId: DEMO.chainId, verifyingContract: token },
      types: TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from,
        to: o.actualTo ?? payTo,
        value: o.amount.toString(),
        validAfter: "0",
        validBefore: String(now + 600),
        // The payment's number in this run: unique enough for a simulated demo.
        nonce: `0x${(BigInt(now) * 1000n + BigInt(o.history?.length ?? 0)).toString(16).padStart(64, "0")}`,
      },
    },
    payment: {
      origin: DEMO.scrybe.origin,
      requirements: {
        scheme: "exact",
        network: DEMO.chain,
        payTo,
        asset: DEMO.usdcId,
        amount: o.amount.toString(),
        memo: o.memo === undefined ? "scrybe-answer" : o.memo,
      },
      spendHistory,
    },
  };
}

export const scrybe = {
  /**
   * One answer, 0.05 USDC. With `paidBefore` earlier payments in this hour, Baret
   * answers Safe until the visitor's hourly cap, then X402_HOURLY_CAP_EXCEEDED.
   */
  pay: (from: Address, paidBefore = 0, now = Math.floor(Date.now() / 1000)): DemoPayment =>
    payment(from, {
      amount: DEMO.scrybe.price,
      now,
      history: Array.from({ length: paidBefore }, (_, i) => ({
        amount: DEMO.scrybe.price,
        timestamp: now - (paidBefore - i) * 20,
      })),
    }),
};

/** The payment actions of the /agents playground. */
export const agentPayments = {
  /** Pays a merchant what its 402 asked, 0.25 USDC. Nothing to find. */
  pay: (from: Address): DemoPayment => payment(from, { amount: 250_000n }),

  /** Pays a 402, but to another wallet than the one the 402 named. */
  wrongPayee: (from: Address): DemoPayment =>
    payment(from, { amount: 250_000n, actualTo: DEMO.scrybe.otherWallet }),

  /** Pays the 402 with a token that is named USDC and is not the USDC on the list. */
  lookalikeToken: (from: Address): DemoPayment =>
    payment(from, { amount: 250_000n, actualAsset: DEMO.fakeUsdc }),
};
