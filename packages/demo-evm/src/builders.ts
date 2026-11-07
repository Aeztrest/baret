import { type Address, encodeFunctionData, type Hex, maxUint256, parseAbi } from "viem";
import { DEMO } from "./addresses.js";

/**
 * The transactions the demo sites build: the honest and the attack version of each
 * site's main button. Ported from Metropolis `@baret/demo` (novaswap.ts, sites.ts);
 * addresses come from the chain registry (addresses.ts).
 */

/** A call ready for `eth_sendTransaction`, or for Baret's check (request.ts). */
export interface DemoTx {
  from: Address;
  to: Address;
  /** Wei, decimal. */
  value: string;
  data: Hex;
}

export const DEMO_USDC_ABI = parseAbi([
  "function faucet()",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

/** The honest router; the look-alike copies `swapUsdcForMon`. */
export const NOVASWAP_ROUTER_ABI = parseAbi([
  "function swapMonForUsdc(uint256 minOut) payable returns (uint256)",
  "function swapUsdcForMon(uint256 amountIn, uint256 minOut) returns (uint256)",
  "function quoteMonForUsdc(uint256 monIn) pure returns (uint256)",
  "function quoteUsdcForMon(uint256 usdcIn) pure returns (uint256)",
]);

export const SITES_ABI = parseAbi([
  "function mint(uint256 count) payable",
  "function setApprovalForAll(address operator, bool approved)",
  "function stake() payable",
  "function claim()",
  "function contribute() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const tx = (from: Address, to: Address, data: Hex, value = 0n): DemoTx => ({
  from,
  to,
  value: value.toString(),
  data,
});

/** dUSDC base units for a MON amount in wei, at the router's fixed rate (rounds down). */
export function quoteMonForUsdc(monWei: bigint): bigint {
  return (monWei * 32n) / (10n * 10n ** 12n);
}

const N = DEMO.novaswap;

export const novaswap = {
  /** 100 dUSDC to `from`. */
  faucet: (from: Address) =>
    tx(from, N.usdc, encodeFunctionData({ abi: DEMO_USDC_ABI, functionName: "faucet" })),

  /** Honest: MON in, dUSDC out. No allowance needed. Baret: Safe. */
  swapMonForUsdc: (from: Address, monWei: bigint) =>
    tx(
      from,
      N.router,
      encodeFunctionData({
        abi: NOVASWAP_ROUTER_ABI,
        functionName: "swapMonForUsdc",
        args: [quoteMonForUsdc(monWei)],
      }),
      monWei,
    ),

  /** Honest sale, step 1: an allowance for exactly the amount sold. Baret: Caution. */
  approveExact: (from: Address, usdcAmount: bigint) =>
    tx(
      from,
      N.usdc,
      encodeFunctionData({
        abi: DEMO_USDC_ABI,
        functionName: "approve",
        args: [N.router, usdcAmount],
      }),
    ),

  /** Honest sale, step 2. */
  swapUsdcForMon: (from: Address, usdcAmount: bigint) =>
    tx(
      from,
      N.router,
      encodeFunctionData({
        abi: NOVASWAP_ROUTER_ABI,
        functionName: "swapUsdcForMon",
        args: [usdcAmount, 0n],
      }),
    ),

  /** Attack, step 1: "enable trading" = unlimited allowance to the look-alike. Baret: Blocked. */
  attackApprove: (from: Address) =>
    tx(
      from,
      N.usdc,
      encodeFunctionData({
        abi: DEMO_USDC_ABI,
        functionName: "approve",
        args: [N.lookalike, maxUint256],
      }),
    ),

  /** Attack, step 2: looks like a sale of `usdcAmount`; takes the whole balance. */
  attackSwap: (from: Address, usdcAmount: bigint) =>
    tx(
      from,
      N.lookalike,
      encodeFunctionData({
        abi: NOVASWAP_ROUTER_ABI,
        functionName: "swapUsdcForMon",
        args: [usdcAmount, 0n],
      }),
    ),
};

export const pixeldrop = {
  /** Honest: mint `count` pieces at 0.01 MON each. Baret: Safe. */
  mint: (from: Address, count: number) =>
    tx(
      from,
      DEMO.pixeldrop.collection,
      encodeFunctionData({ abi: SITES_ABI, functionName: "mint", args: [BigInt(count)] }),
      BigInt(count) * DEMO.pixeldrop.priceWei,
    ),

  /** Attack: "approve to list" opens the whole collection to the drainer. Baret: Blocked. */
  attackApproveAll: (from: Address) =>
    tx(
      from,
      DEMO.pixeldrop.collection,
      encodeFunctionData({
        abi: SITES_ABI,
        functionName: "setApprovalForAll",
        args: [DEMO.drainer, true],
      }),
    ),

  /** Closes what `attackApproveAll` opened. The demo sends it right after, so nothing stays open. */
  revokeApproveAll: (from: Address) =>
    tx(
      from,
      DEMO.pixeldrop.collection,
      encodeFunctionData({
        abi: SITES_ABI,
        functionName: "setApprovalForAll",
        args: [DEMO.drainer, false],
      }),
    ),
};

const stake = encodeFunctionData({ abi: SITES_ABI, functionName: "stake" });

export const orbityield = {
  /** Honest: MON in, oMON out one to one. Baret: Safe (an exchange with a listed pool). */
  stake: (from: Address, monWei: bigint) => tx(from, DEMO.orbityield.pool, stake, monWei),

  /** Attack: the same button on a pool nobody vouches for, which returns nothing. Baret: Blocked. */
  attackStake: (from: Address, monWei: bigint) =>
    tx(from, DEMO.orbityield.silentPool, stake, monWei),
};

export const claimhub = {
  /** Honest: 2,410 HUB arrive, nothing leaves but the fee. Baret: Safe. */
  claim: (from: Address) =>
    tx(
      from,
      DEMO.claimhub.distributor,
      encodeFunctionData({ abi: SITES_ABI, functionName: "claim" }),
    ),

  /** Attack: "verify your wallet to claim" is an unlimited USDC allowance to the drainer. Baret: Blocked. */
  attackApprove: (from: Address) =>
    tx(
      from,
      DEMO.usdc,
      encodeFunctionData({
        abi: SITES_ABI,
        functionName: "approve",
        args: [DEMO.drainer, maxUint256],
      }),
    ),

  /** Sets the drainer's USDC allowance back to zero. The demo sends it right after `attackApprove`. */
  revokeApprove: (from: Address) =>
    tx(
      from,
      DEMO.usdc,
      encodeFunctionData({ abi: SITES_ABI, functionName: "approve", args: [DEMO.drainer, 0n] }),
    ),
};

const contribute = encodeFunctionData({ abi: SITES_ABI, functionName: "contribute" });

export const launchpad = {
  /** Honest: the plain sale. Baret: Safe. */
  contribute: (from: Address, monWei: bigint) => tx(from, DEMO.launchpad.sale, contribute, monWei),

  /** The proxy sale: honest today, but the code is borrowed and replaceable. Baret: Blocked. */
  attackContribute: (from: Address, monWei: bigint) =>
    tx(from, DEMO.launchpad.proxySale, contribute, monWei),
};

const AGENT_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
]);

/** The transaction actions of the /agents playground; its payments are in x402.ts. */
export const agentCalls = {
  /** Unlimited USDC allowance to a contract on no list. */
  unlimitedAllowance: (from: Address) =>
    tx(
      from,
      DEMO.usdc,
      encodeFunctionData({
        abi: AGENT_ABI,
        functionName: "approve",
        args: [DEMO.orbityield.silentPool, maxUint256],
      }),
    ),

  /** Opens a whole collection to another wallet (not a reported one). */
  operatorApproval: (from: Address) =>
    tx(
      from,
      DEMO.pixeldrop.collection,
      encodeFunctionData({
        abi: AGENT_ABI,
        functionName: "setApprovalForAll",
        args: [DEMO.scrybe.payTo, true],
      }),
    ),

  /** Sends MON to a wallet on the registry blocklist. */
  flaggedAddress: (from: Address, monWei = 10n ** 17n) => tx(from, DEMO.sink, "0x", monWei),
};
