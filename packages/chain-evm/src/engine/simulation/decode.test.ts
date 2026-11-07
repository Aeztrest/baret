import { getAddress, serializeTransaction } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { decodeTransaction, TxDecodeError } from "./decode.js";

const CHAIN = 10143;
const TO = "0x00000000000000000000000000000000000000b2";
// A fresh key per run: nothing secret is ever written into the repository.
const account = privateKeyToAccount(generatePrivateKey());

const signed = (tx: Parameters<typeof account.signTransaction>[0]) => account.signTransaction(tx);

describe("decodeTransaction", () => {
  it("normalises an unsigned call", async () => {
    const tx = await decodeTransaction(
      { from: account.address, to: TO, value: "0x10", data: "0xabcd", gas: "21000" },
      CHAIN,
    );
    expect(tx).toEqual({
      from: account.address,
      to: getAddress(TO),
      value: 16n,
      data: "0xabcd",
      gas: 21000n,
      gasPrice: null,
    });
  });

  it("recovers the sender of a signed transaction for this chain", async () => {
    const raw = await signed({ chainId: CHAIN, to: TO, value: 1n, gas: 21000n, gasPrice: 1n });
    const tx = await decodeTransaction({ raw }, CHAIN);
    expect(tx.from).toBe(account.address);
    expect(tx.value).toBe(1n);
  });

  it("refuses a transaction signed for another chain", async () => {
    const raw = await signed({ chainId: 1, to: TO, value: 1n, gas: 21000n, gasPrice: 1n });
    await expect(decodeTransaction({ raw }, CHAIN)).rejects.toThrow(
      "signed for chain 1, expected 10143",
    );
  });

  it("refuses a legacy transaction with no chain id (replayable on any chain)", async () => {
    const raw = serializeTransaction({ to: TO, value: 1n, gas: 21000n, gasPrice: 1n, nonce: 0 });
    await expect(decodeTransaction({ raw }, CHAIN, account.address)).rejects.toThrow(
      "names no chain id",
    );
  });

  it("needs a sender for an unsigned serialized transaction", async () => {
    const raw = serializeTransaction({
      chainId: CHAIN,
      to: TO,
      value: 1n,
      gas: 21000n,
      gasPrice: 1n,
    });
    await expect(decodeTransaction({ raw }, CHAIN)).rejects.toBeInstanceOf(TxDecodeError);
    const tx = await decodeTransaction({ raw }, CHAIN, account.address);
    expect(tx.from).toBe(account.address);
  });

  it("carries an EIP-7702 delegation instead of ignoring it", async () => {
    const delegate = "0x00000000000000000000000000000000000000c3";
    const authorization = await account.signAuthorization({
      chainId: CHAIN,
      contractAddress: delegate,
      nonce: 0,
    });
    const raw = await signed({
      chainId: CHAIN,
      to: TO,
      gas: 50000n,
      maxFeePerGas: 2n,
      maxPriorityFeePerGas: 1n,
      authorizationList: [authorization],
    });
    const tx = await decodeTransaction({ raw }, CHAIN);
    expect(tx.delegations).toEqual([getAddress(delegate)]);
  });

  it("refuses something that is not a transaction", async () => {
    await expect(decodeTransaction({ raw: "0x1234" }, CHAIN)).rejects.toBeInstanceOf(TxDecodeError);
  });
});
