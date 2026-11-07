import { type Address, decodeEventLog, decodeFunctionData, type Hex, parseAbi } from "viem";

/**
 * The calls and events that carry most of the risk in a wallet request:
 * token movements, allowances, operator access and admin handovers.
 */
export const KNOWN_FUNCTIONS = parseAbi([
  "function transfer(address to, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
  "function approve(address spender, uint256 amount)",
  "function increaseAllowance(address spender, uint256 addedValue)",
  // Older OpenZeppelin and many deployed tokens name the same call this way.
  "function increaseApproval(address spender, uint256 addedValue)",
  // Permit2's on-chain allowance (AllowanceTransfer): the spender may pull
  // `amount` of `token` through Permit2 until `expiration`.
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "function setApprovalForAll(address operator, bool approved)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function transferOwnership(address newOwner)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function multicall(bytes[] data)",
  "function multicall(uint256 deadline, bytes[] data)",
  // PaymentGuard and CompliantPaymentGuard: the vault pays `merchant` for the agent.
  "function pay(address merchant, uint256 amount, bytes32 ref)",
]);

export const KNOWN_EVENTS = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)",
]);

/**
 * Allowances at or above the largest uint96 are unlimited for every practical
 * purpose: about 79 billion units of an 18-decimal token. The bar sits there, not
 * at 2^255, so that "max minus one" (2^255 - 1, 2^128) does not pass as a
 * bounded grant, and so that tokens which store allowances as uint96 and report
 * their own maximum in the Approval log are read as unlimited too.
 */
export const UNLIMITED_THRESHOLD = 2n ** 96n - 1n;

/** EIP-1967 implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1). */
export const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as Hex;

/**
 * keccak256("org.zeppelinos.proxy.implementation"): where the OpenZeppelin
 * proxies that predate EIP-1967 keep their implementation. Circle's USDC is
 * one of them.
 */
export const ZOS_IMPLEMENTATION_SLOT =
  "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3" as Hex;

/** The slots a standard upgradeable proxy keeps its implementation in. */
export const PROXY_IMPLEMENTATION_SLOTS = [
  EIP1967_IMPLEMENTATION_SLOT,
  ZOS_IMPLEMENTATION_SLOT,
] as const;

export type KnownCall = ReturnType<typeof decodeFunctionData<typeof KNOWN_FUNCTIONS>>;

export function selectorOf(data: string | undefined | null): Hex | null {
  if (!data || data.length < 10) return null;
  return data.slice(0, 10).toLowerCase() as Hex;
}

export function decodeKnownCall(data: Hex | undefined | null): KnownCall | null {
  if (!data || data.length < 10) return null;
  try {
    return decodeFunctionData({ abi: KNOWN_FUNCTIONS, data });
  } catch {
    return null;
  }
}

/** Inner calls of a multicall, one level deep and bounded, for the operation count. */
export function multicallInner(call: KnownCall | null, max = 50): Hex[] {
  if (call?.functionName !== "multicall") return [];
  const list = (call.args.length === 1 ? call.args[0] : call.args[1]) as readonly Hex[];
  return list.slice(0, max);
}

export type KnownEvent =
  | { name: "Transfer"; token: Address; from: Address; to: Address; value: bigint; nft: boolean }
  | { name: "Approval"; token: Address; owner: Address; spender: Address; value: bigint }
  /** ERC-721 single-item approval: `spender` may move the one item `tokenId`. */
  | { name: "ItemApproval"; token: Address; owner: Address; spender: Address; tokenId: bigint }
  | {
      name: "ApprovalForAll";
      token: Address;
      owner: Address;
      operator: Address;
      approved: boolean;
    }
  | { name: "OwnershipTransferred"; contract: Address; previousOwner: Address; newOwner: Address };

export function decodeKnownLog(log: {
  address: Address;
  topics: readonly Hex[];
  data: Hex;
}): KnownEvent | null {
  // ERC-721 Transfer and Approval carry the token id as a fourth topic.
  const nft = log.topics.length === 4;
  try {
    const ev = decodeEventLog({
      abi: KNOWN_EVENTS,
      topics: (nft ? log.topics.slice(0, 3) : log.topics) as [Hex, ...Hex[]],
      data: nft ? (log.topics[3] as Hex) : log.data,
      strict: true,
    });
    switch (ev.eventName) {
      case "Transfer":
        return { name: "Transfer", token: log.address, ...ev.args, nft };
      case "Approval":
        if (nft) {
          // ERC-721 single-item approval: not an allowance, but a grant all the same.
          const { owner, spender, value } = ev.args;
          return { name: "ItemApproval", token: log.address, owner, spender, tokenId: value };
        }
        return { name: "Approval", token: log.address, ...ev.args };
      case "ApprovalForAll":
        return { name: "ApprovalForAll", token: log.address, ...ev.args };
      case "OwnershipTransferred":
        return { name: "OwnershipTransferred", contract: log.address, ...ev.args };
    }
  } catch {
    return null;
  }
}
