import { decodeErrorResult, type Hex, parseAbi } from "viem";

/**
 * What a revert says, when the contract said it with an error Baret knows.
 *
 * A node answers a failed call with the error's four-byte selector and its
 * arguments, not with words. Solidity's own `Error(string)` and `Panic` are
 * read as they are; the custom errors of Baret's vaults (PaymentGuard and
 * CompliantPaymentGuard) are named and put in a sentence, so an agent whose
 * payment went over a cap is told which cap, not "an unknown reason".
 */

const ERRORS = parseAbi([
  "error Error(string reason)",
  "error Panic(uint256 code)",
  // PaymentGuard
  "error NotOwner()",
  "error NotAgent()",
  "error ZeroAddress()",
  "error ZeroAmount()",
  "error InvalidCaps()",
  "error UnknownMerchant()",
  "error MerchantPaused()",
  "error ExceedsPerTxCap()",
  "error ExceedsHourlyCap()",
  "error ExceedsDailyCap()",
  "error TooManyPayments()",
  "error InsufficientUnreserved(uint256 available)",
  "error TokenCallFailed()",
  "error Reentrancy()",
  // CompliantPaymentGuard
  "error NotCompliantAsset(address asset)",
  "error MerchantNotListed(address merchant)",
  "error MerchantIsPaused(address merchant)",
  "error PerTxCapExceeded(uint256 amount, uint256 cap)",
  "error DailyCapExceeded(uint256 wouldSpend, uint256 cap)",
  "error NotVerified(address party, uint8 reason)",
  "error RefusedByPolicy(address from, address to)",
  "error TransferFailed()",
  // DemoUSDC (dUSDC), Baret's own test token
  "error NotMinter()",
  "error MinterAlreadySet()",
  "error InsufficientBalance()",
  "error InsufficientAllowance()",
  // OpenZeppelin v5 ERC-20 (the most common token code on Monad)
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InvalidSender(address sender)",
  "error ERC20InvalidReceiver(address receiver)",
  "error ERC20InvalidApprover(address approver)",
  "error ERC20InvalidSpender(address spender)",
  // OpenZeppelin v5 ERC-721
  "error ERC721InsufficientApproval(address operator, uint256 tokenId)",
  "error ERC721NonexistentToken(uint256 tokenId)",
  "error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner)",
  "error ERC721InvalidSender(address sender)",
  "error ERC721InvalidReceiver(address receiver)",
  "error ERC721InvalidOwner(address owner)",
  "error ERC721InvalidOperator(address operator)",
  "error ERC721InvalidApprover(address approver)",
  // OpenZeppelin v5 ERC-1155 and access control
  "error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)",
  "error ERC1155MissingApprovalForAll(address operator, address owner)",
  "error OwnableUnauthorizedAccount(address account)",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error EnforcedPause()",
  "error ReentrancyGuardReentrantCall()",
]);

const MEANING: Record<string, string> = {
  NotOwner: "Only the vault's owner can do this.",
  NotAgent: "The sender is not an agent this vault allows.",
  ZeroAddress: "An address in the call is the zero address.",
  ZeroAmount: "The amount is zero.",
  InvalidCaps: "The caps do not fit each other: per payment, per hour, per day, in that order.",
  UnknownMerchant: "The merchant is not on this vault's list.",
  MerchantPaused: "The vault's owner has paused this merchant.",
  ExceedsPerTxCap: "The amount is over this merchant's cap per payment.",
  ExceedsHourlyCap: "The payment would go over this merchant's cap per hour.",
  ExceedsDailyCap: "The payment would go over this merchant's cap per day.",
  TooManyPayments: "Too many payments to this merchant in the current window.",
  InsufficientUnreserved: "The vault does not hold enough of the asset.",
  TokenCallFailed: "The token refused the transfer.",
  Reentrancy: "The vault was called again while it was paying.",
  NotCompliantAsset: "The asset is not one this vault accepts.",
  MerchantNotListed: "The merchant is not on this vault's list.",
  MerchantIsPaused: "The vault's owner has paused this merchant.",
  PerTxCapExceeded: "The amount is over this merchant's cap per payment.",
  DailyCapExceeded: "The payment would go over this merchant's cap per day.",
  NotVerified: "A party to the payment is not a verified identity.",
  RefusedByPolicy: "The asset's own policy refused the transfer.",
  TransferFailed: "The token refused the transfer.",
  NotMinter: "Only the token's minter can do this.",
  MinterAlreadySet: "The token's minter is already set.",
  InsufficientBalance: "The sender does not hold enough of the token.",
  InsufficientAllowance: "The sender has not been allowed to spend that much of the token.",
  ERC20InsufficientBalance: "The sender does not hold enough of the token.",
  ERC20InsufficientAllowance: "The spender has not been allowed to spend that much of the token.",
  ERC20InvalidSender: "The token refuses this sender.",
  ERC20InvalidReceiver: "The token refuses this receiver.",
  ERC20InvalidApprover: "The token refuses this approver.",
  ERC20InvalidSpender: "The token refuses this spender.",
  ERC721InsufficientApproval: "The sender is not allowed to move this token.",
  ERC721NonexistentToken: "No token with this id exists.",
  ERC721IncorrectOwner: "The token is not owned by the account the call names.",
  ERC721InvalidSender: "The collection refuses this sender.",
  ERC721InvalidReceiver: "The collection refuses this receiver.",
  ERC721InvalidOwner: "The collection refuses this owner.",
  ERC721InvalidOperator: "The collection refuses this operator.",
  ERC721InvalidApprover: "The collection refuses this approver.",
  ERC1155InsufficientBalance: "The sender does not hold enough of the token.",
  ERC1155MissingApprovalForAll: "The sender is not allowed to move these tokens.",
  OwnableUnauthorizedAccount: "Only the contract's owner can do this.",
  AccessControlUnauthorizedAccount: "The sender does not have the role this call needs.",
  EnforcedPause: "The contract is paused.",
  ReentrancyGuardReentrantCall: "The contract was called again while it was still running.",
};

export interface RevertExplained {
  /** The error's name as the contract declares it. */
  error: string;
  /** One sentence a person can act on. */
  reason: string;
}

export function explainRevert(data: Hex | null): RevertExplained | null {
  if (!data || data.length < 10) return null;
  try {
    const decoded = decodeErrorResult({ abi: ERRORS, data });
    if (decoded.errorName === "Error") {
      const said = String(decoded.args?.[0] ?? "").trim();
      return said === "" ? null : { error: "Error", reason: said };
    }
    if (decoded.errorName === "Panic") {
      return {
        error: "Panic",
        reason: `The contract hit an internal check (panic ${decoded.args?.[0]}).`,
      };
    }
    const reason = MEANING[decoded.errorName];
    return reason ? { error: decoded.errorName, reason } : null;
  } catch {
    // A selector this table does not carry: nothing to add.
    return null;
  }
}
