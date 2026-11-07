/**
 * Errors every layer agrees on, whatever the chain family. The API maps them to HTTP:
 * InvalidRequestError → 400 invalid_request, ChainUnsupportedError → 400 chain_unsupported,
 * ChainUnavailableError → 503 rpc_unavailable (never a verdict). docs/architecture/api.md §3.
 */

/** The request cannot be analysed as sent (bad shape, wrong chain id, zero address, …). */
export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestError";
  }
}

/** The chain is unknown or not enabled on this deployment. */
export class ChainUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainUnsupportedError";
  }
}

/** The chain could not be read (node down, or answering as another chain). */
export class ChainUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ChainUnavailableError";
  }
}
