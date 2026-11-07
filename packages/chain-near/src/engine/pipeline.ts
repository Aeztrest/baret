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
import type { NearRequest, NearTransaction } from "./request.js";
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
}

const NATIVE = "native";
const YOCTO = 24;
/** Implicit accounts (64 hex, or 0x + 40 hex for ETH-implicit) are created by a transfer. */
const IMPLICIT = /^([0-9a-f]{64}|0x[0-9a-f]{40})$/;

/** A transfer the request makes, from whoever pays it, in base units. */
interface Movement {
  from: string;
  to: string;
  /** "native" or the NEP-141 token contract. */
  asset: string;
  amount: bigint;
  /** A Baret vault pays it, not the signer. */
  viaVault?: string;
}

interface Analysis {
  tx: NearTransaction;
  user: string;
  movements: Movement[];
  drafts: FindingDraft[];
  /** Why the request would fail on chain, when the preflight can tell; null: it would not. */
  failure: string | null;
}

export async function analyzeNear(input: AdapterInput, deps: NearDeps): Promise<AdapterResult> {
  const tx = await toTransaction(input.request as NearRequest);
  const network = input.chain.id.split(":")[1];
  const user = input.account
    ? decodeAccount(parseCaip10(input.account)?.address ?? "")
    : tx.signerId;
  const pin = await deps.rpc.pin();
  const signer = await deps.rpc.viewAccount(tx.signerId, pin.hash);
  const receiver = await deps.rpc.viewAccount(tx.receiverId, pin.hash);

  const a: Analysis = { tx, user, movements: [], drafts: [], failure: null };
  if (signer === null) a.failure = "E_SIGNER_MISSING";

  readActions(a, deps);
  await preflight(a, deps, input, receiver, signer, pin.hash);
  detect(a, deps, input, receiver);

  const balances = await balancesBefore(a, deps, signer, pin.hash);
  rules(a, input, balances);
  if (input.payment) payment(a, input);

  if (a.failure !== null) {
    a.drafts.unshift({ code: "SIMULATION_FAILED", values: {}, details: { reason: a.failure } });
  }
  const sources: SourceStatus[] = [
    { name: "near-rpc", status: "ok" },
    { name: "reputation-registry", status: deps.flagged.size > 0 ? "ok" : "skipped" },
  ];
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
      case "CreateAccount":
      case "Stake":
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
  if (method === "execute_transfer" && str("receiver") && str("amount") && str("asset")) {
    a.movements.push({
      from: tx.receiverId,
      to: str("receiver") as string,
      asset: str("asset") as string,
      amount: toBig(str("amount")),
      viaVault: tx.receiverId,
    });
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
  for (const m of a.movements.filter((x) => x.asset !== NATIVE && !x.viaVault)) {
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
  for (const m of a.movements.filter((x) => x.viaVault)) {
    const vault = m.viaVault as string;
    const policy = (await deps.rpc.callView(vault, "get_policy", {}, block)) as VaultPolicy | null;
    if (!policy || !Array.isArray(policy.limits)) continue;
    const remaining = await deps.rpc.callView(vault, "get_remaining", { asset: m.asset }, block);
    const code = vaultRefusal(
      policy,
      tx.signerId,
      m,
      typeof remaining === "string" ? BigInt(remaining) : null,
    );
    if (code) a.failure ??= code;
  }
  void input;
}

interface VaultPolicy {
  owner: string;
  paused: boolean;
  agents: string[];
  receivers: string[];
  limits: [string, { per_transfer: string; per_day: string }][];
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
  if (!p.receivers.includes(m.to)) return "E_RECEIVER_NOT_ALLOWED";
  if (m.amount > BigInt(limit.per_transfer)) return "E_PER_TRANSFER_LIMIT";
  if (remaining !== null && m.amount > remaining) return "E_DAILY_LIMIT";
  return null;
}

// ------------------------------------------------------------------ detectors

function detect(
  a: Analysis,
  deps: NearDeps,
  input: AdapterInput,
  receiver: NearAccountState | null,
): void {
  const { tx } = a;
  const known = new Set([...deps.knownContracts, tx.signerId]);
  const usdc = input.chain.usdc ? parseCaip19(input.chain.usdc.id)?.assetReference : undefined;
  if (usdc) known.add(usdc);

  const calls = tx.actions.some((x) => x.type === "FunctionCall");
  if (calls && receiver?.hasCode && !known.has(tx.receiverId)) {
    a.drafts.push({ code: "UNKNOWN_CONTRACT_EXPOSURE", values: { contract: tx.receiverId } });
  }

  const touched = new Set<string>([tx.receiverId, ...a.movements.map((m) => m.to)]);
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
    if (m.asset === NATIVE || tokens.has(m.asset) || m.viaVault) continue;
    const v = await deps.rpc.callView(m.asset, "ft_balance_of", { account_id: a.user }, block);
    tokens.set(m.asset, typeof v === "string" ? BigInt(v) : null);
  }
  const native = signer && a.user === a.tx.signerId ? signer.amount : null;
  // DeleteAccount moves the whole balance.
  for (const m of a.movements) if (m.amount === -1n) m.amount = native ?? 0n;
  return { native, tokens };
}

/** What the user's balance of `asset` changes by (negative: it goes down). */
function delta(a: Analysis, asset: string): bigint {
  let d = 0n;
  for (const m of a.movements) {
    if (m.asset !== asset || m.viaVault) continue;
    if (m.from === a.user) d -= m.amount;
    if (m.to === a.user) d += m.amount;
  }
  return d;
}

function rules(a: Analysis, input: AdapterInput, b: Balances): void {
  if (a.failure !== null) return; // a request that fails moves nothing
  const p = input.policy.core;
  if (p.maxLossPercent !== null) {
    let worst = 0;
    for (const asset of new Set([
      NATIVE,
      ...a.movements.filter((m) => !m.viaVault).map((m) => m.asset),
    ])) {
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
    const d = delta(a, NATIVE);
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

// ------------------------------------------------------------------ x402

const HOUR = 3600;
const DAY = 86_400;

/** An agent payment: does the transaction pay what the 402 asked, inside the caps? */
function payment(a: Analysis, input: AdapterInput): void {
  const pay = input.payment;
  if (!pay) return;
  const req = pay.requirements;
  const x = input.policy.core.x402;
  const paid = a.movements.find((m) => m.amount > 0n);
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
    for (const asset of new Set([NATIVE, ...a.movements.map((m) => m.asset)])) {
      let d = 0n;
      for (const m of a.movements) {
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
      out.push({
        account: `${chain.id}:${encodeAccount(account)}`,
        asset: {
          id: isNative ? chain.nativeAsset.id : `${chain.id}/nep141:${encodeAccount(asset)}`,
          kind: isNative ? "native" : "fungible",
          symbol: meta.symbol,
          decimals: meta.decimals,
        },
        before: before === null ? null : before.toString(),
        after: before === null ? null : (before + d).toString(),
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
