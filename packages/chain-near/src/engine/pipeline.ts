import type {
  AdapterInput,
  AdapterResult,
  BalanceChange,
  ChainConfig,
  FindingDraft,
  SourceStatus,
} from "@baret/core";
import { InvalidRequestError, parseCaip10, parseCaip19 } from "@baret/core";
import { toTransaction } from "./decode.js";
import type { NearHistory } from "./history.js";
import type { IntentsClient } from "./intents.js";
import type { IntentsQuote, NearRequest, NearTransaction } from "./request.js";
import type { NearAccountState, NearRpc } from "./rpc.js";

/**
 * One NEAR analysis (Phase 1 shape, D9): decode, preflight over RPC, effects, the NEAR
 * detectors and the policy rules, handed to the engine as finding drafts. NEAR has no
 * public transaction simulation, so the verdict is a preflight (docs/chains/near.md §2).
 */

export interface NearDeps {
  rpc: NearRpc;
  /** Account ids Baret vouches for on this chain (its own contracts, the USDC). */
  knownContracts: readonly string[];
  /** Account ids on Baret's reported list, with their reason code. */
  flagged: ReadonlyMap<string, string>;
  /** The Chain Signatures MPC contracts of this network. */
  mpcContracts: readonly string[];
  /**
   * NEAR Intents 1Click, to confirm a quote by its deposit address. Absent (testnet: Intents
   * runs on mainnet only): a request that carries a quote cannot be confirmed and blocks.
   */
  intents?: IntentsClient;
  /**
   * Counterparty history (TN.14): account age, activity and past contacts, and an archival
   * node for code changes. Absent (no index for this network): the checks are skipped and
   * the source says so; failing at runtime: COUNTERPARTY_HISTORY_UNAVAILABLE (Caution).
   */
  history?: NearHistory;
  archive?: NearRpc;
  /**
   * The shared blocklist contract agents report to (TN.14, contracts/near/blocklist).
   * Absent: not deployed on this network. A failed read is REPUTATION_DATA_UNAVAILABLE.
   */
  blocklist?: string;
}

/** The most accounts one `get_flags` read takes (the contract's MAX_QUERY). */
const BLOCKLIST_QUERY = 50;

interface BlocklistFlag {
  account: string;
  flagged: boolean;
  confirmed: boolean;
  reports: number;
  reason: string;
  evidence: string;
}

/** An account first used less than this long ago is fresh (REPUTATION_FRESH_ACCOUNT). */
export const FRESH_ACCOUNT_MS = 72 * 3600 * 1000;
/**
 * How far back the code of a called contract is compared: 72 hours at 2 blocks a second,
 * so at least 72 hours on mainnet and testnet, which produce fewer blocks than that.
 */
export const CODE_WINDOW_BLOCKS = 72n * 3600n * 2n;

const NATIVE = "native";
const YOCTO = 24;
/** Implicit accounts (64 hex, or 0x + 40 hex for ETH-implicit) are created by a transfer. */
const IMPLICIT = /^([0-9a-f]{64}|0x[0-9a-f]{40})$/;
/** A NEAR account id (nomicon: 2–64 chars, lowercase parts joined by "." , "-" or "_"). */
const ACCOUNT_ID = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

/** A transfer the request makes, from whoever pays it, in base units. */
interface Movement {
  from: string;
  to: string;
  /** "native" or the NEP-141 token contract. */
  asset: string;
  amount: bigint;
  /** A Baret vault pays it, not the signer. */
  viaVault?: string;
  /** The deposit of a NEAR Intents swap: an exchange, not a loss (its loss is the quote's). */
  swap?: true;
  /**
   * NEAR attached to a function call (the 1 yoctoNEAR `ft_transfer` requires, a storage
   * deposit). It leaves the signer, but it is not the payment the call makes.
   */
  attached?: true;
  /** A NEP-171 piece or a NEP-245 multi-token: moved, but not priced or balance-read. */
  kind?: "nft" | "mt";
  tokenId?: string;
  /**
   * NEAR a Stake action locks: it leaves the spendable balance (post-balance floor) but is
   * not paid to anyone (no loss). Its amount is the stake minus what is already locked.
   */
  locked?: true;
}

interface Analysis {
  tx: NearTransaction;
  user: string;
  movements: Movement[];
  drafts: FindingDraft[];
  /** Why the request would fail on chain, when the preflight can tell; null: it would not. */
  failure: string | null;
  /** EVM transfers a Baret vault is asked to sign through Chain Signatures (TN.7). */
  evmSignatures: { vault: string; tx: Record<string, unknown> }[];
  /** NEP-178 approvals the request grants. */
  approvals: { spender: string; contract: string; tokenId: string }[];
  /** Contracts a `*_transfer_call` hands tokens to; their code runs on them with `msg`. */
  callReceivers: string[];
  /** Calls to owner methods of what may be a Baret vault; the preflight reads its policy. */
  vaultCalls: { vault: string; method: string; args: Record<string, unknown> }[];
}

/**
 * The vault's owner-only methods (contracts/near/vault/src/lib.rs). `accept_owner` is the
 * pending owner's. A call to one of these names on a contract that does not answer
 * `get_policy` as a Baret vault is an ordinary call.
 */
const VAULT_OWNER_METHODS = new Set([
  "set_limit",
  "remove_asset",
  "add_receiver",
  "remove_receiver",
  "add_agent",
  "remove_agent",
  "set_paused",
  "propose_owner",
  "update_contract",
  "withdraw",
]);

export async function analyzeNear(input: AdapterInput, deps: NearDeps): Promise<AdapterResult> {
  const tx = await toTransaction(input.request as NearRequest);
  const network = input.chain.id.split(":")[1];
  const user = input.account
    ? decodeAccount(parseCaip10(input.account)?.address ?? "")
    : tx.signerId;
  const pin = await deps.rpc.pin();
  const [signer, receiver] = await Promise.all([
    deps.rpc.viewAccount(tx.signerId, pin.hash),
    deps.rpc.viewAccount(tx.receiverId, pin.hash),
  ]);

  const a: Analysis = {
    tx,
    user,
    movements: [],
    drafts: [],
    failure: null,
    evmSignatures: [],
    approvals: [],
    callReceivers: [],
    vaultCalls: [],
  };
  if (signer === null) a.failure = "E_SIGNER_MISSING";

  readActions(a, deps);
  // A Stake action sets the account's total stake: only what it adds to the stake already
  // locked leaves the spendable balance.
  for (const m of a.movements) {
    if (!m.locked) continue;
    const already = signer?.locked ?? 0n;
    m.amount = m.amount > already ? m.amount - already : 0n;
  }
  const sent = (input.request as NearRequest).intents;
  const intents = sent ? await confirmQuote(a, sent, deps) : undefined;
  if (intents) intentsCheck(a, intents, input.now);
  await keyCheck(a, deps, signer, pin.hash);
  await preflight(a, deps, input, receiver, signer, pin.hash);
  await detect(a, deps, input, receiver, pin.hash);
  const blocklistSource = await blocklistCheck(a, deps, pin.hash);
  const counterpartySources = await counterparties(a, deps, input, receiver, pin);

  const balances = await balancesBefore(a, deps, signer, pin.hash);
  rules(a, input, balances, intents);
  if (input.payment) payment(a, input);

  if (a.failure !== null) {
    a.drafts.unshift({ code: "SIMULATION_FAILED", values: {}, details: { reason: a.failure } });
  }
  const sources: SourceStatus[] = [
    { name: "near-rpc", status: "ok" },
    { name: "reputation-registry", status: deps.flagged.size > 0 ? "ok" : "skipped" },
    ...(blocklistSource ? [blocklistSource] : []),
    ...counterpartySources,
  ];
  if (sent) sources.push({ name: "near-intents-1click", status: intents ? "ok" : "unavailable" });
  return {
    drafts: a.drafts,
    estimatedChanges: changes(a, input.chain, balances),
    allowances: [],
    sources,
    pinnedAt: { kind: "block", value: pin.height.toString() },
    simulation: "preflight",
    confidence: network === "mainnet" || network === "testnet" ? "medium" : "low",
  };
}

// ------------------------------------------------------------------ decode → effects

function readActions(a: Analysis, deps: NearDeps): void {
  const { tx } = a;
  for (const action of tx.actions) {
    switch (action.type) {
      case "Transfer":
        a.movements.push({
          from: tx.signerId,
          to: tx.receiverId,
          asset: NATIVE,
          amount: BigInt(action.deposit),
        });
        break;
      case "FunctionCall": {
        const deposit = BigInt(action.deposit);
        if (deposit > 0n) {
          a.movements.push({
            from: tx.signerId,
            to: tx.receiverId,
            asset: NATIVE,
            amount: deposit,
            attached: true,
          });
        }
        const args = typeof action.args === "object" ? action.args : {};
        readCall(a, deps, action.methodName, args);
        break;
      }
      case "AddKey":
        if (action.accessKey === "FullAccess") {
          a.drafts.push({
            code: "AUTHORITY_CHANGE",
            values: {
              contract: tx.receiverId,
              recipient: `a new full access key ${short(action.publicKey)}`,
            },
            details: { kind: "signer-added", publicKey: action.publicKey },
          });
        } else {
          a.drafts.push({
            code: "FUNCTION_CALL_KEY_ADDED",
            values: {
              contract: action.accessKey.receiverId,
              amount:
                action.accessKey.allowance === null
                  ? "unlimited"
                  : units(BigInt(action.accessKey.allowance), YOCTO),
              asset: "NEAR",
            },
            details: { methods: action.accessKey.methodNames, publicKey: action.publicKey },
          });
        }
        break;
      case "DeleteKey":
        a.drafts.push({
          code: "AUTHORITY_CHANGE",
          values: {
            contract: tx.receiverId,
            recipient: `no one: key ${short(action.publicKey)} is removed`,
          },
          details: { kind: "signer-removed", publicKey: action.publicKey },
        });
        break;
      case "DeleteAccount":
        a.drafts.push({
          code: "ACCOUNT_DELETE_DETECTED",
          values: { recipient: action.beneficiaryId },
        });
        // Everything the account holds goes; the amount is filled once the balance is read.
        a.movements.push({
          from: tx.receiverId,
          to: action.beneficiaryId,
          asset: NATIVE,
          amount: -1n,
        });
        break;
      case "DeployContract":
        a.drafts.push({ code: "CONTRACT_DEPLOY_DETECTED", values: { address: tx.receiverId } });
        break;
      case "Stake":
        a.drafts.push({
          code: "STAKE_DETECTED",
          values: {
            amount: units(BigInt(action.stake), YOCTO),
            asset: "NEAR",
          },
          details: { publicKey: action.publicKey },
        });
        a.movements.push({
          from: tx.signerId,
          to: "",
          asset: NATIVE,
          amount: BigInt(action.stake),
          locked: true,
        });
        break;
      case "CreateAccount":
        break;
    }
  }
}

function readCall(
  a: Analysis,
  deps: NearDeps,
  method: string,
  args: Record<string, unknown>,
): void {
  const { tx } = a;
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : null);
  if (
    (method === "ft_transfer" || method === "ft_transfer_call") &&
    str("receiver_id") &&
    str("amount")
  ) {
    a.movements.push({
      from: tx.signerId,
      to: str("receiver_id") as string,
      asset: tx.receiverId,
      amount: toBig(str("amount")),
    });
  }
  // NEP-171: one piece leaves the signer. It has no price, so no amount rule can pass it;
  // NFT_TRANSFER_DETECTED puts it in front of the owner.
  if ((method === "nft_transfer" || method === "nft_transfer_call") && str("receiver_id")) {
    const tokenId = str("token_id") ?? "";
    a.movements.push({
      from: tx.signerId,
      to: str("receiver_id") as string,
      asset: tx.receiverId,
      amount: 1n,
      kind: "nft",
      tokenId,
    });
    a.drafts.push({
      code: "NFT_TRANSFER_DETECTED",
      values: { recipient: str("receiver_id") as string, contract: tx.receiverId },
      details: { tokenId, method },
    });
  }
  // NEP-245 multi-tokens (intents.near holds balances this way): one or many ids leave.
  if (/^mt_(batch_)?transfer(_call)?$/.test(method) && str("receiver_id")) {
    const ids: unknown[] = Array.isArray(args.token_ids) ? args.token_ids : [args.token_id];
    const amounts: unknown[] = Array.isArray(args.amounts) ? args.amounts : [args.amount];
    ids.forEach((id, i) => {
      const amt = amounts[i];
      a.movements.push({
        from: tx.signerId,
        to: str("receiver_id") as string,
        asset: tx.receiverId,
        amount: toBig(typeof amt === "string" ? amt : null),
        kind: "mt",
        tokenId: String(id),
      });
    });
    a.drafts.push({
      code: "MULTI_TOKEN_TRANSFER_DETECTED",
      values: { recipient: str("receiver_id") as string, contract: tx.receiverId },
      details: { tokenIds: ids.map(String), method },
    });
  }
  // NEP-178: a standing right to move one piece. To an account with no contract it is how
  // NFT phishing works, like an allowance to a wallet (APPROVAL_TO_WALLET, in detect).
  if (method === "nft_approve" && str("account_id")) {
    a.approvals.push({
      spender: str("account_id") as string,
      contract: tx.receiverId,
      tokenId: str("token_id") ?? "",
    });
  }
  // `*_transfer_call` runs the receiver's code with `msg`: the receiver decides what it
  // keeps and what it returns, so it is a contract exposure of its own.
  if (/_transfer_call$/.test(method) && str("receiver_id")) {
    a.callReceivers.push(str("receiver_id") as string);
  }
  if (method === "execute_transfer" && str("receiver") && str("amount") && str("asset")) {
    // The vault holds "native" or NEP-141 tokens named by their contract. Anything else
    // (a CAIP-19 id, a typo) is no asset it has a limit for: it refuses, and the id
    // could not be written as an asset of the answer either.
    const asset = str("asset") as string;
    if (asset !== NATIVE && !ACCOUNT_ID.test(asset)) {
      a.failure ??= "E_ASSET_NOT_ALLOWED";
      return;
    }
    a.movements.push({
      from: tx.receiverId,
      to: str("receiver") as string,
      asset: str("asset") as string,
      amount: toBig(str("amount")),
      viaVault: tx.receiverId,
    });
  }
  // A Baret vault signing an EVM transfer through Chain Signatures. No
  // CHAIN_SIGNATURE_REQUEST here: the vault builds the transaction itself and bounds it by
  // its policy, which the preflight reads below; the EVM transfer is checked on its own
  // chain by a second /v1/analyze. A direct `sign` on the MPC contract has no such bound.
  if (VAULT_OWNER_METHODS.has(method) || method === "accept_owner") {
    a.vaultCalls.push({ vault: tx.receiverId, method, args });
  }
  if (method === "request_evm_signature" && typeof args.tx === "object" && args.tx !== null) {
    a.evmSignatures.push({ vault: tx.receiverId, tx: args.tx as Record<string, unknown> });
  }
  if (method === "sign" && deps.mpcContracts.includes(tx.receiverId)) {
    const request = (args.request ?? args) as Record<string, unknown>;
    a.drafts.push({
      code: "CHAIN_SIGNATURE_REQUEST",
      values: { path: String(request.path ?? "(none)"), contract: tx.receiverId },
      details: { domainId: request.domain_id ?? request.key_version ?? null },
    });
  }
}

// ------------------------------------------------------------------ preflight

async function preflight(
  a: Analysis,
  deps: NearDeps,
  input: AdapterInput,
  receiver: NearAccountState | null,
  signer: NearAccountState | null,
  block: string,
): Promise<void> {
  const { tx } = a;
  const calls = tx.actions.some((x) => x.type === "FunctionCall");
  const creates = tx.actions.some((x) => x.type === "CreateAccount");
  if (receiver === null && !creates && !IMPLICIT.test(tx.receiverId)) {
    a.failure ??= "E_RECEIVER_MISSING";
  }
  if (calls && receiver !== null && !receiver.hasCode) a.failure ??= "E_NO_CONTRACT";

  // The signer must hold what it sends (fees are small on NEAR and not counted here).
  if (signer) {
    const out = a.movements
      .filter((m) => m.from === tx.signerId && m.asset === NATIVE && m.amount > 0n)
      .reduce((s, m) => s + m.amount, 0n);
    if (out > signer.amount) a.failure ??= "E_INSUFFICIENT_NEAR";
  }
  for (const m of a.movements.filter((x) => x.asset !== NATIVE && !x.viaVault && !x.kind)) {
    const balance = await deps.rpc.callView(
      m.asset,
      "ft_balance_of",
      { account_id: m.from },
      block,
    );
    if (typeof balance === "string" && BigInt(balance) < m.amount)
      a.failure ??= "E_INSUFFICIENT_TOKEN";
  }

  // A Baret vault: read its policy and predict its refusal before anything is signed.
  // Several calls in one transaction draw on one window, so each is checked against what
  // the earlier ones left (`drawn`). A vault whose policy or allowance cannot be read is
  // not vouched for: the request fails closed.
  const drawn = new Map<string, bigint>();
  const vaultCheck = async (vault: string, m: Movement): Promise<void> => {
    const [policy, remaining] = await Promise.all([
      readPolicy(deps, vault, block),
      deps.rpc.callView(vault, "get_remaining", { asset: m.asset }, block),
    ]);
    if (!policy || typeof remaining !== "string" || !/^\d+$/.test(remaining)) {
      a.failure ??= "E_VAULT_UNREADABLE";
      return;
    }
    const key = `${vault}|${m.asset}`;
    const before = drawn.get(key) ?? 0n;
    const left = BigInt(remaining) - before;
    const code = vaultRefusal(policy, tx.signerId, m, left < 0n ? 0n : left);
    if (code) a.failure ??= code;
    drawn.set(key, before + m.amount);
  };
  for (const m of a.movements.filter((x) => x.viaVault)) {
    await vaultCheck(m.viaVault as string, m);
  }

  // The vault says what it would sign (receiver, asset, worst-case cost); its policy says
  // whether it will. A vault with no get_evm_payload cannot sign EVM transfers.
  for (const e of a.evmSignatures) {
    const parts = (await deps.rpc.callView(e.vault, "get_evm_payload", { tx: e.tx }, block)) as {
      asset?: unknown;
      receiver?: unknown;
      max_cost?: unknown;
    } | null;
    if (
      !parts ||
      typeof parts.asset !== "string" ||
      typeof parts.receiver !== "string" ||
      typeof parts.max_cost !== "string"
    ) {
      a.failure ??= "E_BAD_EVM_TX";
      continue;
    }
    await vaultCheck(e.vault, {
      from: e.vault,
      to: parts.receiver,
      asset: parts.asset,
      amount: toBig(parts.max_cost),
    });
  }
  await vaultAdmin(a, deps, block);
  void input;
}

/**
 * Owner methods called on a Baret vault. From anyone but the owner (or, for
 * `accept_owner`, the pending owner) the vault refuses: predicted like its other refusals.
 * From the owner, a change that widens what the agents may spend is named, never passed
 * as Safe on its own: an owner agent that a prompt steered could loosen the very rules
 * that bound it. Tightening (removing, pausing, lowering) is not flagged.
 */
async function vaultAdmin(a: Analysis, deps: NearDeps, block: string): Promise<void> {
  const { tx } = a;
  const policies = new Map<string, VaultPolicy | null>();
  for (const c of a.vaultCalls) {
    if (!policies.has(c.vault)) policies.set(c.vault, await readPolicy(deps, c.vault, block));
    const p = policies.get(c.vault);
    if (!p) continue; // not a Baret vault: an ordinary call
    if (c.method === "accept_owner") {
      if ((p.pending_owner ?? null) !== tx.signerId) a.failure ??= "E_NOT_PENDING_OWNER";
      continue;
    }
    if (tx.signerId !== p.owner) {
      a.failure ??= "E_NOT_OWNER";
      continue;
    }
    const str = (k: string) => (typeof c.args[k] === "string" ? (c.args[k] as string) : null);
    const contract = c.vault;
    switch (c.method) {
      case "add_receiver": {
        const asset = str("asset");
        const receiver = str("receiver");
        if (asset && receiver && !mayPay(p, asset, receiver)) {
          a.drafts.push({
            code: "VAULT_RECEIVER_ADDED",
            values: { contract, recipient: receiver, asset: assetName(asset) },
            details: { asset },
          });
        }
        break;
      }
      case "add_agent": {
        const agent = str("agent");
        if (agent && !p.agents.includes(agent)) {
          a.drafts.push({ code: "VAULT_AGENT_ADDED", values: { contract, recipient: agent } });
        }
        break;
      }
      case "set_limit": {
        const asset = str("asset");
        const per = str("per_transfer");
        const day = str("per_day");
        if (!asset || !per || !day || !/^\d+$/.test(per) || !/^\d+$/.test(day)) break;
        const old = p.limits.find(([x]) => x === asset)?.[1];
        const raised =
          !old || BigInt(per) > BigInt(old.per_transfer) || BigInt(day) > BigInt(old.per_day);
        if (raised) {
          const decimals = asset === NATIVE ? YOCTO : 0;
          a.drafts.push({
            code: "VAULT_LIMIT_RAISED",
            values: {
              contract,
              asset: assetName(asset),
              amount: units(BigInt(per), decimals),
              cap: units(BigInt(day), decimals),
            },
            details: { asset, before: old ?? null, after: { per_transfer: per, per_day: day } },
          });
        }
        break;
      }
      case "set_paused":
        if (c.args.paused === false && p.paused) {
          a.drafts.push({ code: "VAULT_UNPAUSED", values: { contract } });
        }
        break;
      case "propose_owner": {
        const next = str("new_owner");
        if (next && next !== p.owner) {
          a.drafts.push({
            code: "AUTHORITY_CHANGE",
            values: { contract, recipient: next },
            details: { kind: "owner-transfer", method: c.method },
          });
        }
        break;
      }
      case "update_contract":
        a.drafts.push({
          code: "CONTRACT_DEPLOY_DETECTED",
          values: { address: contract },
          details: { method: c.method },
        });
        break;
    }
  }
}

/** How a vault asset id reads in a finding: NEAR, or the token contract / EVM chain id. */
function assetName(asset: string): string {
  return asset === NATIVE ? "NEAR" : asset;
}

/** A vault's policy, or null when it does not read as one (not a Baret vault). */
async function readPolicy(
  deps: NearDeps,
  vault: string,
  block: string,
): Promise<VaultPolicy | null> {
  const p = (await deps.rpc.callView(vault, "get_policy", {}, block)) as VaultPolicy | null;
  if (!p || typeof p !== "object") return null;
  if (!Array.isArray(p.limits) || !Array.isArray(p.agents) || !Array.isArray(p.receivers))
    return null;
  return p;
}

// ------------------------------------------------------------------ the signing key

/**
 * When the request names the key that will sign it (every borsh transaction does), read
 * that key. A key the account does not hold, or a function call key the transaction goes
 * past (another contract, a method it does not list, NEAR attached, any action but a
 * call), means NEAR will refuse it. For an agent it is also the proof that it signs with
 * the narrow key the owner gave it.
 */
async function keyCheck(
  a: Analysis,
  deps: NearDeps,
  signer: NearAccountState | null,
  block: string,
): Promise<void> {
  const { tx } = a;
  if (!tx.publicKey || !signer) return;
  const key = await deps.rpc.viewAccessKey(tx.signerId, tx.publicKey, block);
  if (key === null) {
    a.failure ??= "E_KEY_MISSING";
    return;
  }
  if (key.permission === "FullAccess") return;
  const fc = key.permission;
  const allowed = tx.actions.every(
    (x) =>
      x.type === "FunctionCall" &&
      BigInt(x.deposit) === 0n &&
      tx.receiverId === fc.receiverId &&
      (fc.methodNames.length === 0 || fc.methodNames.includes(x.methodName)),
  );
  if (!allowed) a.failure ??= "E_KEY_NOT_ALLOWED";
}

interface VaultPolicy {
  owner: string;
  /** Vault 0.2: the account `propose_owner` named, until it accepts. */
  pending_owner?: string | null;
  paused: boolean;
  agents: string[];
  /**
   * Vault 0.2: who each asset may pay, `[asset, [receiver…]]`. Vault 0.1 kept one list for
   * every asset (plain account ids); both are read.
   */
  receivers: ([string, string[]] | string)[];
  limits: [string, { per_transfer: string; per_day: string }][];
}

/** Whether the policy lets `asset` pay `to`, for either vault version. */
function mayPay(p: VaultPolicy, asset: string, to: string): boolean {
  return p.receivers.some((entry) =>
    typeof entry === "string" ? entry === to : entry[0] === asset && entry[1].includes(to),
  );
}

/** The vault's own checks, in its order (contracts/near/vault/src/lib.rs `check`). */
export function vaultRefusal(
  p: VaultPolicy,
  agent: string,
  m: Movement,
  remaining: bigint | null,
): string | null {
  if (p.paused) return "E_PAUSED";
  if (!p.agents.includes(agent)) return "E_NOT_AGENT";
  if (m.amount <= 0n) return "E_AMOUNT_ZERO";
  const limit = p.limits.find(([asset]) => asset === m.asset)?.[1];
  if (!limit) return "E_ASSET_NOT_ALLOWED";
  if (!mayPay(p, m.asset, m.to)) return "E_RECEIVER_NOT_ALLOWED";
  if (m.amount > BigInt(limit.per_transfer)) return "E_PER_TRANSFER_LIMIT";
  if (remaining !== null && m.amount > remaining) return "E_DAILY_LIMIT";
  return null;
}

// ------------------------------------------------------------------ detectors

async function detect(
  a: Analysis,
  deps: NearDeps,
  input: AdapterInput,
  receiver: NearAccountState | null,
  block: string,
): Promise<void> {
  const { tx } = a;
  const known = new Set([...deps.knownContracts, tx.signerId]);
  for (const asset of [input.chain.usdc, input.chain.wrappedNative]) {
    const ref = asset ? parseCaip19(asset.id)?.assetReference : undefined;
    if (ref) known.add(ref);
  }

  const calls = tx.actions.some((x) => x.type === "FunctionCall");
  if (calls && receiver?.hasCode && !known.has(tx.receiverId)) {
    a.drafts.push({ code: "UNKNOWN_CONTRACT_EXPOSURE", values: { contract: tx.receiverId } });
  }
  for (const contract of new Set(a.callReceivers)) {
    if (known.has(contract)) continue;
    const state = await deps.rpc.viewAccount(contract, block);
    if (state?.hasCode) {
      a.drafts.push({
        code: "UNKNOWN_CONTRACT_EXPOSURE",
        values: { contract },
        details: { via: "transfer_call" },
      });
    }
  }
  for (const ap of a.approvals) {
    const spender = await deps.rpc.viewAccount(ap.spender, block);
    const details = { standard: "nep178", tokenId: ap.tokenId };
    a.drafts.push(
      spender?.hasCode
        ? {
            code: "APPROVAL_GRANTED",
            values: { spender: ap.spender, amount: "1", asset: `${ap.contract} #${ap.tokenId}` },
            details,
          }
        : {
            code: "APPROVAL_TO_WALLET",
            values: { spender: ap.spender, contract: ap.contract },
            details,
          },
    );
  }

  const touched = new Set<string>([
    tx.receiverId,
    ...a.movements.filter((m) => !m.locked).map((m) => m.to),
    // The accounts an owner call would let a vault pay, add as an agent or hand over to.
    ...a.vaultCalls.flatMap((c) =>
      ["receiver", "agent", "new_owner"]
        .map((k) => c.args[k])
        .filter((v): v is string => typeof v === "string"),
    ),
  ]);
  for (const account of touched) {
    const reason = deps.flagged.get(account);
    if (reason !== undefined) {
      a.drafts.push({
        code: "KNOWN_MALICIOUS_ADDRESS",
        values: { address: account },
        details: { registry: { reasonCode: reason } },
      });
    }
  }
}

// ------------------------------------------------------------------ shared blocklist

/** Every account the request pays, calls, approves or names in a vault change. */
function touchedAccounts(a: Analysis): string[] {
  const { tx } = a;
  return [
    ...new Set<string>([
      tx.receiverId,
      ...a.movements.filter((m) => !m.locked).map((m) => m.to),
      ...a.approvals.map((x) => x.spender),
      ...a.callReceivers,
      ...a.vaultCalls.flatMap((c) =>
        ["receiver", "agent", "new_owner"]
          .map((k) => c.args[k])
          .filter((v): v is string => typeof v === "string"),
      ),
    ]),
  ].filter((x) => ACCOUNT_ID.test(x) || IMPLICIT.test(x));
}

/**
 * The shared blocklist (TN.14): one `get_flags` view at the pinned block. Flagged (the
 * owner confirmed it, or enough reporters agree): KNOWN_MALICIOUS_ADDRESS. Reported but
 * not flagged: COUNTERPARTY_REPORTED, a warning. The answer cannot be read: fail closed.
 */
async function blocklistCheck(
  a: Analysis,
  deps: NearDeps,
  block: string,
): Promise<SourceStatus | null> {
  if (!deps.blocklist) return null;
  const accounts = touchedAccounts(a).filter((x) => !deps.flagged.has(x));
  if (accounts.length === 0) return { name: "near-blocklist", status: "ok" };
  let flags: BlocklistFlag[] = [];
  try {
    for (let i = 0; i < accounts.length; i += BLOCKLIST_QUERY) {
      const got = await deps.rpc.callView(
        deps.blocklist,
        "get_flags",
        { accounts: accounts.slice(i, i + BLOCKLIST_QUERY) },
        block,
      );
      if (!Array.isArray(got)) throw new Error("get_flags");
      flags = flags.concat(got as BlocklistFlag[]);
    }
  } catch {
    a.drafts.push({ code: "REPUTATION_DATA_UNAVAILABLE", values: {} });
    return { name: "near-blocklist", status: "unavailable" };
  }
  for (const f of flags) {
    const details = {
      registry: {
        source: deps.blocklist,
        reasonCode: f.reason,
        evidence: f.evidence,
        reports: f.reports,
        confirmed: f.confirmed,
      },
    };
    a.drafts.push(
      f.flagged
        ? { code: "KNOWN_MALICIOUS_ADDRESS", values: { address: f.account }, details }
        : { code: "COUNTERPARTY_REPORTED", values: { address: f.account }, details },
    );
  }
  return { name: "near-blocklist", status: "ok" };
}

// ------------------------------------------------------------------ counterparties

/**
 * Who the request pays and which contracts it runs (TN.14): a receiver first used less
 * than 72 hours ago or never, a receiver the signer has never dealt with, a contract whose
 * code changed in the window. Baret's own contracts, the MPC contract, the signer and the
 * protected account are not counterparties; neither is a NEAR Intents deposit address
 * (fresh by design: the quote check covers it) nor the token contract a 1 yoctoNEAR
 * deposit goes to.
 */
async function counterparties(
  a: Analysis,
  deps: NearDeps,
  input: AdapterInput,
  receiver: NearAccountState | null,
  pin: { height: bigint; hash: string },
): Promise<SourceStatus[]> {
  const { tx } = a;
  const own = new Set([...deps.knownContracts, ...deps.mpcContracts, tx.signerId, a.user]);
  const payees = [
    ...new Set(
      a.movements
        .filter((m) => !m.locked && !m.swap && !m.attached && !own.has(m.to))
        .map((m) => m.to),
    ),
  ];
  const calls = tx.actions.some((x) => x.type === "FunctionCall");
  const contracts = [
    ...new Set([...(calls && receiver?.hasCode ? [tx.receiverId] : []), ...a.callReceivers]),
  ].filter((c) => !own.has(c));

  const sources: SourceStatus[] = [];
  let unavailable = false;
  if (!deps.history) {
    if (payees.length > 0) sources.push({ name: "near-history", status: "skipped" });
  } else if (payees.length > 0) {
    const history = deps.history;
    try {
      const seen = await Promise.all(
        payees.map(async (p) => ({
          p,
          h: await history.account(p),
          dealt: await history.dealtWith(tx.signerId, p),
        })),
      );
      for (const { p, h, dealt } of seen) {
        const fresh =
          h.transactions === 0 ||
          (h.firstSeenMs !== null && input.now * 1000 - h.firstSeenMs < FRESH_ACCOUNT_MS);
        if (fresh) {
          a.drafts.push({
            code: "REPUTATION_FRESH_ACCOUNT",
            values: { address: p },
            details: {
              transactions: h.transactions,
              firstSeenAt: h.firstSeenMs === null ? null : new Date(h.firstSeenMs).toISOString(),
            },
          });
        }
        if (!dealt) a.drafts.push({ code: "COUNTERPARTY_FIRST_PAYMENT", values: { address: p } });
      }
      sources.push({ name: "near-history", status: "ok" });
    } catch {
      unavailable = true;
      sources.push({ name: "near-history", status: "unavailable" });
    }
  }

  if (!deps.archive) {
    if (contracts.length > 0) sources.push({ name: "near-archival-rpc", status: "skipped" });
  } else if (contracts.length > 0) {
    const archive = deps.archive;
    const then = pin.height > CODE_WINDOW_BLOCKS ? pin.height - CODE_WINDOW_BLOCKS : 1n;
    try {
      for (const c of contracts) {
        const [now, before] = await Promise.all([
          c === tx.receiverId ? receiver : deps.rpc.viewAccount(c, pin.hash),
          codeThen(archive, c, then),
        ]);
        if (now?.hasCode && (before === null || before.codeHash !== now.codeHash)) {
          a.drafts.push({
            code: "CONTRACT_CODE_CHANGED_RECENTLY",
            values: { contract: c },
            details: { comparedWithBlock: then.toString() },
          });
        }
      }
      sources.push({ name: "near-archival-rpc", status: "ok" });
    } catch {
      unavailable = true;
      sources.push({ name: "near-archival-rpc", status: "unavailable" });
    }
  }
  if (unavailable) a.drafts.push({ code: "COUNTERPARTY_HISTORY_UNAVAILABLE", values: {} });
  return sources;
}

/**
 * An account's state at a past height. NEAR can skip a height (no block was produced), and
 * the node answers such a read with an error: the next lower heights are tried, a few.
 */
async function codeThen(
  archive: NearRpc,
  account: string,
  height: bigint,
): Promise<NearAccountState | null> {
  let last: unknown;
  for (let k = 0n; k < 5n; k++) {
    try {
      return await archive.viewAccount(account, height - k);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

// ------------------------------------------------------------------ policy rules

interface Balances {
  native: bigint | null;
  tokens: Map<string, bigint | null>;
}

async function balancesBefore(
  a: Analysis,
  deps: NearDeps,
  signer: NearAccountState | null,
  block: string,
): Promise<Balances> {
  const tokens = new Map<string, bigint | null>();
  for (const m of a.movements) {
    if (m.asset === NATIVE || tokens.has(m.asset) || m.viaVault || m.kind) continue;
    const v = await deps.rpc.callView(m.asset, "ft_balance_of", { account_id: a.user }, block);
    tokens.set(m.asset, typeof v === "string" ? BigInt(v) : null);
  }
  const native = signer && a.user === a.tx.signerId ? signer.amount : null;
  // DeleteAccount moves the whole balance.
  for (const m of a.movements) if (m.amount === -1n) m.amount = native ?? 0n;
  return { native, tokens };
}

/**
 * What the user's balance of `asset` changes by (negative: it goes down). A stake is not
 * a loss, but it does leave the spendable balance: `spendable` counts it.
 */
function delta(a: Analysis, asset: string, spendable = false): bigint {
  let d = 0n;
  for (const m of a.movements) {
    if (m.asset !== asset || m.viaVault || m.swap || m.kind) continue;
    if (m.locked && !spendable) continue;
    if (m.from === a.user) d -= m.amount;
    if (m.to === a.user) d += m.amount;
  }
  return d;
}

function rules(a: Analysis, input: AdapterInput, b: Balances, intents?: IntentsQuote): void {
  if (a.failure !== null) return; // a request that fails moves nothing
  const p = input.policy.core;
  if (p.maxLossPercent !== null) {
    let worst = 0;
    // A swap deposit is an exchange: what it loses is the gap between the quote's values.
    if (a.movements.some((m) => m.swap)) {
      const loss = quoteLossPercent(intents);
      if (loss === null) {
        a.drafts.push({
          code: "LOSS_PERCENT_UNAVAILABLE",
          values: {},
          rule: "core.maxLossPercent",
        });
        worst = -1;
      } else worst = loss;
    }
    for (const asset of new Set([
      NATIVE,
      ...a.movements.filter((m) => !m.viaVault && !m.swap && !m.kind).map((m) => m.asset),
    ])) {
      if (worst < 0) break;
      const d = delta(a, asset);
      if (d >= 0n) continue;
      const pre = asset === NATIVE ? b.native : (b.tokens.get(asset) ?? null);
      if (pre === null || pre === 0n) {
        a.drafts.push({
          code: "LOSS_PERCENT_UNAVAILABLE",
          values: {},
          rule: "core.maxLossPercent",
        });
        worst = -1;
        break;
      }
      worst = Math.max(worst, Number((-d * 1_000_000n) / pre) / 10_000);
    }
    if (worst > p.maxLossPercent) {
      a.drafts.push({
        code: "ESTIMATED_LOSS_EXCEEDS_MAX",
        values: { actual: pct(worst), limit: pct(p.maxLossPercent) },
        rule: "core.maxLossPercent",
      });
    }
  }
  for (const floor of p.minPostBalances) {
    const parsed = parseCaip19(floor.asset);
    if (!parsed || parsed.chain !== input.chain.id || parsed.assetNamespace !== "slip44") continue;
    if (b.native === null) {
      a.drafts.push({
        code: "POST_BALANCE_UNAVAILABLE",
        values: { asset: "NEAR" },
        rule: "core.minPostBalances",
      });
      continue;
    }
    const d = delta(a, NATIVE, true);
    const after = b.native + d;
    if (d < 0n && after < BigInt(floor.min)) {
      a.drafts.push({
        code: "POST_BALANCE_TOO_LOW",
        values: {
          actual: units(after < 0n ? 0n : after, YOCTO),
          limit: units(BigInt(floor.min), YOCTO),
          asset: "NEAR",
        },
        rule: "core.minPostBalances",
      });
    }
  }
}

// ------------------------------------------------------------------ NEAR Intents (TN.8)

/**
 * The quote that counts is the one 1Click registered for the deposit address, not the
 * one the request carries: an agent can be handed a forged quote (its own account as
 * recipient, an attacker's deposit address). Baret asks 1Click for the quote behind the
 * deposit address and checks that one. If 1Click cannot confirm it (unreachable, unknown
 * address, no client on this network) or the request's quote differs from it, the check
 * fails closed with INTENTS_QUOTE_UNVERIFIED and the registered quote, if any, is not used.
 */
async function confirmQuote(
  a: Analysis,
  sent: IntentsQuote,
  deps: NearDeps,
): Promise<IntentsQuote | undefined> {
  const address = sent.quote.depositAddress;
  if (!address) {
    a.drafts.push({ code: "INTENTS_QUOTE_INVALID", values: {} });
    return undefined;
  }
  const fail = (reason: string, extra: object = {}): undefined => {
    a.drafts.push({
      code: "INTENTS_QUOTE_UNVERIFIED",
      values: { address },
      details: { reason, ...extra },
    });
    return undefined;
  };
  if (!deps.intents) return fail("no-1click-on-this-network");
  const registered = await deps.intents.status(address);
  if (registered === "unavailable") return fail("1click-unreachable");
  if (registered === null) return fail("unknown-deposit-address");
  if (registered.status !== "PENDING_DEPOSIT") {
    a.drafts.push({
      code: "INTENTS_QUOTE_INVALID",
      values: {},
      details: { status: registered.status },
    });
    return undefined;
  }
  const q = registered.quote;
  const fields: [string, unknown, unknown][] = [
    ["recipient", sent.quoteRequest.recipient, q.quoteRequest.recipient],
    ["refundTo", sent.quoteRequest.refundTo, q.quoteRequest.refundTo],
    ["originAsset", sent.quoteRequest.originAsset, q.quoteRequest.originAsset],
    ["destinationAsset", sent.quoteRequest.destinationAsset, q.quoteRequest.destinationAsset],
    ["amountIn", sent.quote.amountIn, q.quote.amountIn],
    ["amountOut", sent.quote.amountOut, q.quote.amountOut],
  ];
  const differs = fields.filter(([, mine, theirs]) => mine !== theirs).map(([f]) => f);
  if (differs.length > 0) return fail("quote-differs-from-1click", { fields: differs });
  return q;
}

/**
 * The 1Click quote the transaction deposits into, as 1Click registered it (confirmQuote).
 * Who it pays, who it refunds and what it charges are in the quote, not in the
 * transaction, so they are checked here: the output and the refund must go to the signer
 * (an agent's own account), and the transaction must send exactly the quote's amount of
 * its origin asset to its deposit address.
 */
function intentsCheck(a: Analysis, q: IntentsQuote, now: number): void {
  const { quote, quoteRequest: r } = q;
  const deadline = quote.deadline ? Date.parse(quote.deadline) / 1000 : null;
  if (!quote.depositAddress || r.dry || (deadline !== null && deadline < now)) {
    a.drafts.push({ code: "INTENTS_QUOTE_INVALID", values: {} });
    return;
  }
  const parties: [string, string][] = [
    ["recipient", r.recipient],
    ["refundTo", r.refundTo],
  ];
  // One finding per code reaches the verdict, so both fields go in one draft.
  const wrong = parties.filter(([, account]) => account !== a.user);
  const first = wrong[0];
  if (first) {
    a.drafts.push({
      code: "INTENTS_RECIPIENT_MISMATCH",
      values: { recipient: first[1], address: a.user },
      details: { fields: wrong.map(([field]) => field), accounts: wrong.map(([, acc]) => acc) },
    });
  }
  for (const fee of r.appFees ?? []) {
    if (fee.fee > 0) {
      a.drafts.push({
        code: "INTENTS_APP_FEE",
        values: { amount: pct(fee.fee / 100), recipient: fee.recipient },
        details: { bps: fee.fee },
      });
    }
  }
  // NEAR-side origin assets are NEP-141 tokens ("nep141:wrap.near").
  const token = r.originAsset.startsWith("nep141:") ? r.originAsset.slice(7) : null;
  const deposit = a.movements.find(
    (m) =>
      m.to === quote.depositAddress &&
      m.from === a.tx.signerId &&
      m.asset === token &&
      m.amount === BigInt(quote.amountIn),
  );
  if (deposit) deposit.swap = true;
  else {
    a.drafts.push({
      code: "INTENTS_DEPOSIT_MISMATCH",
      values: { address: quote.depositAddress },
      details: { expected: { asset: r.originAsset, amount: quote.amountIn } },
    });
  }
}

/** The quote's value loss in percent (USD in vs USD out), or null when it has no prices. */
function quoteLossPercent(q?: IntentsQuote): number | null {
  const usdIn = Number(q?.quote.amountInUsd);
  const usdOut = Number(q?.quote.amountOutUsd);
  if (!Number.isFinite(usdIn) || !Number.isFinite(usdOut) || usdIn <= 0) return null;
  return Math.max(0, ((usdIn - usdOut) / usdIn) * 100);
}

// ------------------------------------------------------------------ x402

const HOUR = 3600;
const DAY = 86_400;

/** An agent payment: does the transaction pay what the 402 asked, inside the caps? */
function payment(a: Analysis, input: AdapterInput): void {
  const pay = input.payment;
  if (!pay) return;
  const req = pay.requirements;
  const x = input.policy.core.x402;
  // The payment is what the call pays, not the 1 yoctoNEAR `ft_transfer` attaches.
  const paid =
    a.movements.find((m) => m.amount > 0n && !m.attached && !m.kind) ??
    a.movements.find((m) => m.amount > 0n && !m.kind);
  if (!paid) {
    a.drafts.push({ code: "X402_SHAPE_INVALID", values: {} });
    return;
  }
  if (req.network !== input.chain.id) {
    a.drafts.push({
      code: "X402_NETWORK_MISMATCH",
      values: { expected: req.network, actual: input.chain.id },
    });
  }
  if (paid.to !== req.payTo) {
    a.drafts.push({
      code: "X402_DESTINATION_MISMATCH",
      values: { expected: req.payTo, actual: paid.to },
    });
  }
  const wanted = assetOf(req.asset, input.chain);
  if (wanted !== paid.asset) {
    a.drafts.push({
      code: "X402_ASSET_MISMATCH",
      values: { expected: wanted ?? req.asset, actual: paid.asset },
    });
  }
  if (BigInt(req.amount) !== paid.amount) {
    a.drafts.push({
      code: "X402_AMOUNT_MISMATCH",
      values: { expected: req.amount, actual: paid.amount.toString() },
    });
  }
  const { symbol, decimals } = assetMeta(input.chain, req.asset);
  if (!x.allowedAssets.includes(req.asset)) {
    a.drafts.push({
      code: "X402_ASSET_NOT_ALLOWED",
      values: { asset: symbol },
      rule: "core.x402.allowedAssets",
    });
  }
  if (x.requireMemo && !req.memo) {
    a.drafts.push({ code: "X402_MEMO_MISSING", values: {}, rule: "core.x402.requireMemo" });
  }
  const origin = new URL(pay.origin).origin;
  if (
    x.allowedMerchantOrigins.length > 0 &&
    !x.allowedMerchantOrigins.some((o) => new URL(o).origin === origin)
  ) {
    a.drafts.push({
      code: "X402_MERCHANT_NOT_ALLOWED",
      values: { origin },
      rule: "core.x402.allowedMerchantOrigins",
    });
  }
  const cap = x.caps.find((c) => c.asset === req.asset);
  if (!cap) return;
  const amount = paid.amount > BigInt(req.amount) ? paid.amount : BigInt(req.amount);
  const fmt = (v: bigint) => units(v, decimals);
  if (cap.perTx !== null && amount > BigInt(cap.perTx)) {
    a.drafts.push({
      code: "X402_PER_TX_CAP_EXCEEDED",
      values: { origin, actual: fmt(amount), cap: fmt(BigInt(cap.perTx)), asset: symbol },
      rule: "core.x402.caps",
    });
  }
  const windows = [
    { limit: cap.perHour, seconds: HOUR, code: "X402_HOURLY_CAP_EXCEEDED" },
    { limit: cap.perDay, seconds: DAY, code: "X402_DAILY_CAP_EXCEEDED" },
  ] as const;
  const set = windows.filter((w) => w.limit !== null);
  if (set.length > 0 && !pay.spendHistory) {
    a.drafts.push({ code: "X402_SPEND_HISTORY_UNAVAILABLE", values: {}, rule: "core.x402.caps" });
    return;
  }
  for (const w of set) {
    const spent = (pay.spendHistory ?? [])
      .filter(
        (s) =>
          s.asset === req.asset && s.timestamp > input.now - w.seconds && s.timestamp <= input.now,
      )
      .reduce((s, r) => s + BigInt(r.amount), 0n);
    if (spent + amount > BigInt(w.limit as string)) {
      a.drafts.push({
        code: w.code,
        values: {
          amount: fmt(amount),
          actual: fmt(spent + amount),
          cap: fmt(BigInt(w.limit as string)),
          asset: symbol,
        },
        rule: "core.x402.caps",
      });
    }
  }
}

// ------------------------------------------------------------------ helpers

/** "native" or the token contract for a CAIP-19 id on this chain; undefined otherwise. */
export function assetOf(id: string, chain: ChainConfig): string | undefined {
  const p = parseCaip19(id);
  if (!p || p.chain !== chain.id) return undefined;
  if (p.assetNamespace === "slip44") return NATIVE;
  if (p.assetNamespace === "nep141") return decodeAccount(p.assetReference);
  return undefined;
}

function assetMeta(chain: ChainConfig, id: string): { symbol: string; decimals: number } {
  if (chain.usdc?.id === id) return { symbol: chain.usdc.symbol, decimals: chain.usdc.decimals };
  if (chain.nativeAsset.id === id)
    return { symbol: chain.nativeAsset.symbol, decimals: chain.nativeAsset.decimals };
  return { symbol: assetOf(id, chain) ?? id, decimals: 0 };
}

function changes(a: Analysis, chain: ChainConfig, b: Balances): BalanceChange[] {
  const out: BalanceChange[] = [];
  const accounts = new Set<string>([
    a.user,
    ...a.movements.filter((m) => m.viaVault).map((m) => m.from),
  ]);
  for (const account of accounts) {
    // NFT and multi-token movements have findings of their own and no fungible balance.
    const fungible = a.movements.filter((m) => !m.kind);
    for (const asset of new Set([NATIVE, ...fungible.map((m) => m.asset)])) {
      let d = 0n;
      for (const m of fungible) {
        if (m.asset !== asset) continue;
        if (m.from === account) d -= m.amount;
        if (m.to === account) d += m.amount;
      }
      if (d === 0n) continue;
      const isNative = asset === NATIVE;
      const meta = isNative
        ? { symbol: chain.nativeAsset.symbol, decimals: chain.nativeAsset.decimals }
        : chain.usdc && assetOf(chain.usdc.id, chain) === asset
          ? { symbol: chain.usdc.symbol, decimals: chain.usdc.decimals }
          : { symbol: null, decimals: null };
      const before =
        account === a.user ? (isNative ? b.native : (b.tokens.get(asset) ?? null)) : null;
      // A balance cannot cover more than it holds: such a transaction fails on chain
      // (E_INSUFFICIENT_…), so there is no balance after it to report.
      const after = before === null || before + d < 0n ? null : before + d;
      out.push({
        account: `${chain.id}:${encodeAccount(account)}`,
        asset: {
          id: isNative ? chain.nativeAsset.id : `${chain.id}/nep141:${encodeAccount(asset)}`,
          kind: isNative ? "native" : "fungible",
          symbol: meta.symbol,
          decimals: meta.decimals,
        },
        before: before === null ? null : before.toString(),
        after: after === null ? null : after.toString(),
        delta: d.toString(),
      });
    }
  }
  return out;
}

/** CAIP-10 does not allow `_`: a NEAR account id writes it %5F (ADR-0011). */
export function encodeAccount(id: string): string {
  return id.replaceAll("_", "%5F");
}
export function decodeAccount(id: string): string {
  return id.replaceAll("%5F", "_").replaceAll("%5f", "_");
}

function toBig(s: string | null): bigint {
  if (s === null || !/^\d+$/.test(s))
    throw new InvalidRequestError("amount must be an integer string");
  return BigInt(s);
}

/** Base units → a short decimal string ("1.5"). */
export function units(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

function pct(p: number): string {
  return `${Number(p.toFixed(2))}%`;
}

function short(key: string): string {
  return key.length > 20 ? `${key.slice(0, 14)}…${key.slice(-4)}` : key;
}
