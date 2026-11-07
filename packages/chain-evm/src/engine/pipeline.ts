import {
  type AdapterInput,
  type AdapterResult,
  type Allowance,
  type BalanceChange,
  InvalidRequestError,
  parseCaip10,
  type SourceStatus,
  toCaip10,
  toCaip19,
} from "@baret/core";
import { type Address, getAddress, isAddress, zeroAddress } from "viem";
import type {
  Credential,
  DelegateCall,
  EvmContext,
  EvmNetwork,
  FindingDraft,
  Lookup,
  RegistryEntry,
  ReputationProfile,
  TokenMeta,
} from "./analysis/context.js";
import {
  carriedCall,
  type EvmEffects,
  effectsFromCalldata,
  effectsFromTrace,
  effectsFromTypedData,
  namesAnotherChain,
} from "./analysis/effects.js";
import { tokenMeta, unknownToken } from "./analysis/format.js";
import { runDetectors } from "./detectors/index.js";
import { netDelta } from "./detectors/policy-rules.js";
import type { EvmRequest } from "./request.js";
import type { CallParams, EvmRpc } from "./rpc.js";
import { PROXY_IMPLEMENTATION_SLOTS } from "./simulation/abi.js";
import { decodeTransaction, type NormalizedTx } from "./simulation/decode.js";
import { type CallTrace, parseCallTrace } from "./simulation/trace.js";

/**
 * The EVM analysis: everything Metropolis's `application/analyze.ts` did up to the
 * decision. Reads the chain at one pinned block, simulates, builds `EvmContext`, runs the
 * detectors and policy rules, and returns finding drafts plus the balance changes and
 * allowances in core shapes. The engine decides (packages/engine).
 */

/** Bounds the reads one request can cause. */
const MAX_ADDRESSES = 40;

/** Where the reputation, registry and identity answers come from. Any can be null (off). */
export interface EvmSources {
  /** Reputation provider (Nansen today). `name` is how it appears in the verdict's sources. */
  reputation: {
    name: string;
    lookup(a: readonly Address[]): Promise<Map<Address, ReputationProfile>>;
  } | null;
  registry: { lookup(a: readonly Address[]): Promise<Map<Address, RegistryEntry>> } | null;
  compliance: {
    lookup(a: readonly Address[]): Promise<Map<Address, Credential | null>>;
    /** Which of these tokens are compliant assets (move only between credential holders). */
    gatedTokens(tokens: readonly Address[]): Promise<Address[]>;
  } | null;
}

export interface EvmDeps {
  network: EvmNetwork;
  rpc: EvmRpc;
  sources: EvmSources;
  /** The most gas one transaction may use on this chain (Monad: 30M); null: no limit known. */
  maxTxGas: bigint | null;
}

async function lookup<T>(
  source: { lookup(a: readonly Address[]): Promise<Map<Address, T>> } | null,
  addresses: Address[],
): Promise<Lookup<T>> {
  if (!source) return { status: "unavailable", data: null };
  if (addresses.length === 0) return { status: "ok", data: new Map() };
  try {
    return { status: "ok", data: await source.lookup(addresses) };
  } catch {
    return { status: "unavailable", data: null };
  }
}

const uniq = (xs: (Address | null | undefined)[]): Address[] => [
  ...new Set(xs.filter((x): x is Address => Boolean(x))),
];

function accountAddress(input: AdapterInput): Address | null {
  if (input.account === null) return null;
  const parsed = parseCaip10(input.account);
  if (!parsed || parsed.chain !== input.chain.id || !isAddress(parsed.address, { strict: false })) {
    throw new InvalidRequestError(`account must be an address on ${input.chain.id}`);
  }
  return getAddress(parsed.address);
}

export async function analyzeEvm(input: AdapterInput, deps: EvmDeps): Promise<AdapterResult> {
  const { network, rpc, sources } = deps;
  const request = input.request as EvmRequest;
  const policy = input.policy;
  const account = accountAddress(input);

  await rpc.verifyChain();
  const block = await rpc.getBlockNumber();

  // 1. Simulate, or read the signed message.
  let tx: NormalizedTx | null = null;
  let user: Address;
  let effects: EvmEffects;
  let trace: CallTrace | null = null;
  let simulation: EvmContext["simulation"] = {
    ran: false,
    ok: true,
    revertReason: null,
    revertData: null,
    traced: false,
    gasLimit: null,
  };
  let feeWei: bigint | null = null;

  /** Runs a call on the node and reads what it does to `who`. */
  const simulate = async (call: NormalizedTx, who: Address, paysFee: boolean) => {
    const params: CallParams = {
      from: call.from,
      to: call.to,
      data: call.data,
      value: call.value,
      gas: call.gas,
    };
    const [outcome, estimate, frame, gasPrice] = await Promise.all([
      rpc.call(params, block),
      rpc.estimateGas(params, block),
      rpc.traceCall(params, block),
      call.gasPrice ?? rpc.getGasPrice(),
    ]);
    const traced = parseCallTrace(frame);
    const gasLimit = call.gas ?? estimate;
    return {
      trace: traced,
      simulation: {
        ran: true,
        ok: outcome.ok,
        revertReason: outcome.ok ? null : outcome.revertReason,
        revertData: outcome.ok ? null : outcome.revertData,
        traced: traced !== null,
        gasLimit,
      },
      // Whoever relays a signed call pays for it, not the account that signed.
      feeWei: !paysFee ? 0n : gasLimit !== null ? gasLimit * gasPrice : null,
      effects:
        traced && outcome.ok ? effectsFromTrace(traced, who) : effectsFromCalldata(call, who),
    };
  };

  if (request.kind === "call" || request.kind === "raw") {
    try {
      tx = await decodeTransaction(
        request.kind === "call" ? request.tx : { raw: request.raw },
        network.chainId,
        account,
      );
    } catch (err) {
      throw new InvalidRequestError(err instanceof Error ? err.message : String(err));
    }
    user = account ?? tx.from;
    // Nobody signs as the zero address: such a request is malformed, not safe.
    if (tx.from === zeroAddress || user === zeroAddress) {
      throw new InvalidRequestError("the sender cannot be the zero address");
    }
    if (deps.maxTxGas !== null && tx.gas !== null && tx.gas > deps.maxTxGas) {
      throw new InvalidRequestError(
        `gas limit ${tx.gas} is above ${network.chain.name}'s limit of ${deps.maxTxGas} for one transaction`,
      );
    }
    ({ trace, simulation, feeWei, effects } = await simulate(tx, user, true));
  } else {
    const typedData = request.typedData;
    // A message that carries a call is not guessed at: its call is simulated, exactly as
    // a transaction's would be.
    if (getAddress(typedData.signer) === zeroAddress) {
      throw new InvalidRequestError("the signer cannot be the zero address");
    }
    const carried = carriedCall(typedData);
    if (carried) {
      tx = carried.tx;
      user = carried.user;
      ({ trace, simulation, feeWei, effects } = await simulate(carried.tx, carried.user, false));
      effects.signature = {
        kind: "read",
        reason: null,
        valueBearing: false,
        wrongChain: namesAnotherChain(typedData, network.chainId),
        verifier: carried.verifier,
      };
    } else {
      user = getAddress(typedData.signer);
      effects = effectsFromTypedData(typedData, network.chainId);
    }
  }

  const payment = input.payment;
  const payTo =
    payment && isAddress(payment.requirements.payTo, { strict: false })
      ? getAddress(payment.requirements.payTo)
      : null;
  const paymentAsset = (() => {
    if (!payment) return null;
    const ref = payment.requirements.asset.split(":").pop() ?? "";
    return isAddress(ref, { strict: false }) ? getAddress(ref) : null;
  })();

  // 2. Who and what the request reaches.
  const counterparties = uniq([
    tx?.to,
    ...effects.approvals.map((a) => a.spender),
    ...(effects.itemApprovals ?? []).map((a) => a.spender),
    ...effects.transfers.filter((t) => t.from === user).map((t) => t.to),
    // Whoever ends up with value, whoever paid it: the merchant a vault pays for the
    // agent, the recipient of an order's consideration. A drainer is a drainer however
    // the money reaches it.
    ...effects.paidAddresses,
    ...effects.ownership.map((o) => o.newOwner),
    // A message Baret cannot read is still meant for a contract: checked like any counterparty.
    effects.signature?.kind === "unread" ? effects.signature.verifier : null,
    payTo,
  ]).filter((a) => a !== user);
  const recipients = uniq(
    effects.transfers.filter((t) => t.from === user && t.to !== user).map((t) => t.to),
  );
  // Grantees first: whether a spender has code decides a finding of its own, so it is
  // never the one cut off by the bound.
  const grantees = uniq([
    ...effects.approvals.map((a) => a.spender),
    ...(effects.itemApprovals ?? []).map((a) => a.spender),
  ]);
  const candidates = uniq([
    ...grantees,
    ...(trace?.touched ?? []),
    ...effects.approvals.map((a) => a.contract),
    ...counterparties,
  ])
    .filter((a) => a !== user)
    .slice(0, MAX_ADDRESSES);

  const allowedAssetAddresses = policy.core.x402.allowedAssets
    .map((id) => id.split(":").pop() ?? "")
    .filter((a) => isAddress(a, { strict: false }))
    .map((a) => getAddress(a));
  // Collections are asked too: they have a symbol to show, though no decimals.
  const tokenAddresses = uniq([
    ...effects.approvals.map((a) => a.contract),
    ...effects.transfers.map((t) => t.token),
    network.usdcAddress,
    paymentAsset,
    ...(payment ? allowedAssetAddresses : []),
  ]).slice(0, MAX_ADDRESSES);

  const frames = trace?.frames.filter((f) => !f.reverted) ?? [];
  // Reverted delegatecalls are kept: when the whole call fails, a proxy's implementation
  // should still not be reported as an unknown contract.
  const delegateFrames = (trace?.frames ?? []).filter((f) => f.type === "DELEGATECALL" && f.to);
  const selfdestructs = frames.filter((f) => f.type === "SELFDESTRUCT").map((f) => f.from);
  const balanceTokens = uniq([...effects.transfers.map((t) => t.token), network.usdcAddress]);

  const [codes, metas, implSlots, nativeBefore, tokenBefore] = await Promise.all([
    Promise.all(candidates.map((a) => rpc.getCode(a, block))),
    Promise.all(tokenAddresses.map((t) => rpc.erc20Meta(t))),
    Promise.all(
      delegateFrames.map((f) =>
        Promise.all(
          PROXY_IMPLEMENTATION_SLOTS.map((slot) => rpc.getStorageAt(f.from, slot, block)),
        ),
      ),
    ),
    rpc.getBalance(user, block).catch(() => null),
    Promise.all(balanceTokens.map((t) => rpc.erc20Balance(t, user, block))),
  ]);

  const contracts = candidates.filter((_, i) => (codes[i] ?? "0x") !== "0x");
  // Read and found empty: an account nobody deployed code to (a wallet).
  const codeless = candidates.filter((_, i) => codes[i] === "0x");

  // A compliant asset demands identity on both sides by itself; ask about it even when
  // the user's rules do not. If the question fails, the simulation still shows whether
  // the asset refuses the transfer.
  const sentTokens = uniq(effects.transfers.filter((t) => t.from === user).map((t) => t.token));
  const gatedAssets =
    sources.compliance && sentTokens.length > 0
      ? await sources.compliance.gatedTokens(sentTokens).catch(() => [])
      : [];
  // Vaults from Baret's own factory are known contracts, like the listed ones.
  const factory = network.paymentGuardFactoryAddress;
  const listed = new Set(network.knownContracts);
  const vaults = factory
    ? await rpc.factoryVaults(
        factory,
        contracts.filter((c) => !listed.has(c)),
        block,
      )
    : [];
  // The identity provider's own contracts and the compliant assets they govern are known too.
  const cleanverseContracts = network.cleanverse
    ? [network.cleanverse.apass, network.cleanverse.policy, ...gatedAssets]
    : [];
  const knownNetwork: EvmNetwork = {
    ...network,
    knownContracts: [
      ...network.knownContracts,
      ...(factory === null ? [] : [factory, ...vaults]),
      ...cleanverseContracts,
    ],
  };
  const tokens = new Map<Address, TokenMeta>();
  const symbols = new Map<Address, string>();
  tokenAddresses.forEach((t, i) => {
    const m = metas[i];
    if (m?.symbol) symbols.set(t, m.symbol);
    if (m?.symbol && m.decimals !== null) tokens.set(t, { symbol: m.symbol, decimals: m.decimals });
  });
  const delegateCalls: DelegateCall[] = delegateFrames.map((f, i) => {
    const target = f.to?.toLowerCase();
    const standardProxy = (implSlots[i] ?? []).some(
      (slot) => slot.length >= 42 && `0x${slot.slice(-40)}`.toLowerCase() === target,
    );
    return { contract: f.from, codeFrom: f.to as Address, standardProxy, reverted: f.reverted };
  });

  // 3. Reputation and identity.
  const reputationTargets = uniq([...counterparties, ...contracts]).slice(0, MAX_ADDRESSES);
  // The provider is asked about wallets only: contracts are deployed, not funded or
  // labelled like people, and every call costs credits.
  const contractSet = new Set(contracts);
  const providerTargets = counterparties.filter((a) => !contractSet.has(a));
  const c = policy.core.compliance;
  const complianceActive =
    gatedAssets.length > 0 || c.required || c.allowedCountries.length > 0 || c.minTier !== null;
  const [reputation, registry, compliance] = await Promise.all([
    lookup(sources.reputation, providerTargets),
    lookup(sources.registry, reputationTargets),
    complianceActive && recipients.length > 0
      ? lookup(sources.compliance, uniq([user, ...recipients]))
      : Promise.resolve<Lookup<never>>({ status: "skipped", data: null }),
  ]);

  const ctx: EvmContext = {
    network: knownNetwork,
    policy,
    now: input.now,
    user,
    tx,
    simulation,
    trace,
    effects,
    delegateCalls,
    selfdestructs,
    contracts,
    codeless,
    counterparties,
    recipients,
    tokens,
    balancesBefore: {
      native: nativeBefore,
      tokens: new Map(balanceTokens.map((t, i) => [t, tokenBefore[i] ?? null])),
    },
    feeWei,
    reputation,
    registry,
    compliance,
    gatedAssets,
    payment,
  };

  // 4. Detect. The engine decides.
  const drafts = runDetectors(ctx);
  return {
    drafts,
    estimatedChanges: balanceChanges(ctx, symbols),
    allowances: allowances(ctx, symbols),
    sources: sourceStatuses(ctx, sources, drafts),
    pinnedAt: { kind: "block", value: block.toString() },
    simulation: simulation.traced ? "trace" : "none",
    confidence: !simulation.ok ? "low" : simulation.ran && simulation.traced ? "high" : "medium",
  };
}

// ---------------------------------------------------------------------------
// Results in core shapes

const nativeId = (ctx: EvmContext) => ctx.network.chain.nativeAsset.id;
const tokenId = (ctx: EvmContext, token: Address, nft = false) =>
  toCaip19(ctx.network.chain.id, nft ? "erc721" : "erc20", token);
const accountId = (ctx: EvmContext, a: Address) => toCaip10(ctx.network.chain.id, a);

function balanceChanges(ctx: EvmContext, symbols: Map<Address, string>): BalanceChange[] {
  const assets = uniq(ctx.effects.transfers.filter((t) => !t.nft).map((t) => t.token));
  const rows: BalanceChange[] = [];
  const row = (token: Address | null) => {
    const delta = netDelta(ctx, token);
    if (delta === null || (delta === 0n && token !== null)) return;
    const meta = tokenMeta(ctx, token);
    const pre =
      token === null ? ctx.balancesBefore.native : (ctx.balancesBefore.tokens.get(token) ?? null);
    // A balance cannot go below zero: a request that takes more than the account holds
    // leaves it empty, and the loss rules say the rest.
    const post = pre === null ? null : pre + delta < 0n ? 0n : pre + delta;
    rows.push({
      account: accountId(ctx, ctx.user),
      asset: {
        id: token === null ? nativeId(ctx) : tokenId(ctx, token),
        kind: token === null ? "native" : "fungible",
        symbol: meta.symbol,
        decimals: meta.decimals,
      },
      before: pre?.toString() ?? null,
      after: post?.toString() ?? null,
      delta: delta.toString(),
    });
  };
  if (ctx.tx || ctx.effects.transfers.some((t) => t.token === null)) row(null);
  for (const token of assets) row(token);
  rows.push(...collectibleChanges(ctx, symbols));
  return rows;
}

/**
 * Collectibles (ERC-721) the request moves in or out of the user's account: one row per
 * piece, delta 1 or -1, the token id on the asset. A piece has no balance before or after.
 */
function collectibleChanges(ctx: EvmContext, symbols: Map<Address, string>): BalanceChange[] {
  const net = new Map<string, { token: Address; tokenId: bigint; delta: bigint }>();
  for (const t of ctx.effects.transfers) {
    if (!t.nft || t.token === null || t.from === t.to) continue;
    // For a collectible the log's value is the token id. A move read from calldata alone
    // carries no id: it is listed as one piece.
    const key = `${t.token}:${ctx.effects.source === "trace" ? t.amount : "?"}`;
    const entry = net.get(key) ?? { token: t.token, tokenId: t.amount, delta: 0n };
    if (t.to === ctx.user) entry.delta += 1n;
    if (t.from === ctx.user) entry.delta -= 1n;
    net.set(key, entry);
  }
  return [...net.values()]
    .filter((e) => e.delta !== 0n)
    .map((e) => ({
      account: accountId(ctx, ctx.user),
      asset: {
        id: tokenId(ctx, e.token, true),
        kind: "nft" as const,
        symbol: symbols.get(e.token) ?? unknownToken(e.token).symbol,
        decimals: 0,
        ...(ctx.effects.source === "trace" ? { tokenId: e.tokenId.toString() } : {}),
      },
      before: null,
      after: null,
      delta: e.delta.toString(),
    }));
}

function allowances(ctx: EvmContext, symbols: Map<Address, string>): Allowance[] {
  return ctx.effects.approvals.map((a) => ({
    owner: accountId(ctx, ctx.user),
    spender: accountId(ctx, a.spender),
    asset: {
      id: tokenId(ctx, a.contract, a.kind === "operator"),
      kind: a.kind === "operator" ? "nft" : "fungible",
      symbol: symbols.get(a.contract) ?? null,
      decimals: ctx.tokens.get(a.contract)?.decimals ?? null,
    },
    amount: a.amount?.toString() ?? null,
    unlimited: a.unlimited,
    scope: a.kind === "operator" ? "collection" : "token",
    via: a.kind === "permit" ? "signature" : "transaction",
    expiresAt: null,
  }));
}

function sourceStatuses(
  ctx: EvmContext,
  sources: EvmSources,
  drafts: FindingDraft[],
): SourceStatus[] {
  const reputationUsed = drafts.some((f) => f.code === "REPUTATION_DATA_UNAVAILABLE");
  const status = (configured: boolean, l: Lookup<unknown>, needed: boolean) =>
    !configured && !needed ? "skipped" : l.status;
  return [
    { name: "rpc", status: "ok" },
    {
      name: sources.reputation?.name ?? "reputation-provider",
      status: status(sources.reputation !== null, ctx.reputation, reputationUsed),
    },
    {
      name: "reputation-registry",
      status: status(sources.registry !== null, ctx.registry, reputationUsed),
    },
    { name: "compliance", status: ctx.compliance.status },
  ];
}
