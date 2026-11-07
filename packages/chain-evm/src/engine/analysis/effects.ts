import { type Address, getAddress, type Hex, isAddress, zeroAddress } from "viem";
import type { TypedDataRequest } from "../request.js";
import {
  decodeKnownCall,
  decodeKnownLog,
  type KnownCall,
  multicallInner,
  UNLIMITED_THRESHOLD,
} from "../simulation/abi.js";
import type { NormalizedTx } from "../simulation/decode.js";
import type { CallTrace } from "../simulation/trace.js";

/** A permission the user grants in this request. */
export interface ApprovalEffect {
  kind: "erc20" | "operator" | "permit";
  contract: Address;
  spender: Address;
  /** Null for operator access, which has no amount. */
  amount: bigint | null;
  unlimited: boolean;
}

export interface TransferEffect {
  /** Null for the chain's native coin. */
  token: Address | null;
  from: Address;
  to: Address;
  amount: bigint;
  nft: boolean;
}

/** An ERC-721 approval for one item: `spender` may move that one piece. */
export interface ItemApprovalEffect {
  contract: Address;
  spender: Address;
}

export interface OwnershipEffect {
  contract: Address;
  newOwner: Address;
}

/**
 * What the request does to the user, before balances are attached: the EVM-specific
 * effects, as Metropolis built them. Mapped to core `Effects` by the adapter.
 */
export interface EvmEffects {
  approvals: ApprovalEffect[];
  /** Every value movement out of or into the user's account. */
  transfers: TransferEffect[];
  ownership: OwnershipEffect[];
  /**
   * Single-item NFT approvals. Not an allowance and not operator access, so
   * not in `approvals`; the spender is still checked like every grantee.
   */
  itemApprovals?: ItemApprovalEffect[];
  /**
   * Every account that ends up with value in this request, whoever pays it:
   * the merchant a vault pays on the user's behalf, the recipient of an
   * order's consideration, the target of a router's transfer. The user's own
   * transfers are in `transfers`; this list is for the registry, so a known
   * drainer is caught however the money reaches it.
   */
  paidAddresses: Address[];
  /** Calls bundled into one signature (multicall items, or trace frames). */
  operationCount: number;
  /** Where the effects came from: the trace, or the calldata alone. */
  source: "trace" | "calldata" | "typedData";
  /** Typed data only: what Baret made of the message (`effectsFromTypedData`). */
  signature?: SignatureReading;
  /** Typed data only: a marketplace order the message places. */
  order?: OrderEffect;
}

const NATIVE_VALUE_CALLS = new Set(["CALL", "CREATE", "CREATE2", "SELFDESTRUCT"]);

function pushApproval(out: ApprovalEffect[], a: ApprovalEffect) {
  if (a.kind !== "operator" && a.amount === 0n) return; // a revoke grants nothing
  const i = out.findIndex(
    (x) => x.kind === a.kind && x.contract === a.contract && x.spender === a.spender,
  );
  if (i >= 0) out[i] = a;
  else out.push(a);
}

const erc20 = (contract: Address, spender: Address, amount: bigint): ApprovalEffect => ({
  kind: "erc20",
  contract,
  spender,
  amount,
  unlimited: amount >= UNLIMITED_THRESHOLD,
});

/** EvmEffects from what the simulation actually did. */
export function effectsFromTrace(trace: CallTrace, user: Address): EvmEffects {
  const approvals: ApprovalEffect[] = [];
  const transfers: TransferEffect[] = [];
  const ownership: OwnershipEffect[] = [];
  const itemApprovals: ItemApprovalEffect[] = [];
  const paid = new Set<Address>();

  for (const f of trace.frames) {
    if (f.reverted || f.value === 0n || !NATIVE_VALUE_CALLS.has(f.type) || !f.to) continue;
    if (f.to !== user) paid.add(f.to);
    if (f.from === user || f.to === user) {
      transfers.push({ token: null, from: f.from, to: f.to, amount: f.value, nft: false });
    }
  }

  for (const log of trace.logs) {
    const ev = decodeKnownLog(log);
    if (!ev) continue;
    switch (ev.name) {
      case "Transfer":
        if (ev.to !== user && ev.to !== zeroAddress) paid.add(ev.to);
        if (ev.from === user || ev.to === user) {
          transfers.push({
            token: ev.token,
            from: ev.from,
            to: ev.to,
            amount: ev.value,
            nft: ev.nft,
          });
        }
        break;
      case "Approval":
        if (ev.owner === user) pushApproval(approvals, erc20(ev.token, ev.spender, ev.value));
        break;
      case "ItemApproval":
        if (ev.owner === user && ev.spender !== zeroAddress) {
          itemApprovals.push({ contract: ev.token, spender: ev.spender });
        }
        break;
      case "ApprovalForAll":
        if (ev.owner === user && ev.approved) {
          pushApproval(approvals, {
            kind: "operator",
            contract: ev.token,
            spender: ev.operator,
            amount: null,
            unlimited: true,
          });
        }
        break;
      case "OwnershipTransferred":
        ownership.push({ contract: ev.contract, newOwner: ev.newOwner });
        break;
    }
  }

  // A permit lands as an Approval log; mark the ones the calldata says came from a permit.
  for (const f of trace.frames) {
    if (f.reverted || !f.to) continue;
    const call = decodeKnownCall(f.input);
    if (call?.functionName === "permit" && call.args[0] === user) {
      const [, spender, value] = call.args;
      pushApproval(approvals, {
        kind: "permit",
        contract: f.to,
        spender,
        amount: value,
        unlimited: value >= UNLIMITED_THRESHOLD,
      });
      const plain = approvals.findIndex(
        (a) => a.kind === "erc20" && a.contract === f.to && a.spender === spender,
      );
      if (plain >= 0) approvals.splice(plain, 1);
    }
    // Permit2's own allowance emits Permit2's Approval event, not the token's:
    // read it from the call the user makes.
    if (call?.functionName === "approve" && call.args.length === 4 && f.from === user) {
      const [token, spender, amount] = call.args;
      pushApproval(approvals, erc20(token, spender, amount));
    }
  }

  // An operation is a call that can change something. A read does not count,
  // nor does anything inside one. A DELEGATECALL that forwards its parent's
  // call unchanged is a proxy handing over to its implementation (one contract
  // to the user: counted, every call to a proxy would be two). Any other
  // DELEGATECALL runs a call of its own in the contract's storage (a
  // self-multicall item, a library batch) and counts like a CALL.
  const calls = trace.frames.filter((f) => !f.reverted && !f.readOnly && !f.forwarded).length;
  return {
    approvals,
    transfers,
    ownership,
    itemApprovals,
    paidAddresses: [...paid],
    operationCount: calls,
    source: "trace",
  };
}

function applyCall(
  call: KnownCall,
  target: Address,
  user: Address,
  out: Pick<EvmEffects, "approvals" | "transfers" | "ownership" | "paidAddresses">,
) {
  const paid = (to: Address) => {
    if (to !== user && to !== zeroAddress && !out.paidAddresses.includes(to)) {
      out.paidAddresses.push(to);
    }
  };
  switch (call.functionName) {
    case "transfer": {
      const [to, amount] = call.args;
      out.transfers.push({ token: target, from: user, to, amount, nft: false });
      paid(to);
      break;
    }
    case "transferFrom": {
      const [from, to, amount] = call.args;
      if (from === user) out.transfers.push({ token: target, from, to, amount, nft: false });
      paid(to);
      break;
    }
    case "safeTransferFrom": {
      const [from, to] = call.args;
      if (from === user) out.transfers.push({ token: target, from, to, amount: 1n, nft: true });
      paid(to);
      break;
    }
    case "pay": {
      // A vault (PaymentGuard, CompliantPaymentGuard) pays the merchant on
      // the sender's behalf: the money ends with the merchant.
      paid(call.args[0]);
      break;
    }
    case "approve": {
      if (call.args.length === 4) {
        // Permit2: the allowance is on `token`, kept by the Permit2 contract.
        const [token, spender, amount] = call.args;
        pushApproval(out.approvals, erc20(token, spender, amount));
        break;
      }
      const [spender, amount] = call.args;
      pushApproval(out.approvals, erc20(target, spender, amount));
      break;
    }
    case "increaseAllowance":
    case "increaseApproval": {
      // The amount added. Read from calldata alone the total is unknown; the
      // trace's Approval log carries the total.
      const [spender, amount] = call.args;
      pushApproval(out.approvals, erc20(target, spender, amount));
      break;
    }
    case "permit": {
      const [owner, spender, value] = call.args;
      if (owner === user) {
        pushApproval(out.approvals, {
          kind: "permit",
          contract: target,
          spender,
          amount: value,
          unlimited: value >= UNLIMITED_THRESHOLD,
        });
      }
      break;
    }
    case "setApprovalForAll": {
      const [operator, approved] = call.args;
      if (approved) {
        pushApproval(out.approvals, {
          kind: "operator",
          contract: target,
          spender: operator,
          amount: null,
          unlimited: true,
        });
      }
      break;
    }
    case "transferOwnership":
      out.ownership.push({ contract: target, newOwner: call.args[0] });
      break;
    case "transferWithAuthorization": {
      const [from, to, value] = call.args;
      if (from === user) out.transfers.push({ token: target, from, to, amount: value, nft: false });
      paid(to);
      break;
    }
    case "multicall":
      break;
  }
}

/**
 * EvmEffects read from the calldata alone. Used when there is no trace, or when
 * the call reverts: the request still says what it was trying to do.
 */
export function effectsFromCalldata(tx: NormalizedTx, user: Address): EvmEffects {
  const out: Pick<EvmEffects, "approvals" | "transfers" | "ownership" | "paidAddresses"> = {
    approvals: [],
    transfers: [],
    ownership: [],
    paidAddresses: [],
  };
  if (tx.value > 0n && tx.to) {
    out.transfers.push({ token: null, from: tx.from, to: tx.to, amount: tx.value, nft: false });
    if (tx.to !== user) out.paidAddresses.push(tx.to);
  }
  const top = decodeKnownCall(tx.data);
  const inner = multicallInner(top);
  if (tx.to && top) applyCall(top, tx.to, user, out);
  if (tx.to) {
    for (const data of inner) {
      const call = decodeKnownCall(data);
      if (call) applyCall(call, tx.to, user, out);
    }
  }
  return { ...out, operationCount: Math.max(1, inner.length), source: "calldata" };
}

const asAddress = (v: unknown): Address | null =>
  typeof v === "string" && isAddress(v, { strict: false }) ? getAddress(v) : null;
const asBig = (v: unknown): bigint | null => {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isSafeInteger(v)) return BigInt(v);
  if (typeof v === "string" && /^(0x[0-9a-fA-F]+|\d+)$/.test(v)) return BigInt(v);
  return null;
};

/**
 * A marketplace order (Seaport). Signing one moves nothing by itself: anyone
 * can fill it later, at any time before it ends, and then the offer leaves
 * the signer and the consideration is paid out.
 */
export interface OrderEffect {
  /** Items the signer gives. */
  gives: number;
  /** Something of the consideration comes back to the signer. */
  paid: boolean;
  /** The offer covers any item of a collection, not one named item. */
  wholeCollection: boolean;
}

/** What Baret made of a signed EIP-712 message. */
export interface SignatureReading {
  /**
   * read: a kind Baret knows, and its fields said what it grants (possibly
   * nothing, as for a revoke or a vote delegation).
   * unread: a kind Baret does not know, or a known kind whose fields did not
   * yield the effect its name promises.
   */
  kind: "read" | "unread";
  /** Why it is unread; null when read. */
  reason: "unknownType" | "fields" | null;
  /**
   * Unread only: the message names another account or a token amount, so it
   * may move value. A message with neither (a vote, a profile, a login) cannot
   * be read either, but nothing in it points at funds.
   */
  valueBearing: boolean;
  /** The message says it is for another chain than the one being checked. */
  wrongChain: boolean;
  /** The contract the signature is meant for; null when the domain names none. */
  verifier: Address | null;
}

const MAX_UINT256 = (1n << 256n) - 1n;

/** More orders than this in one signature is not read: nobody can review them. */
const MAX_BULK_ORDERS = 64;

/** Field names that carry an amount of something, whatever the message is. */
const AMOUNT_NAME =
  /amount|value|price|allow|limit|quantity|balance|wad|shares|assets|tokens?$|fee/i;

/**
 * Whether an unread message names another account or a token amount. Walks
 * the message with its declared types where they are given, and by the shape
 * of the values where they are not.
 */
function bearsValue(t: TypedDataRequest, user: Address): boolean {
  const seen = new Set<unknown>();
  const walk = (value: unknown, type: string | null, name: string, depth: number): boolean => {
    if (depth > 6) return true; // too deep to read is not a reason to wave it through
    if (Array.isArray(value)) {
      const item = type?.replace(/\[\d*\]$/, "") ?? null;
      return value.some((v) => walk(v, item, name, depth + 1));
    }
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return false;
      seen.add(value);
      const fields = type ? t.types[type] : undefined;
      return Object.entries(value as Record<string, unknown>).some(([key, v]) =>
        walk(v, fields?.find((f) => f.name === key)?.type ?? null, key, depth + 1),
      );
    }
    const address = asAddress(value);
    if (address && (type === null || type.startsWith("address"))) {
      return address !== user && address !== zeroAddress;
    }
    if (type?.startsWith("bytes") || type === "string" || type === "bool") return false;
    const amount = asBig(value);
    return amount !== null && amount > 0n && AMOUNT_NAME.test(name);
  };
  return walk(t.message, t.primaryType, "", 0);
}

/**
 * EvmEffects of an EIP-712 message. Recognises:
 *
 *   Permit                        EIP-2612 (`owner`, `value`) and the DAI form
 *                                 (`holder`, `allowed`)
 *   PermitSingle, PermitBatch     Permit2 allowances
 *   PermitTransferFrom,           Permit2 signature transfers, with or without
 *   PermitBatchTransferFrom,      a witness: the spender may pull up to the
 *   Permit*WitnessTransferFrom    amount once
 *   TransferWithAuthorization,    EIP-3009 (x402 payments)
 *   ReceiveWithAuthorization
 *   CancelAuthorization           EIP-3009: takes an authorisation back
 *   Delegation                    ERC-5805 voting power: moves no funds
 *   OrderComponents, BulkOrder    Seaport orders: what the signer gives, and
 *                                 whether anything is paid back to them
 *
 * Messages that carry a call (`carriedCall`) do not come here when their call
 * can be run: they are simulated like a transaction.
 *
 * Fail-closed: any other kind, and a recognised kind whose fields do not
 * yield the effect its name promises (a permit for another owner, a missing
 * token, an amount that is not a number), is `unread`. A signature Baret
 * cannot read is never reported as doing nothing.
 */
export function effectsFromTypedData(t: TypedDataRequest, chainId?: number): EvmEffects {
  const user = getAddress(t.signer);
  const token = asAddress(t.domain.verifyingContract);
  const m = t.message;
  const out: EvmEffects = {
    approvals: [],
    transfers: [],
    ownership: [],
    paidAddresses: [],
    operationCount: 1,
    source: "typedData",
  };
  const paid = (to: Address) => {
    if (to !== user && to !== zeroAddress && !out.paidAddresses.includes(to)) {
      out.paidAddresses.push(to);
    }
  };

  /** Records a permit; false when its fields do not say who may spend what. */
  const permit = (contract: Address | null, spender: unknown, amount: unknown): boolean => {
    const s = asAddress(spender);
    const a = asBig(amount);
    if (!contract || !s || a === null) return false;
    pushApproval(out.approvals, {
      kind: "permit",
      contract,
      spender: s,
      amount: a,
      unlimited: a >= UNLIMITED_THRESHOLD,
    });
    return true;
  };
  const record = (v: unknown) =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

  /**
   * Records a Seaport order placed through `market`; false when any item of
   * it cannot be read. The offer leaves the signer for whoever fills the
   * order, which nobody knows at signing: the market stands for them.
   */
  const order = (o: Record<string, unknown>, market: Address): boolean => {
    if (asAddress(o.offerer) !== user) return false;
    const offer = Array.isArray(o.offer) ? o.offer : null;
    const consideration = Array.isArray(o.consideration) ? o.consideration : null;
    if (!offer || !consideration || offer.length === 0) return false;
    const effect = out.order ?? { gives: 0, paid: false, wholeCollection: false };
    for (const raw of offer) {
      const item = record(raw);
      const kind = asBig(item.itemType);
      const contract = asAddress(item.token);
      // The most the order can take: an amount may fall or rise over its life.
      const start = asBig(item.startAmount);
      const end = asBig(item.endAmount);
      if (kind === null || start === null || end === null) return false;
      const amount = start > end ? start : end;
      if (kind === 1n && contract) {
        out.transfers.push({ token: contract, from: user, to: market, amount, nft: false });
      } else if ((kind === 2n || kind === 3n) && contract) {
        out.transfers.push({ token: contract, from: user, to: market, amount, nft: true });
      } else if ((kind === 4n || kind === 5n) && contract) {
        // By criteria: any item of the collection the signer holds.
        pushApproval(out.approvals, {
          kind: "operator",
          contract,
          spender: market,
          amount: null,
          unlimited: true,
        });
        effect.wholeCollection = true;
      } else {
        // Native coin cannot be offered by signature, and nothing else is known.
        return false;
      }
      effect.gives += 1;
    }
    for (const raw of consideration) {
      const item = record(raw);
      const kind = asBig(item.itemType);
      const start = asBig(item.startAmount);
      const end = asBig(item.endAmount);
      if (kind === null || start === null || end === null) return false;
      const recipient = asAddress(item.recipient);
      if (recipient !== user) {
        // Somebody else is paid when the order fills: a fee recipient, a
        // royalty, or a drainer's own account. The registry sees every one.
        if (recipient && (start > 0n || end > 0n)) paid(recipient);
        continue;
      }
      // The least the signer can be paid.
      const amount = start < end ? start : end;
      if (amount === 0n) continue;
      const contract = asAddress(item.token);
      if (kind === 0n) {
        out.transfers.push({ token: null, from: market, to: user, amount, nft: false });
      } else if (contract) {
        out.transfers.push({ token: contract, from: market, to: user, amount, nft: kind !== 1n });
      } else {
        return false;
      }
      effect.paid = true;
    }
    out.order = effect;
    return true;
  };

  let read = false;
  let known = true;
  switch (t.primaryType) {
    case "Permit":
      if ("holder" in m || "allowed" in m) {
        // DAI: no amount, a yes or no for the whole balance. A no is a revoke.
        if (asAddress(m.holder) !== user || typeof m.allowed !== "boolean") break;
        read = m.allowed ? permit(token, m.spender, MAX_UINT256) : asAddress(m.spender) !== null;
        break;
      }
      // A permit that names another owner is not this signer's to give: it is
      // not read as harmless, it is not read at all.
      read = asAddress(m.owner) === user && permit(token, m.spender, m.value);
      break;
    case "PermitSingle": {
      const d = record(m.details);
      read = permit(asAddress(d.token), m.spender, d.amount);
      break;
    }
    case "PermitBatch": {
      const list = Array.isArray(m.details) ? m.details : [];
      // Every entry has to be read: one unreadable entry hides an allowance.
      read = list.length > 0;
      for (const d of list) {
        if (!permit(asAddress(record(d).token), m.spender, record(d).amount)) read = false;
      }
      out.operationCount = Math.max(1, list.length);
      break;
    }
    case "PermitTransferFrom":
    case "PermitWitnessTransferFrom": {
      const p = record(m.permitted);
      read = permit(asAddress(p.token), m.spender, p.amount);
      break;
    }
    case "PermitBatchTransferFrom":
    case "PermitBatchWitnessTransferFrom": {
      const list = Array.isArray(m.permitted) ? m.permitted : [];
      read = list.length > 0;
      for (const p of list) {
        if (!permit(asAddress(record(p).token), m.spender, record(p).amount)) read = false;
      }
      out.operationCount = Math.max(1, list.length);
      break;
    }
    case "TransferWithAuthorization":
    case "ReceiveWithAuthorization": {
      const from = asAddress(m.from);
      const to = asAddress(m.to);
      const value = asBig(m.value);
      if (token && from === user && to && value !== null) {
        out.transfers.push({ token, from, to, amount: value, nft: false });
        paid(to);
        read = true;
      }
      break;
    }
    case "CancelAuthorization":
      // Takes back an authorisation of the signer's own: nothing moves.
      read = token !== null && asAddress(m.authorizer) === user;
      break;
    case "Delegation":
      // Voting power to a delegate. The tokens stay where they are.
      read = token !== null && asAddress(m.delegatee) !== null;
      break;
    case "OrderComponents":
      read = token !== null && order(m, token);
      break;
    case "BulkOrder": {
      // A tree of orders signed at once: every leaf has to be read.
      const leaves = (Array.isArray(m.tree) ? m.tree : []).flat(Number.POSITIVE_INFINITY);
      read = token !== null && leaves.length > 0 && leaves.length <= MAX_BULK_ORDERS;
      for (const leaf of read ? leaves : []) {
        if (!order(record(leaf), token as Address)) read = false;
      }
      out.operationCount = Math.max(1, leaves.length);
      break;
    }
    default:
      // An order, a vote, a login, a kind nobody has seen: Baret has no model
      // of what it authorises.
      known = false;
  }

  out.signature = {
    kind: read ? "read" : "unread",
    reason: read ? null : known ? "fields" : "unknownType",
    // A known kind that did not read is a grant Baret could not pin down.
    valueBearing: read ? false : known || bearsValue(t, user),
    wrongChain: namesAnotherChain(t, chainId),
    verifier: token,
  };
  return out;
}

/** Whether the message's domain names a chain other than the one being checked. */
export function namesAnotherChain(t: TypedDataRequest, chainId: number | undefined): boolean {
  const declared = asBig(t.domain.chainId);
  return chainId !== undefined && declared !== null && declared !== BigInt(chainId);
}

/**
 * A signed message that carries a call for somebody else to send: the call,
 * as the chain will run it, and the account whose funds it can move.
 */
export interface CarriedCall {
  tx: NormalizedTx;
  /** Whose balances the call touches: the signer, or the Safe they sign for. */
  user: Address;
  /** The contract that will run it: a forwarder, or the Safe itself. */
  verifier: Address;
}

/**
 * The call inside a signed message, when the message is one of the kinds that
 * carry one. Unlike a permit, such a message can be simulated: what it does
 * is what its call does.
 *
 *   ForwardRequest   ERC-2771 meta-transaction. The forwarder sends `data` to
 *                    `to` with the signer's address appended, and a contract
 *                    that trusts the forwarder acts as if the signer called.
 *   SafeTx           A Safe transaction. The Safe sends `data` to `to` once
 *                    enough owners have signed; the funds at stake are the Safe's.
 *
 * Null for any other kind, and for one of these whose fields do not give a
 * call that can be run as an ordinary call (another sender, a Safe
 * delegatecall): the caller then treats the message as unread.
 */
export function carriedCall(t: TypedDataRequest): CarriedCall | null {
  const signer = getAddress(t.signer);
  const verifier = asAddress(t.domain.verifyingContract);
  const m = t.message;
  if (!verifier) return null;
  const to = asAddress(m.to);
  const data = typeof m.data === "string" && /^0x([0-9a-fA-F]{2})*$/.test(m.data) ? m.data : null;
  const value = m.value === undefined ? 0n : asBig(m.value);
  if (!to || data === null || value === null) return null;

  if (t.primaryType === "ForwardRequest") {
    if (asAddress(m.from) !== signer) return null;
    const gas = asBig(m.gas);
    return {
      tx: {
        from: verifier,
        to,
        value,
        // ERC-2771: the forwarder appends who the call is from.
        data: `${data}${signer.slice(2).toLowerCase()}` as Hex,
        gas: gas !== null && gas > 0n ? gas : null,
        gasPrice: null,
      },
      user: signer,
      verifier,
    };
  }
  if (t.primaryType === "SafeTx") {
    // operation 1 is a delegatecall: the Safe runs foreign code as itself,
    // which an ordinary call cannot stand in for.
    if (asBig(m.operation ?? 0) !== 0n) return null;
    return {
      tx: { from: verifier, to, value, data: data as Hex, gas: null, gasPrice: null },
      user: verifier,
      verifier,
    };
  }
  return null;
}
