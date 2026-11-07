/**
 * @baret/demo-evm/wallet: the demo sites' wallet connection (EIP-6963 wallets through
 * wagmi). The store keeps one connection for every site; the wagmi engine loads only
 * when a visitor reaches for the wallet (store.ts). Ported from Metropolis
 * sites/kit/wallet without the Baret web wallet's window.
 */
export type { Address, Hex } from "viem";
export {
  BARET_EXTENSION_RDNS,
  type ConnectError,
  connectErrorOf,
  isBaretExtension,
  isBlockNotFound,
  type SendError,
  SendRefused,
  safeIcon,
  sendErrorOf,
} from "./errors.js";
export { exceeds, formatMon } from "./format.js";
export * from "./store.js";
export * from "./useSendFlow.js";
export * from "./useTokenBalance.js";
