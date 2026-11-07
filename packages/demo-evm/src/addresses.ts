import { getChain, getShowcase } from "@baret/chains";
import { parseCaip19 } from "@baret/core";
import type { Address } from "viem";

/**
 * The demo sites' addresses on Monad testnet, read from the chain registry
 * (packages/chains/deployments/monad-testnet.json, `showcase`): addresses are data,
 * never written in code (CLAUDE.md rule 5). Ported from Metropolis `@baret/demo`.
 */

export const DEMO_CHAIN = "eip155:10143" as const;
export const DEMO_CHAIN_ID = 10143;

const showcase = getShowcase(DEMO_CHAIN);
const at = (name: string): Address => {
  const entry = showcase[name];
  if (!entry) throw new Error(`demo-evm: no showcase entry ${name} on ${DEMO_CHAIN}`);
  return entry.address as Address;
};

const usdcId = getChain(DEMO_CHAIN)?.usdc?.id;
const usdc = usdcId ? parseCaip19(usdcId) : null;
if (!usdcId || !usdc) throw new Error(`demo-evm: ${DEMO_CHAIN} has no USDC in the registry`);

export const DEMO = {
  chain: DEMO_CHAIN,
  chainId: DEMO_CHAIN_ID,
  /** The real test USDC on Monad testnet (Circle), 6 decimals. */
  usdc: usdc.assetReference as Address,
  usdcId,
  /** A token that calls itself USDC and is not. On no list. */
  fakeUsdc: at("FakeUsdc"),
  /** Reported: what an attack site's approve button points at. */
  drainer: at("DemoDrainer"),
  /** Reported: the wallet everything the drainers take ends up in. */
  sink: at("DrainerSink"),
  novaswap: {
    /** dUSDC: worthless test dollars, 6 decimals, 100 per faucet call. */
    usdc: at("DemoUsdc"),
    router: at("NovaSwapRouter"),
    /** The attack router, ground to start and end like `router`. Reported. */
    lookalike: at("NovaSwapDrainer"),
    usdcDecimals: 6,
    /** dUSDC per MON. */
    rate: 3.2,
  },
  pixeldrop: {
    /** Night Shift, listed. 0.01 MON a piece, ten per wallet. */
    collection: at("NightShift"),
    priceWei: 10n ** 16n,
    perWallet: 10,
  },
  orbityield: {
    /** Listed. `stake()` returns oMON one to one. */
    pool: at("OrbitPool"),
    receipt: at("OrbitReceipt"),
    /** On no list. `stake()` keeps the MON and returns nothing. */
    silentPool: at("OrbitPoolSilent"),
  },
  claimhub: {
    /** Listed. `claim()` sends 2,410 HUB, as often as asked. */
    distributor: at("ClaimHubDistributor"),
    hub: at("ClaimHubToken"),
  },
  launchpad: {
    /** Listed. 0.01 to 1 MON, 1,000 LNTL per MON. */
    sale: at("LaunchSale"),
    token: at("LaunchToken"),
    /** On no list. Forwards every call with delegatecall to replaceable logic. */
    proxySale: at("LaunchSaleProxy"),
    proxyLogic: at("LaunchSaleLogic"),
  },
  scrybe: {
    /** The merchant's site, as its 402 names it. */
    origin: "https://scrybe.example",
    payTo: at("ScrybeMerchant"),
    /** 0.05 USDC per answer. */
    price: 50_000n,
    /** A wallet the 402 did not name, for "paid the wrong address". */
    otherWallet: at("OtherWallet"),
  },
} as const;
