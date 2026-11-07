import {
  type Connector,
  connect,
  createConfig,
  createStorage,
  disconnect,
  estimateGas,
  type GetConnectionReturnType,
  getBalance,
  getConnection,
  getConnectors,
  getPublicClient,
  noopStorage,
  readContract,
  reconnect,
  sendTransaction,
  signTypedData,
  switchChain,
  watchConnection,
  watchConnectors,
} from "@wagmi/core";
import { erc20Abi, type Hex, http, type Transport } from "viem";
import { monadTestnet } from "viem/chains";
import {
  connectErrorOf,
  isBaretExtension,
  isBlockNotFound,
  SendRefused,
  safeIcon,
} from "./errors.js";
import type { Connection, Engine, Push, WalletOption, WalletState } from "./store.js";

/**
 * The wallet engine behind the demo sites, loaded on demand by store.ts.
 *
 * @wagmi/core on viem: wallets are found with EIP-6963 (multi injected
 * provider discovery, which wagmi runs through mipd), one config holds
 * Monad testnet only, and the last wallet is remembered in localStorage
 * under "baret.demo" so a reload reconnects without a prompt. Switching
 * networks goes through the wallet; a wallet that does not know Monad
 * testnet is offered viem's chain definition to add it.
 *
 * The sites read the address and Baret simulates each request from it.
 * Only a site's "Sign with your wallet" sends: `send` asks the wallet to
 * sign one call with a gas limit estimated on Monad testnet (Monad charges
 * the limit, not the gas used), and `confirm` waits for its block.
 * Balances, MON and tokens, are read from Monad testnet's public RPC.
 */

export const STORAGE_KEY = "baret.demo";

/**
 * How long `confirm` waits for a receipt. Monad blocks come about every
 * 0.4 s, so a minute with no receipt is reported to the visitor, not guessed.
 */
export const CONFIRM_MS = 60_000;

/**
 * Monad testnet's public RPC is a pool of nodes, and the one that answers
 * the next read may not have the block a receipt just came from. For this
 * long after a receipt, reads and gas estimates are pinned to that block,
 * so the next step's allowance and the balance after a drain are never read
 * from a node a block behind.
 */
export const FRESH_MS = 15_000;

/** A node behind the pinned block answers "block not found": try again this often, this many times. */
const LAG_MS = 400;
const LAG_TRIES = 8;

/** Runs a read again while the node answering it has not reached the pinned block. */
async function caughtUp<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt < LAG_TRIES; attempt++) {
    try {
      return await read();
    } catch (error) {
      if (!isBlockNotFound(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, LAG_MS));
    }
  }
  return read();
}

/** localStorage when the browser lets this page use it, the no-op store otherwise. */
function browserStorage(): Storage | typeof noopStorage {
  try {
    const store = window.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return noopStorage;
  }
}

function optionOf(connector: Connector): WalletOption {
  return {
    id: connector.id,
    name: connector.name,
    icon: safeIcon(connector.icon),
    extension: isBaretExtension(connector.id),
  };
}

function connectionOf(connection: GetConnectionReturnType): Connection {
  switch (connection.status) {
    case "connected":
      return {
        status: "connected",
        wallet: optionOf(connection.connector),
        address: connection.address,
        chainId: connection.chainId,
      };
    case "reconnecting":
      return { status: "reconnecting" };
    case "connecting":
      return { status: "connecting", id: connection.connector?.id ?? "" };
    default:
      return { status: "disconnected" };
  }
}

/** `transport` is Monad testnet's public RPC; tests pass a mock. */
export async function start(
  push: Push,
  read: () => WalletState,
  transport: Transport = http(),
): Promise<Engine> {
  const config = createConfig({
    chains: [monadTestnet],
    transports: { [monadTestnet.id]: transport },
    multiInjectedProviderDiscovery: true,
    storage: createStorage({ key: STORAGE_KEY, storage: browserStorage() }),
  });

  /** The newest receipt's block, and when it arrived (see FRESH_MS). */
  let fresh: { block: bigint; at: number } | null = null;
  const pinned = (): { blockNumber?: bigint } =>
    fresh && Date.now() - fresh.at < FRESH_MS ? { blockNumber: fresh.block } : {};

  /** Only wallets the browser announced: EIP-6963 connectors are injected ones. */
  const options = (): WalletOption[] =>
    getConnectors(config)
      .filter((c) => c.type === "injected")
      .map(optionOf);

  async function refreshBalance(): Promise<void> {
    const connection = getConnection(config);
    if (connection.status !== "connected") {
      push({ balance: null });
      return;
    }
    try {
      const { value } = await caughtUp(() =>
        getBalance(config, {
          address: connection.address,
          chainId: monadTestnet.id,
          ...pinned(),
        }),
      );
      // The account may have changed while the read was out.
      if (getConnection(config).address === connection.address) push({ balance: value });
    } catch {
      push({ balance: null });
    }
  }

  watchConnectors(config, { onChange: () => push({ options: options() }) });
  watchConnection(config, {
    onChange(next, before) {
      const connection = connectionOf(next);
      // While a connect is out, the store keeps the wallet it is waiting on.
      if (connection.status === "connecting" && read().connection.status === "connecting") return;
      push({ connection, ...(next.address !== before.address ? { balance: null } : {}) });
      if (next.status === "connected" && next.address !== before.address) void refreshBalance();
    },
  });

  push({ ready: true, options: options(), connection: connectionOf(getConnection(config)) });

  // Silent: only a wallet that authorised this site before, and was not
  // disconnected here since, comes back.
  await reconnect(config).catch(() => undefined);

  return {
    async connect(id) {
      const connector = getConnectors(config).find((c) => c.id === id);
      if (!connector) return;
      const current = getConnection(config);
      if (current.status === "connected" && current.connector.id === id) return;
      push({ error: null, switching: "idle", connection: { status: "connecting", id } });
      try {
        await connect(config, { connector });
      } catch (error) {
        push({
          error: { kind: connectErrorOf(error), name: connector.name },
          connection: connectionOf(getConnection(config)),
        });
      }
    },

    async disconnect() {
      try {
        await disconnect(config);
      } finally {
        push({
          connection: connectionOf(getConnection(config)),
          balance: null,
          switching: "idle",
        });
      }
    },

    async switchToMonad() {
      push({ switching: "busy" });
      try {
        await switchChain(config, { chainId: monadTestnet.id });
        push({ switching: "idle" });
      } catch (error) {
        // Saying no in the wallet is an answer, not a failure.
        push({ switching: connectErrorOf(error) === "rejected" ? "idle" : "failed" });
      }
    },

    refreshBalance,

    async send(call) {
      const connection = getConnection(config);
      if (
        connection.status !== "connected" ||
        connection.address.toLowerCase() !== call.from.toLowerCase()
      ) {
        throw new SendRefused("account");
      }
      if (connection.chainId !== monadTestnet.id) throw new SendRefused("network");
      const request = {
        account: connection.address,
        chainId: monadTestnet.id,
        to: call.to,
        data: call.data,
        value: BigInt(call.value),
      };
      const gas = await caughtUp(() => estimateGas(config, { ...request, ...pinned() }));
      // Monad charges the gas limit, so the limit stays a tenth above the estimate.
      return sendTransaction(config, { ...request, gas: gas + gas / 10n });
    },

    async signTyped(request) {
      const connection = getConnection(config);
      if (
        connection.status !== "connected" ||
        connection.address.toLowerCase() !== request.from.toLowerCase()
      ) {
        throw new SendRefused("account");
      }
      if (connection.chainId !== monadTestnet.id) throw new SendRefused("network");
      return signTypedData(config, {
        account: connection.address,
        domain: request.domain,
        types: request.types,
        primaryType: request.primaryType,
        message: request.message,
      } as never);
    },

    async confirm(hash: Hex) {
      const client = getPublicClient(config, { chainId: monadTestnet.id });
      if (!client) throw new Error("No Monad testnet client");
      const receipt = await client.waitForTransactionReceipt({
        hash,
        timeout: CONFIRM_MS,
        pollingInterval: 1_000,
      });
      const block = fresh && fresh.block > receipt.blockNumber ? fresh.block : receipt.blockNumber;
      fresh = { block, at: Date.now() };
      return receipt.status;
    },

    async balanceOf(address) {
      const { value } = await caughtUp(() =>
        getBalance(config, { address, chainId: monadTestnet.id, ...pinned() }),
      );
      return value;
    },

    tokenBalance(token, owner) {
      return caughtUp(() =>
        readContract(config, {
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
          chainId: monadTestnet.id,
          ...pinned(),
        }),
      );
    },
  };
}
