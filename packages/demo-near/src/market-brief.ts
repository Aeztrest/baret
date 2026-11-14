/**
 * The brief a buyer pastes into a hire of Baret on NEAR Agent Market (TN.10, ADR-0013),
 * built for them on /near so nobody has to write JSON by hand. Browser-safe: no
 * near-api-js. The agent reads only the JSON block (`@baret/agent-market`
 * `briefToBody`); the sentence above it is for the human who reads the job.
 */

/** NEAR account ids: 2–64 chars of lowercase letters, digits and `-_.` (NEP-0002), or a
 *  64-hex implicit account / 0x EVM-style implicit account. */
const ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isNearAccount(id: string): boolean {
  return ACCOUNT.test(id);
}

/** "0.1" NEAR → yoctoNEAR (24 decimals). Null for anything that is not a positive
 *  decimal with at most 24 places. */
export function nearToYocto(amount: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,24}))?$/.exec(amount.trim());
  if (!m) return null;
  const yocto = BigInt(m[1] ?? "0") * 10n ** 24n + BigInt((m[2] ?? "").padEnd(24, "0") || "0");
  return yocto > 0n ? yocto : null;
}

export type MarketNetwork = "near:testnet" | "near:mainnet";

export interface TransferInput {
  network: MarketNetwork;
  signer: string;
  receiver: string;
  amount: string;
}

export type TransferProblem = "signer" | "receiver" | "amount";

/** A plain NEAR transfer as the analyze body, or the first field that is wrong. */
export function transferBody(
  input: TransferInput,
): { ok: true; body: MarketBody } | { ok: false; problem: TransferProblem } {
  const signer = input.signer.trim().toLowerCase();
  const receiver = input.receiver.trim().toLowerCase();
  if (!isNearAccount(signer)) return { ok: false, problem: "signer" };
  if (!isNearAccount(receiver)) return { ok: false, problem: "receiver" };
  const yocto = nearToYocto(input.amount);
  if (yocto === null) return { ok: false, problem: "amount" };
  return {
    ok: true,
    body: {
      chain: input.network,
      request: {
        kind: "transaction",
        tx: {
          signerId: signer,
          receiverId: receiver,
          actions: [{ type: "Transfer", deposit: yocto.toString() }],
        },
      },
    },
  };
}

export interface MarketBody {
  chain: string;
  request: { kind: "transaction"; tx: object };
  policyTemplate?: string;
}

/** The brief: one line for the human, then the transaction as one JSON block. */
export function marketBrief(body: MarketBody, line: string): string {
  return `${line}\n\n\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\``;
}
