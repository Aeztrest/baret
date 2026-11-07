import { encodeErrorResult, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { explainRevert } from "./reverts.js";

const abi = parseAbi([
  "error InsufficientBalance()",
  "error InsufficientAllowance()",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC721NonexistentToken(uint256 tokenId)",
  "error ERC721InsufficientApproval(address operator, uint256 tokenId)",
  "error NotVerified(address party, uint8 reason)",
  "error Error(string reason)",
  "error SomethingElse(uint256 x)",
]);

const A = "0x00000000000000000000000000000000000000a1";

describe("explainRevert", () => {
  it("names DemoUSDC's InsufficientBalance (selector 0xf4d678b8)", () => {
    const data = encodeErrorResult({ abi, errorName: "InsufficientBalance" });
    expect(data.slice(0, 10)).toBe("0xf4d678b8");
    expect(explainRevert(data)).toEqual({
      error: "InsufficientBalance",
      reason: "The sender does not hold enough of the token.",
    });
    expect(
      explainRevert(encodeErrorResult({ abi, errorName: "InsufficientAllowance" }))?.error,
    ).toBe("InsufficientAllowance");
  });

  it("names the OpenZeppelin v5 ERC-20 and ERC-721 errors", () => {
    expect(
      explainRevert(
        encodeErrorResult({ abi, errorName: "ERC20InsufficientBalance", args: [A, 0n, 10000n] }),
      ),
    ).toEqual({
      error: "ERC20InsufficientBalance",
      reason: "The sender does not hold enough of the token.",
    });
    expect(
      explainRevert(
        encodeErrorResult({ abi, errorName: "ERC20InsufficientAllowance", args: [A, 0n, 1n] }),
      )?.error,
    ).toBe("ERC20InsufficientAllowance");
    expect(
      explainRevert(encodeErrorResult({ abi, errorName: "ERC721NonexistentToken", args: [7n] })),
    ).toEqual({ error: "ERC721NonexistentToken", reason: "No token with this id exists." });
    expect(
      explainRevert(
        encodeErrorResult({ abi, errorName: "ERC721InsufficientApproval", args: [A, 7n] }),
      )?.error,
    ).toBe("ERC721InsufficientApproval");
  });

  it("names CompliantPaymentGuard's NotVerified", () => {
    expect(
      explainRevert(encodeErrorResult({ abi, errorName: "NotVerified", args: [A, 1] })),
    ).toEqual({
      error: "NotVerified",
      reason: "A party to the payment is not a verified identity.",
    });
  });

  it("passes a plain Error(string) through and gives up on an unknown selector", () => {
    expect(explainRevert(encodeErrorResult({ abi, errorName: "Error", args: ["nope"] }))).toEqual({
      error: "Error",
      reason: "nope",
    });
    expect(explainRevert(encodeErrorResult({ abi, errorName: "SomethingElse", args: [1n] }))).toBe(
      null,
    );
    expect(explainRevert(null)).toBe(null);
    expect(explainRevert("0x12")).toBe(null);
  });
});
