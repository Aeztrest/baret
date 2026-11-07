/**
 * Pure helpers for the demo sites' wallet: which announced wallet is the Baret
 * extension, which icons are safe to draw, and what a failed connect or send
 * means. Ported from Metropolis (sites/kit/wallet/baret.ts) without the Baret web
 * wallet's window, which the multichain build does not carry.
 */

/**
 * The reverse-DNS name the Baret extension announces over EIP-6963 (Metropolis
 * D-040; the multichain extension keeps it, T2.3). It checks a transaction with
 * Baret before it signs, so a site never says a request sent to it skips the check.
 */
export const BARET_EXTENSION_RDNS = "dev.baret.wallet";

export function isBaretExtension(id: string): boolean {
  return id === BARET_EXTENSION_RDNS;
}

/**
 * EIP-6963 says a wallet's icon is a data URI. Anything else (an http URL
 * that would call home, a javascript: URL) is dropped and the picker draws
 * a plain mark instead. A data URI in an <img> runs no script, SVG included.
 */
export function safeIcon(icon: string | undefined): string | null {
  return typeof icon === "string" && /^data:image\/(?:svg\+xml|png|jpeg|webp|gif)[;,]/i.test(icon)
    ? icon
    : null;
}

/** Why a connect failed, as the picker words it. */
export type ConnectError = "rejected" | "pending" | "failed";

/**
 * The EIP-1193 code anywhere in the error's cause chain: 4001 is the user
 * saying no, -32002 a request the wallet already has open. Libraries wrap
 * the provider's error, so the code can sit a few causes down.
 */
export function connectErrorOf(error: unknown): ConnectError {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && typeof current === "object" && current !== null; depth++) {
    const code = (current as { code?: unknown }).code;
    if (code === 4001) return "rejected";
    if (code === -32002) return "pending";
    current = (current as { cause?: unknown }).cause;
  }
  return "failed";
}

/** Why a send did not go through, as the sign block words it. */
export type SendError = "rejected" | "pending" | "network" | "funds" | "account" | "failed";

/** A send the engine refused before it asked the wallet. */
export class SendRefused extends Error {
  readonly kind: SendError;
  constructor(kind: SendError) {
    super(kind);
    this.name = "SendRefused";
    this.kind = kind;
  }
}

/**
 * Why a send failed, read down the cause chain like connectErrorOf: the
 * engine's own refusal keeps its kind, 4001 is the visitor saying no in the
 * wallet, -32002 a request the wallet already has open. viem names a chain
 * mismatch and a short balance; some wallets only say "insufficient funds"
 * in the message, and Monad testnet's gas estimate answers "insufficient
 * balance" (-32000) when the account cannot pay the value and the fee.
 * Anything else is a plain failure, never a success.
 */
export function sendErrorOf(error: unknown): SendError {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && typeof current === "object" && current !== null; depth++) {
    if (current instanceof SendRefused) return current.kind;
    const link = current as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
      shortMessage?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    if (link.code === 4001) return "rejected";
    if (link.code === -32002) return "pending";
    if (link.name === "ChainMismatchError") return "network";
    if (link.name === "InsufficientFundsError") return "funds";
    const texts = [link.message, link.shortMessage, link.details];
    if (texts.some((t) => typeof t === "string" && /insufficient (?:funds|balance)/i.test(t))) {
      return "funds";
    }
    current = link.cause;
  }
  return "failed";
}

/**
 * Whether an RPC error says the node has not reached the block that was
 * asked for. Monad testnet's public RPC is a pool of nodes, so a read pinned
 * to a block a receipt just came from can reach one that is a block behind;
 * it answers -32602 "Block requested not found" rather than an old value.
 */
export function isBlockNotFound(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && typeof current === "object" && current !== null; depth++) {
    const link = current as {
      message?: unknown;
      shortMessage?: unknown;
      details?: unknown;
      cause?: unknown;
    };
    const texts = [link.message, link.shortMessage, link.details];
    if (texts.some((t) => typeof t === "string" && /block requested not found/i.test(t))) {
      return true;
    }
    current = link.cause;
  }
  return false;
}
