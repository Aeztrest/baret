import {
  type Caip2,
  type ChainConfig,
  caip2Schema,
  chainConfigSchema,
  type PolicyChainContext,
} from "@baret/core";
import { z } from "zod";
import monad from "../chains/monad.json" with { type: "json" };
import monadTestnet from "../chains/monad-testnet.json" with { type: "json" };
import monadTestnetDeployments from "../deployments/monad-testnet.json" with { type: "json" };

/**
 * The registry of supported chains and of Baret's contract deployments (ADR-0003, rule 5
 * in CLAUDE.md: addresses are data). Every entry is validated when this module loads, so a
 * bad JSON edit fails every test and every boot. docs/chains/README.md lists each chain.
 */

export const deployedContractSchema = z
  .object({
    address: z.string().min(1),
    /** Block, ledger or similar where it was deployed; null when not recorded. */
    block: z.number().int().nonnegative().nullable(),
    txHash: z.string().nullable(),
    /** Where the source lives (repository path, or this repo's contracts/). */
    source: z.string().min(1),
    /** Source verified on the chain's explorer / Sourcify. */
    sourceVerified: z.boolean(),
    /** Date the code was last seen on chain (YYYY-MM-DD). */
    checkedOnChain: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

/**
 * An address the web app's demo sites use (ADR-0010). `listed`: Baret vouches for it
 * (it joins the chain's known contracts); an attack contract or a reported wallet is
 * never listed. `kind: "account"` is a plain wallet (no code).
 */
export const showcaseEntrySchema = z
  .object({
    address: z.string().min(1),
    kind: z.enum(["contract", "account"]),
    listed: z.boolean(),
    role: z.string().min(1),
    source: z.string().min(1).nullable(),
    checkedOnChain: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const contractName = z.string().regex(/^[A-Z][A-Za-z0-9]*$/);

export const deploymentsSchema = z
  .object({
    chain: caip2Schema,
    contracts: z.record(contractName, deployedContractSchema),
    /** Demo-site contracts and wallets, testnets only. */
    showcase: z.record(contractName, showcaseEntrySchema).optional(),
  })
  .strict();

export type DeployedContract = z.infer<typeof deployedContractSchema>;
export type ShowcaseEntry = z.infer<typeof showcaseEntrySchema>;
export type Deployments = z.infer<typeof deploymentsSchema>;

const RAW_CHAINS: unknown[] = [monadTestnet, monad];
const RAW_DEPLOYMENTS: unknown[] = [monadTestnetDeployments];

export const CHAINS: readonly ChainConfig[] = RAW_CHAINS.map((c) => chainConfigSchema.parse(c));
const DEPLOYMENTS: readonly Deployments[] = RAW_DEPLOYMENTS.map((d) => deploymentsSchema.parse(d));

const byId = new Map(CHAINS.map((c) => [c.id, c]));
const deploymentsById = new Map(DEPLOYMENTS.map((d) => [d.chain, d]));

/** The chain's registry entry, or null when Baret does not know it. */
export function getChain(id: string): ChainConfig | null {
  return byId.get(id) ?? null;
}

/** Baret's contracts on a chain ({} when none are deployed there). */
export function getDeployments(chain: Caip2): Deployments["contracts"] {
  return deploymentsById.get(chain)?.contracts ?? {};
}

export function getDeployment(chain: Caip2, name: string): DeployedContract | null {
  return getDeployments(chain)[name] ?? null;
}

/** The demo sites' addresses on a chain ({} when the chain has none). */
export function getShowcase(chain: Caip2): Readonly<Record<string, ShowcaseEntry>> {
  return deploymentsById.get(chain)?.showcase ?? {};
}

/**
 * The contracts Baret vouches for on a chain: its own deployments and the listed demo
 * contracts. The engine treats them as known (no unknown-contract finding).
 */
export function knownAddresses(chain: Caip2): string[] {
  const own = Object.values(getDeployments(chain)).map((d) => d.address);
  const demo = Object.values(getShowcase(chain))
    .filter((e) => e.listed)
    .map((e) => e.address);
  return [...own, ...demo];
}

/** The name of a chain variable: CHAIN_<envSlug>_<suffix> (docs/operations/environments.md §2). */
export function chainEnvName(chain: ChainConfig, suffix: string): string {
  return `CHAIN_${chain.envSlug}_${suffix}`;
}

/**
 * The chains a deployment serves: those whose RPC URL variable is set. A chain that is
 * not configured is simply not offered; it is never served with a guessed default.
 */
export function enabledChains(env: Record<string, string | undefined>): ChainConfig[] {
  return CHAINS.filter((c) => (env[chainEnvName(c, "RPC_URL")] ?? "").trim() !== "");
}

/** What `createPolicy()` needs to fill a template for this chain. */
export function policyContext(chain: ChainConfig): PolicyChainContext {
  const floors: PolicyChainContext["native"] = {
    id: chain.nativeAsset.id,
    decimals: chain.nativeAsset.decimals,
    floors: {},
  };
  if (chain.policyFloors.strict !== null) floors.floors.strict = chain.policyFloors.strict;
  if (chain.policyFloors.balanced !== null) floors.floors.balanced = chain.policyFloors.balanced;
  return {
    paymentAssets: chain.usdc ? [{ id: chain.usdc.id, decimals: chain.usdc.decimals }] : [],
    native: floors,
  };
}
