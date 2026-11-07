import {
  type Address,
  getAddress,
  type Hex,
  isAddress,
  readTokenBalance,
  type SendError,
  sendErrorOf,
  signTyped,
  type TypedRequest,
  toHex,
} from "@baret/demo-evm/wallet";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Scrybe's "Pay with your wallet": a real x402 payment on Monad testnet.
 *
 * The page asks Baret's server for the answer and gets a 402 with the price,
 * the token and the address to pay. The connected wallet signs exactly that
 * as an EIP-3009 TransferWithAuthorization (a message, so the visitor needs
 * no MON), the page asks again with the signature in X-PAYMENT, and the
 * server settles the transfer on-chain before it answers. With the Baret
 * extension as the wallet, the message is checked by Baret before it signs.
 */

export const PAYWALL_URL = "/api/demo/paywall";

const NETWORK = "monad-testnet";
const CHAIN_ID = 10143;

/** What the 402 asked for. */
export interface Terms {
  readonly payTo: Address;
  readonly asset: Address;
  readonly amount: bigint;
  readonly seconds: number;
  readonly domain: { readonly name: string; readonly version: string };
}

/**
 * Why a payment stopped: the wallet's reason; "balance", the wallet holds
 * less test USDC than the price; "refused", the server did not take the
 * payment; "unsettled", the transfer did not land; "unavailable", no usable
 * answer from the server; "blocked", the Baret wallet did not sign it in its
 * window; "unreachable", the Baret wallet could not reach Baret, so no check
 * ran; "window", the browser stopped the Baret wallet's window. Nothing was
 * paid in any of them except, perhaps, "unsettled", which may still land.
 */
export type PayError =
  | SendError
  | "balance"
  | "blocked"
  | "unreachable"
  | "window"
  | "refused"
  | "unsettled"
  | "unavailable";

/** A signer's own reason for not signing, when it is not a wallet error ("blocked": Baret refused it in its window). */
export class PayStopped extends Error {
  constructor(readonly kind: PayError) {
    super(kind);
    this.name = "PayStopped";
  }
}

export interface PayState {
  readonly phase: "idle" | "asking" | "signing" | "settling" | "done" | "stopped";
  readonly error: PayError | null;
  readonly answer: string | null;
  readonly hash: Hex | null;
  readonly amount: bigint | null;
}

export const IDLE: PayState = {
  phase: "idle",
  error: null,
  answer: null,
  hash: null,
  amount: null,
};

/** The first "exact" payment on Monad testnet a 402 offers; null when there is none this page can pay. */
export function termsOf(body: unknown): Terms | null {
  const accepts = (body as { accepts?: unknown } | null)?.accepts;
  if (!Array.isArray(accepts)) return null;
  for (const a of accepts) {
    if (a?.scheme !== "exact" || a?.network !== NETWORK) continue;
    if (typeof a.maxAmountRequired !== "string" || !/^\d+$/.test(a.maxAmountRequired)) continue;
    if (typeof a.payTo !== "string" || !isAddress(a.payTo)) continue;
    if (typeof a.asset !== "string" || !isAddress(a.asset)) continue;
    return {
      payTo: getAddress(a.payTo),
      asset: getAddress(a.asset),
      amount: BigInt(a.maxAmountRequired),
      seconds: typeof a.maxTimeoutSeconds === "number" ? a.maxTimeoutSeconds : 600,
      domain: {
        name: typeof a.extra?.name === "string" ? a.extra.name : "USDC",
        version: typeof a.extra?.version === "string" ? a.extra.version : "2",
      },
    };
  }
  return null;
}

/** The message the wallet signs for `terms`, and the same fields as the header carries them. */
export function authorization(
  from: Address,
  terms: Terms,
  now: number,
  nonce: Hex,
): { request: TypedRequest; fields: Record<string, string> } {
  const fields = {
    from,
    to: terms.payTo,
    value: terms.amount.toString(),
    validAfter: "0",
    validBefore: String(now + terms.seconds),
    nonce,
  };
  return {
    fields,
    request: {
      from,
      domain: { ...terms.domain, chainId: CHAIN_ID, verifyingContract: terms.asset },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: fields,
    },
  };
}

/** The X-PAYMENT header of a signed authorisation. */
export function paymentHeader(fields: Record<string, string>, signature: Hex): string {
  return btoa(
    JSON.stringify({
      x402Version: 1,
      scheme: "exact",
      network: NETWORK,
      payload: { signature, authorization: fields },
    }),
  );
}

export interface PayDeps {
  fetch: typeof fetch;
  sign: (request: TypedRequest) => Promise<Hex>;
  balance: (token: Address, owner: Address) => Promise<bigint>;
  now: () => number;
  nonce: () => Hex;
}

const DEPS: PayDeps = {
  fetch: (input, init) => fetch(input, init),
  sign: signTyped,
  balance: readTokenBalance,
  now: () => Math.floor(Date.now() / 1000),
  nonce: () => toHex(crypto.getRandomValues(new Uint8Array(32))),
};

/**
 * One paid question, start to end. `step` is told each phase as it begins.
 * Resolves to the last state; never rejects.
 */
export async function payAndAsk(
  from: Address,
  question: string,
  step: (state: PayState) => void,
  deps: PayDeps = DEPS,
): Promise<PayState> {
  const end = (state: PayState): PayState => {
    step(state);
    return state;
  };
  const stop = (error: PayError, amount: bigint | null = null) =>
    end({ ...IDLE, phase: "stopped", error, amount });
  const url = `${PAYWALL_URL}?q=${encodeURIComponent(question)}`;

  step({ ...IDLE, phase: "asking" });
  let terms: Terms | null;
  try {
    const first = await deps.fetch(url);
    if (first.status !== 402) return stop("unavailable");
    terms = termsOf(await first.json());
  } catch {
    return stop("unavailable");
  }
  if (!terms) return stop("unavailable");
  const { amount } = terms;

  // A wallet without the price would sign a payment that cannot settle.
  const held = await deps.balance(terms.asset, from).catch(() => null);
  if (held !== null && held < amount) return stop("balance", amount);

  step({ ...IDLE, phase: "signing", amount });
  const { request, fields } = authorization(from, terms, deps.now(), deps.nonce());
  let signature: Hex;
  try {
    signature = await deps.sign(request);
  } catch (error) {
    return stop(error instanceof PayStopped ? error.kind : sendErrorOf(error), amount);
  }

  step({ ...IDLE, phase: "settling", amount });
  try {
    const paid = await deps.fetch(url, {
      headers: { "x-payment": paymentHeader(fields, signature) },
    });
    if (paid.status === 402) return stop("refused", amount);
    if (paid.status === 502) return stop("unsettled", amount);
    if (!paid.ok) return stop("unavailable", amount);
    const body = (await paid.json()) as { answer?: unknown; payment?: { transaction?: unknown } };
    const hash = body.payment?.transaction;
    if (typeof body.answer !== "string" || typeof hash !== "string") {
      return stop("unavailable", amount);
    }
    return end({ phase: "done", error: null, answer: body.answer, hash: hash as Hex, amount });
  } catch {
    // The signed payment left the page and no answer came back: it may still settle.
    return stop("unsettled", amount);
  }
}

export function usePay(): {
  state: PayState;
  /** `sign`: another signer than the connected wallet (the Baret wallet's window). */
  run: (from: Address, question: string, sign?: PayDeps["sign"]) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<PayState>(IDLE);
  const latest = useRef(0);

  useEffect(
    () => () => {
      latest.current += 1;
    },
    [],
  );

  const run = useCallback(async (from: Address, question: string, sign?: PayDeps["sign"]) => {
    latest.current += 1;
    const id = latest.current;
    await payAndAsk(
      from,
      question,
      (next) => {
        if (latest.current === id) setState(next);
      },
      sign ? { ...DEPS, sign } : DEPS,
    );
  }, []);

  const reset = useCallback(() => {
    latest.current += 1;
    setState(IDLE);
  }, []);

  return { state, run, reset };
}
