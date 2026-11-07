import { custom, decodeFunctionData, encodeFunctionResult, type Hex, multicall3Abi } from "viem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { start } from "./engine.js";
import {
  BARET_EXTENSION_RDNS,
  connectErrorOf,
  isBaretExtension,
  isBlockNotFound,
  type SendError,
  SendRefused,
  safeIcon,
  sendErrorOf,
} from "./errors.js";
import { exceeds, formatMon } from "./format.js";
import { hadWallet, INITIAL, type Push, type SendCall, type WalletState } from "./store.js";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const ICON = "data:image/svg+xml;base64,PHN2Zy8+";
const HASH: Hex = `0x${"ab".repeat(32)}`;
const TOKEN = "0x2222222222222222222222222222222222222222";

/** A 32-byte word, as eth_call returns a uint256. */
const word = (n: bigint): Hex => `0x${n.toString(16).padStart(64, "0")}`;

/**
 * Every eth_call answers 100e6. wagmi batches reads through Multicall3, so
 * an aggregate3 call gets that word back for each call it carries.
 */
function callResult(data: Hex): Hex {
  if (!data.startsWith("0x82ad56cb")) return word(100_000_000n);
  const { args } = decodeFunctionData({ abi: multicall3Abi, data });
  const calls = (args?.[0] ?? []) as readonly unknown[];
  return encodeFunctionResult({
    abi: multicall3Abi,
    functionName: "aggregate3",
    result: calls.map(() => ({ success: true, returnData: word(100_000_000n) })),
  });
}

/**
 * Monad testnet's public RPC, answered here so no test reaches the network.
 * `status` is the receipt status the next confirm reads.
 */
function mockRpc() {
  const rpc = { status: "0x1" as "0x1" | "0x0", lag: 0, estimates: [] as unknown[][] };
  const transport = custom({
    async request({ method, params }: { method: string; params?: unknown[] }) {
      // A node of the pool a block behind: it cannot answer a read pinned to the receipt's block.
      const pinned = (params ?? []).includes("0x10");
      if (pinned && rpc.lag > 0 && (method === "eth_estimateGas" || method === "eth_call")) {
        rpc.lag -= 1;
        throw Object.assign(
          new Error(
            "Block requested not found. Request might be querying historical state that is not available.",
          ),
          { code: -32602 },
        );
      }
      switch (method) {
        case "eth_chainId":
          return "0x279f";
        case "eth_getBalance":
          return "0x0";
        case "eth_estimateGas":
          rpc.estimates.push(params ?? []);
          return "0x5208";
        case "eth_call":
          return callResult((params as [{ data: Hex }])[0].data);
        case "eth_blockNumber":
          return "0x10";
        case "eth_getTransactionReceipt":
          return {
            transactionHash: HASH,
            transactionIndex: "0x0",
            blockHash: `0x${"cd".repeat(32)}`,
            blockNumber: "0x10",
            from: ACCOUNT,
            to: TOKEN,
            cumulativeGasUsed: "0x5208",
            gasUsed: "0x5208",
            effectiveGasPrice: "0x1",
            contractAddress: null,
            logs: [],
            logsBloom: `0x${"00".repeat(256)}`,
            status: rpc.status,
            type: "0x2",
          };
        case "eth_getBlockByNumber":
          return {
            number: "0x10",
            hash: `0x${"cd".repeat(32)}`,
            parentHash: `0x${"ef".repeat(32)}`,
            timestamp: "0x1",
            transactions: [],
          };
        default:
          throw new Error(`unsupported ${method}`);
      }
    },
  });
  return Object.assign(rpc, { transport });
}

/** A browser wallet that announces itself over EIP-6963 and answers EIP-1193 calls. */
function mockWallet(rdns: string, name: string, chainId = 1) {
  let chain = chainId;
  let authorised = false;
  const known = new Set([chainId]);
  const calls: string[] = [];
  const sent: unknown[] = [];
  const handlers = new Map<string, Set<(arg: unknown) => void>>();
  const emit = (event: string, arg: unknown) => {
    for (const fn of handlers.get(event) ?? []) fn(arg);
  };
  const provider = {
    async request({ method, params }: { method: string; params?: unknown[] }) {
      calls.push(method);
      switch (method) {
        case "eth_requestAccounts":
          authorised = true;
          return [ACCOUNT];
        case "eth_accounts":
          return authorised ? [ACCOUNT] : [];
        case "eth_chainId":
          return `0x${chain.toString(16)}`;
        case "wallet_switchEthereumChain": {
          const id = Number((params as [{ chainId: string }])[0].chainId);
          if (!known.has(id)) throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
          chain = id;
          emit("chainChanged", `0x${id.toString(16)}`);
          return null;
        }
        case "wallet_addEthereumChain": {
          // Like MetaMask and Rabby: adding a chain also switches to it.
          const id = Number((params as [{ chainId: string }])[0].chainId);
          known.add(id);
          chain = id;
          emit("chainChanged", `0x${id.toString(16)}`);
          return null;
        }
        case "eth_sendTransaction":
          sent.push((params as unknown[])[0]);
          return HASH;
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts" }];
        case "wallet_revokePermissions":
          authorised = false;
          return null;
        default:
          throw Object.assign(new Error(`unsupported ${method}`), { code: 4200 });
      }
    },
    on(event: string, fn: (arg: unknown) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)?.add(fn);
    },
    removeListener(event: string, fn: (arg: unknown) => void) {
      handlers.get(event)?.delete(fn);
    },
  };
  const detail = Object.freeze({
    info: { uuid: crypto.randomUUID(), name, icon: ICON, rdns },
    provider,
  });
  const announce = () =>
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
  return {
    calls,
    sent,
    get chain() {
      return chain;
    },
    stop: () => window.removeEventListener("eip6963:requestProvider", announce),
  };
}

function harness() {
  let state: WalletState = INITIAL;
  const push: Push = (patch) => {
    state = { ...state, ...patch };
  };
  return {
    push,
    read: () => state,
    get state() {
      return state;
    },
  };
}

describe("wallet helpers", () => {
  it("knows the Baret extension by its reverse-DNS name only", () => {
    expect(isBaretExtension(BARET_EXTENSION_RDNS)).toBe(true);
    expect(isBaretExtension("io.metamask")).toBe(false);
  });

  it("draws only image data URIs", () => {
    expect(safeIcon(ICON)).toBe(ICON);
    expect(safeIcon("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
    for (const bad of [
      "https://x.example/i.svg",
      "javascript:alert(1)",
      "data:text/html,x",
      undefined,
    ]) {
      expect(safeIcon(bad)).toBeNull();
    }
  });

  it("reads 4001 and -32002 anywhere in the cause chain", () => {
    expect(connectErrorOf({ code: 4001 })).toBe("rejected");
    expect(connectErrorOf({ cause: { cause: { code: -32002 } } })).toBe("pending");
    expect(connectErrorOf(new Error("x"))).toBe("failed");
  });

  it("words a failed send from anywhere in the cause chain", () => {
    for (const kind of [
      "rejected",
      "pending",
      "network",
      "funds",
      "account",
      "failed",
    ] satisfies SendError[]) {
      expect(sendErrorOf(new SendRefused(kind))).toBe(kind);
    }
    expect(sendErrorOf({ cause: { cause: { code: 4001 } } })).toBe("rejected");
    expect(sendErrorOf({ code: -32002 })).toBe("pending");
    expect(sendErrorOf({ name: "ChainMismatchError" })).toBe("network");
    expect(sendErrorOf({ name: "InsufficientFundsError" })).toBe("funds");
    expect(sendErrorOf(new Error("insufficient funds for gas * price + value"))).toBe("funds");
    // Monad testnet's gas estimate, wrapped by viem: the reason sits in a cause.
    expect(
      sendErrorOf({
        name: "EstimateGasExecutionError",
        shortMessage: "Execution reverted for an unknown reason.",
        cause: { code: -32000, message: "insufficient balance" },
      }),
    ).toBe("funds");
    expect(sendErrorOf(new Error("x"))).toBe("failed");
  });

  it("knows a node that has not reached the pinned block", () => {
    expect(
      isBlockNotFound({
        shortMessage: "Invalid parameters were provided to the RPC method.",
        cause: { message: "Block requested not found. Request might be querying historical state" },
      }),
    ).toBe(true);
    expect(isBlockNotFound({ code: -32602, message: "invalid params" })).toBe(false);
    expect(isBlockNotFound(new Error("execution reverted"))).toBe(false);
  });

  it("prints MON cut to four decimals and compares a known balance only", () => {
    expect(formatMon(1_234_567_890_000_000_000n)).toBe("1.2345");
    expect(formatMon(0n)).toBe("0");
    expect(exceeds(2n, 1n)).toBe(true);
    expect(exceeds(2n, null)).toBe(false);
  });
});

describe("wallet engine (wagmi over EIP-6963)", () => {
  let wallets: ReturnType<typeof mockWallet>[] = [];
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    for (const w of wallets) w.stop();
    wallets = [];
  });

  it("lists announced wallets, the extension marked, and connects without a prompt to switch", async () => {
    wallets = [mockWallet("io.rabby", "Rabby"), mockWallet(BARET_EXTENSION_RDNS, "Baret")];
    const h = harness();
    const engine = await start(h.push, h.read, mockRpc().transport);
    expect(h.state.ready).toBe(true);
    const ids = h.state.options.map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(["io.rabby", BARET_EXTENSION_RDNS]));
    expect(h.state.options.find((o) => o.id === BARET_EXTENSION_RDNS)?.extension).toBe(true);
    expect(h.state.options[0]?.icon).toBe(ICON);

    await engine.connect("io.rabby");
    expect(h.state.connection).toMatchObject({ status: "connected", address: ACCOUNT, chainId: 1 });
    expect(hadWallet()).toBe(true);
  });

  it("adds Monad testnet when the wallet does not know it, then switches", async () => {
    const w = mockWallet("io.rabby", "Rabby");
    wallets = [w];
    const h = harness();
    const engine = await start(h.push, h.read, mockRpc().transport);
    await engine.connect("io.rabby");
    await engine.switchToMonad();
    expect(w.calls).toContain("wallet_addEthereumChain");
    expect(w.chain).toBe(10143);
    expect(h.state.switching).toBe("idle");
  });

  it("forgets a disconnected wallet on the next load", async () => {
    wallets = [mockWallet("io.rabby", "Rabby")];
    const h = harness();
    const engine = await start(h.push, h.read, mockRpc().transport);
    await engine.connect("io.rabby");
    await engine.disconnect();
    expect(h.state.connection.status).toBe("disconnected");
    expect(hadWallet()).toBe(false);
  });

  it("sends a call with the estimate plus a tenth as its gas limit", async () => {
    const w = mockWallet("io.rabby", "Rabby", 10143);
    wallets = [w];
    const h = harness();
    const engine = await start(h.push, h.read, mockRpc().transport);
    await engine.connect("io.rabby");
    const call: SendCall = { from: ACCOUNT, to: TOKEN, value: "0", data: "0x1234" };
    await expect(engine.send(call)).resolves.toBe(HASH);
    expect(w.sent).toEqual([
      expect.objectContaining({ from: ACCOUNT, to: TOKEN, data: "0x1234", gas: "0x5a3c" }),
    ]);
    expect((w.sent[0] as { value?: string }).value ?? "0x0").toBe("0x0");
  });

  it("refuses a call built for another account, and a wallet on another chain", async () => {
    wallets = [mockWallet("io.rabby", "Rabby", 10143)];
    const h = harness();
    const engine = await start(h.push, h.read, mockRpc().transport);
    await engine.connect("io.rabby");
    const other = "0x3333333333333333333333333333333333333333";
    await expect(engine.send({ from: other, to: TOKEN, value: "0", data: "0x" })).rejects.toThrow(
      expect.objectContaining({ kind: "account" }),
    );

    wallets[0]?.stop();
    localStorage.clear();
    const w = mockWallet("io.metamask", "MetaMask", 1);
    wallets.push(w);
    const h2 = harness();
    const onMainnet = await start(h2.push, h2.read, mockRpc().transport);
    await onMainnet.connect("io.metamask");
    await expect(
      onMainnet.send({ from: ACCOUNT, to: TOKEN, value: "0", data: "0x" }),
    ).rejects.toThrow(expect.objectContaining({ kind: "network" }));
    expect(w.sent).toEqual([]);
  });

  it("pins the next estimate to the last receipt's block, and waits for a node that has it", async () => {
    const w = mockWallet("io.rabby", "Rabby", 10143);
    wallets = [w];
    const h = harness();
    const rpc = mockRpc();
    const engine = await start(h.push, h.read, rpc.transport);
    await engine.connect("io.rabby");
    await engine.confirm(HASH);
    rpc.lag = 2;
    await expect(
      engine.send({ from: ACCOUNT, to: TOKEN, value: "0", data: "0x1234" }),
    ).resolves.toBe(HASH);
    expect(rpc.lag).toBe(0);
    expect(rpc.estimates.at(-1)?.[1]).toBe("0x10");
    expect(w.sent).toHaveLength(1);
  });

  it("reads a token balance from Monad testnet", async () => {
    wallets = [mockWallet("io.rabby", "Rabby", 10143)];
    const h = harness();
    const engine = await start(h.push, h.read, mockRpc().transport);
    await expect(engine.tokenBalance(TOKEN, ACCOUNT)).resolves.toBe(100_000_000n);
  });

  it("confirms a sent call as success or reverted", async () => {
    wallets = [mockWallet("io.rabby", "Rabby", 10143)];
    const rpc = mockRpc();
    const h = harness();
    const engine = await start(h.push, h.read, rpc.transport);
    await expect(engine.confirm(HASH)).resolves.toBe("success");
    rpc.status = "0x0";
    await expect(engine.confirm(HASH)).resolves.toBe("reverted");
  });
});
