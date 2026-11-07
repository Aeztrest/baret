/**
 * Metropolis's test fakes (apps/server/src/testing/fake.ts), ported for the parity tests:
 * an in-memory EVM node implementing the new `EvmRpc`, v1-shaped data sources, and the
 * same request and trace builders. Only the imports and the v1 types (declared here,
 * since @baret/guard 0.1.x is not a dependency) changed.
 */
import {
  type CallOutcome,
  type EvmRpc,
  KNOWN_EVENTS,
  KNOWN_FUNCTIONS,
  type RawCallFrame,
  RpcUnavailableError,
} from "@baret/chain-evm/engine";
import {
  type Address,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  type Hex,
  maxUint256,
  pad,
} from "viem";
import type { V1Deps, V1Request } from "./metropolis-v1.js";

/** v1 NetworkConfig (only what the analysis read). */
export interface V1NetworkConfig {
  network: "testnet" | "mainnet";
  chainId: number;
  rpcUrl: string;
  traceRpcUrl: string;
  usdcAddress: Address | null;
  reputationRegistryAddress: Address | null;
  knownContracts: Address[];
  paymentGuardFactoryAddress: Address | null;
  cleanverse: { apass: Address; policy: Address } | null;
}

export interface NansenProfile {
  trustLevel: "new" | "established" | "identified";
  flagged: boolean;
  freshWallet: boolean;
  whale: boolean;
}
export interface RegistryEntry {
  flagged: boolean;
  severity: number;
  reasonCode: string;
}
export interface Credential {
  expiresAt: number | null;
  countries: string[];
  tier: number;
}
export interface V1Sources {
  nansen: { lookup(a: readonly Address[]): Promise<Map<Address, NansenProfile>> } | null;
  registry: { lookup(a: readonly Address[]): Promise<Map<Address, RegistryEntry>> } | null;
  compliance: {
    lookup(a: readonly Address[]): Promise<Map<Address, Credential | null>>;
    gatedTokens(tokens: readonly Address[]): Promise<Address[]>;
  } | null;
}
type Sources = V1Sources;
type GuardPolicy = Record<string, unknown>;

/** The v1 Balanced template (@baret/guard 0.1.4 policy-templates.ts). */
export const BALANCED_POLICY = {
  requireSuccessfulSimulation: true,
  blockRiskyContracts: true,
  blockUnknownContractExposure: false,
  blockUnlimitedApprovals: true,
  blockSetApprovalForAll: true,
  blockPermit: true,
  blockSelfdestruct: true,
  blockDelegatecall: true,
  blockOwnershipTransfer: true,
  maxLossPercent: 50,
  minPostUsdcBalance: null,
  minPostNativeBalance: "0.1",
  blockKnownMalicious: true,
  minNansenTrustLevel: "new",
  requireComplianceCheck: false,
  allowedCountries: [],
  minComplianceTier: null,
  maxGas: 10_000_000,
  requireMemo: false,
  maxPerTxCap: "5",
  maxHourlyCap: "25",
  maxDailyCap: "100",
  allowedAssets: [] as string[],
  allowedMerchantOrigins: [] as string[],
  allowWarnings: true,
};

export const USER = "0x1111111111111111111111111111111111111111" as Address;
export const USDC = "0x2222222222222222222222222222222222222222" as Address;
export const DAPP = "0x3333333333333333333333333333333333333333" as Address;
export const PEER = "0x4444444444444444444444444444444444444444" as Address;
export const DRAINER = "0x5555555555555555555555555555555555555555" as Address;
export const FAKE_USDC = "0x6666666666666666666666666666666666666666" as Address;
export const NFT = "0x7777777777777777777777777777777777777777" as Address;
export const IMPL = "0x8888888888888888888888888888888888888888" as Address;
export const SHOP = "0x9999999999999999999999999999999999999999" as Address;

export const NOW = 1_800_000_000;
export const ONE_MON = 10n ** 18n;
export const ONE_USDC = 10n ** 6n;

export const network: V1NetworkConfig = {
  network: "testnet",
  chainId: 10143,
  rpcUrl: "http://fake",
  traceRpcUrl: "http://fake",
  usdcAddress: USDC,
  reputationRegistryAddress: null,
  knownContracts: [],
  paymentGuardFactoryAddress: null,
  cleanverse: null,
};

export const config: V1Deps["config"] = {
  networks: { testnet: network },
  verdictTtlSeconds: 30,
};

/** An in-memory chain. Everything defaults to an empty, healthy state. */
export class FakeRpc implements EvmRpc {
  native = new Map<Address, bigint>([[USER, 100n * ONE_MON]]);
  code = new Map<Address, Hex>();
  storage = new Map<string, Hex>();
  erc20 = new Map<string, bigint>([[`${USDC}:${USER}`, 1_000n * ONE_USDC]]);
  meta = new Map<Address, { symbol: string; decimals: number }>([
    [USDC, { symbol: "USDC", decimals: 6 }],
    [FAKE_USDC, { symbol: "USDC", decimals: 6 }],
  ]);
  outcome: CallOutcome = { ok: true, returnData: "0x" };
  frame: RawCallFrame | null = null;
  estimate: bigint | null = 50_000n;
  gasPrice = 100n * 10n ** 9n;
  down = false;
  balanceFails = false;

  private check() {
    if (this.down) throw new RpcUnavailableError("rpc down");
  }
  chainId = 10143;
  async getChainId() {
    this.check();
    return this.chainId;
  }
  async verifyChain() {
    this.check();
    if (this.chainId !== 10143) throw new RpcUnavailableError(`RPC is on chain ${this.chainId}`);
  }
  async getBlockNumber() {
    this.check();
    return 1_000n;
  }
  async getGasPrice() {
    return this.gasPrice;
  }
  async getBalance(a: Address) {
    if (this.balanceFails) throw new Error("balance read failed");
    return this.native.get(a) ?? 0n;
  }
  async getCode(a: Address) {
    return this.code.get(a) ?? "0x";
  }
  async getStorageAt(a: Address, slot: Hex) {
    return this.storage.get(`${a}:${slot}`) ?? "0x";
  }
  async call() {
    return this.outcome;
  }
  async estimateGas() {
    return this.estimate;
  }
  async traceCall() {
    return this.frame;
  }
  async erc20Balance(token: Address, owner: Address) {
    return this.erc20.get(`${token}:${owner}`) ?? 0n;
  }
  vaults = new Set<Address>();
  async factoryVaults(_factory: Address, addresses: readonly Address[]) {
    return addresses.filter((a) => this.vaults.has(a));
  }
  owners = new Map<string, Address>();
  async vaultOwner(vault: Address) {
    return this.owners.get(vault.toLowerCase()) ?? null;
  }
  async erc20Meta(token: Address) {
    return this.meta.get(token) ?? { symbol: null, decimals: null };
  }
}

/** Sources that answer "nothing known" for every address. */
export function cleanSources(
  overrides: {
    nansen?: Partial<Record<Address, Partial<NansenProfile>>> | null;
    registry?: Partial<Record<Address, RegistryEntry>> | null;
    compliance?: Partial<Record<Address, Credential | null>> | null;
    /** Tokens the compliance source reports as compliant assets. */
    gated?: Address[];
  } = {},
): Sources {
  const nansen = overrides.nansen === undefined ? {} : overrides.nansen;
  const registry = overrides.registry === undefined ? {} : overrides.registry;
  const compliance = overrides.compliance === undefined ? {} : overrides.compliance;
  return {
    nansen: nansen && {
      lookup: async (as) =>
        new Map(
          as.map((a) => [
            a,
            {
              trustLevel: "established",
              flagged: false,
              freshWallet: false,
              whale: false,
              ...nansen[a],
            },
          ]),
        ),
    },
    registry: registry && {
      lookup: async (as) =>
        new Map(as.map((a) => [a, registry[a] ?? { flagged: false, severity: 0, reasonCode: "" }])),
    },
    compliance: compliance && {
      lookup: async (as) => new Map(as.map((a) => [a, compliance[a] ?? null])),
      gatedTokens: async (tokens) => tokens.filter((t) => overrides.gated?.includes(t)),
    },
  };
}

export function deps(rpc: FakeRpc, sources: Sources = cleanSources()): V1Deps {
  return { config, rpcFor: () => rpc, sourcesFor: () => sources, now: () => NOW };
}

export const policy = (over: Partial<GuardPolicy> = {}): GuardPolicy => ({
  ...BALANCED_POLICY,
  allowedAssets: [USDC],
  ...over,
});

export const tx = (over: Record<string, unknown> = {}): V1Request => ({
  network: "testnet" as const,
  transaction: { from: USER, ...over },
  policy: policy(),
});

// ── calldata and trace builders ──

export const calldata = encodeFunctionData as unknown as (args: {
  abi: typeof KNOWN_FUNCTIONS;
  functionName: string;
  args: readonly unknown[];
}) => Hex;

export const approveData = (spender: Address, amount: bigint) =>
  calldata({ abi: KNOWN_FUNCTIONS, functionName: "approve", args: [spender, amount] });

export function log(
  address: Address,
  eventName: "Transfer" | "Approval" | "ApprovalForAll" | "OwnershipTransferred",
  args: Record<string, unknown>,
  data: { types: { type: string }[]; values: unknown[] },
) {
  const topics = encodeEventTopics({
    abi: KNOWN_EVENTS,
    eventName,
    args,
  } as Parameters<typeof encodeEventTopics>[0]) as Hex[];
  return { address, topics, data: encodeAbiParameters(data.types, data.values) };
}

export const transferLog = (token: Address, from: Address, to: Address, value: bigint) =>
  log(token, "Transfer", { from, to }, { types: [{ type: "uint256" }], values: [value] });

export const approvalLog = (token: Address, owner: Address, spender: Address, value: bigint) =>
  log(token, "Approval", { owner, spender }, { types: [{ type: "uint256" }], values: [value] });

export const frame = (f: Partial<RawCallFrame> & { to?: string }): RawCallFrame => ({
  type: "CALL",
  from: USER,
  value: "0x0",
  input: "0x",
  ...f,
});

export const implSlotValue = (impl: Address) => pad(impl, { size: 32 });
export { maxUint256 };
