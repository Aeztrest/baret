import { demoFrame } from "@baret/content";
import { DEMO_ACCOUNT, DEMO_CHAIN_ID } from "@baret/demo-evm";
import {
  type Address,
  addressOf,
  isBaretExtension,
  useWallet,
  type WalletOption,
  type WalletState,
} from "@baret/demo-evm/wallet";

/**
 * The address a demo site checks from, and how much MON it holds. Ported from
 * Metropolis without the Baret web wallet's window: the connected wallet, else the
 * developer fallback address.
 */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const envFrom: unknown = import.meta.env.VITE_BARET_DEMO_FROM;

/** A developer's fallback address (VITE_BARET_DEMO_FROM), shown in place of a wallet. */
export const DEMO_FROM: Address | null =
  typeof envFrom === "string" && ADDRESS.test(envFrom) ? (envFrom as Address) : null;

/**
 * The address "Check it live" checks from for a visitor with no wallet: the fallback
 * when set, else Baret's demo account on Monad testnet (chain registry, showcase).
 */
export const DEMO_CHECK_FROM: Address = DEMO_FROM ?? DEMO_ACCOUNT;

export const MONAD_TESTNET_ID = DEMO_CHAIN_ID;

export interface DemoWallet {
  readonly wallet: WalletState;
  /** Who the site checks from: the connected wallet, else the fallback address. */
  readonly from: Address | null;
  /** True when there is an address to check from. */
  readonly live: boolean;
  /** MON in wei for `from`, when a wallet is connected and its balance was read. */
  readonly balance: bigint | null;
  /** True when the address is the fallback, not a wallet. */
  readonly demo: boolean;
  readonly walletConnected: boolean;
}

export function useDemoWallet(): DemoWallet {
  const wallet = useWallet();
  const connected = addressOf(wallet);
  const from = connected ?? DEMO_FROM;
  return {
    wallet,
    from,
    live: from !== null,
    balance: connected ? wallet.balance : null,
    demo: connected === null && from !== null,
    walletConnected: connected !== null,
  };
}

export function isDemoAddress(from: Address | null): boolean {
  return from !== null && (from === DEMO_FROM || from === DEMO_CHECK_FROM);
}

/** A wallet's name on the sites: its own, except the Baret extension's. */
export function walletLabel(option: Pick<WalletOption, "id" | "name">): string {
  return isBaretExtension(option.id) ? demoFrame.wallet.extension.name : option.name;
}

export { exceeds, formatMon } from "@baret/demo-evm/wallet";
