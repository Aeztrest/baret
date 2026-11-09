import { InvalidRequestError } from "@baret/core";
import {
  type NearAction,
  type NearRequest,
  type NearTransaction,
  nearTransactionSchema,
} from "./request.js";
import { bytesToBase64 } from "./rpc.js";

/**
 * A request as one readable transaction. A borsh transaction (signed or unsigned) is
 * decoded with near-api-js and read back into the JSON shape, so every later step reads
 * one form. Anything that does not decode is an invalid request (400), never a pass.
 */
export async function toTransaction(request: NearRequest): Promise<NearTransaction> {
  if (request.kind === "transaction") return request.tx;
  const bytes = fromBase64(request.base64);
  const { decodeSignedTransaction, decodeTransaction } = await import("near-api-js");
  let tx: DecodedTx;
  try {
    tx = decodeSignedTransaction(bytes).transaction as unknown as DecodedTx;
  } catch {
    try {
      tx = decodeTransaction(bytes) as unknown as DecodedTx;
    } catch {
      throw new InvalidRequestError("request.base64 is not a NEAR transaction");
    }
  }
  const parsed = nearTransactionSchema.safeParse({
    signerId: tx.signerId,
    receiverId: tx.receiverId,
    publicKey: tx.publicKey?.toString(),
    actions: tx.actions.map(readAction),
  });
  if (!parsed.success) {
    throw new InvalidRequestError(
      `request.base64: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  return parsed.data;
}

interface DecodedTx {
  signerId: string;
  receiverId: string;
  publicKey?: { toString(): string };
  actions: DecodedAction[];
}

interface DecodedAction {
  enum: string;
  [key: string]: unknown;
}

function readAction(a: DecodedAction): NearAction {
  const body = a[a.enum] as Record<string, unknown> | undefined;
  switch (a.enum) {
    case "createAccount":
      return { type: "CreateAccount" };
    case "deployContract":
      return {
        type: "DeployContract",
        codeBytes: (body?.code as Uint8Array | undefined)?.length ?? 0,
      };
    case "functionCall": {
      const raw = body?.args as Uint8Array;
      return {
        type: "FunctionCall",
        methodName: String(body?.methodName),
        args: jsonArgs(raw),
        gas: String(body?.gas),
        deposit: String(body?.deposit),
      };
    }
    case "transfer":
      return { type: "Transfer", deposit: String(body?.deposit) };
    case "stake":
      return { type: "Stake", stake: String(body?.stake), publicKey: String(body?.publicKey) };
    case "addKey": {
      const accessKey = body?.accessKey as { permission: DecodedAction } | undefined;
      if (!accessKey) throw new InvalidRequestError("AddKey without an access key");
      const permission = accessKey.permission;
      const fc = permission.functionCall as
        | { receiverId: string; methodNames: string[]; allowance?: bigint }
        | undefined;
      return {
        type: "AddKey",
        publicKey: String(body?.publicKey),
        accessKey: fc
          ? {
              receiverId: fc.receiverId,
              methodNames: fc.methodNames,
              allowance: fc.allowance === undefined ? null : String(fc.allowance),
            }
          : "FullAccess",
      };
    }
    case "deleteKey":
      return { type: "DeleteKey", publicKey: String(body?.publicKey) };
    case "deleteAccount":
      return { type: "DeleteAccount", beneficiaryId: String(body?.beneficiaryId) };
    default:
      // Delegate actions, global contracts: not read yet, so not analysed — refused.
      throw new InvalidRequestError(`NEAR action ${a.enum} is not supported`);
  }
}

/** Call arguments as JSON when they are JSON, else base64. */
function jsonArgs(raw: Uint8Array): Record<string, unknown> | string {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // not JSON
  }
  return toBase64(raw);
}

function fromBase64(s: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s))
    throw new InvalidRequestError("request.base64 is not base64");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

const toBase64 = bytesToBase64;
