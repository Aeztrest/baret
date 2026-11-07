import type { SiteSign } from "@baret/content";
import type { Address } from "@baret/demo-evm/wallet";
import {
  addressOf,
  isBaretExtension,
  requestPicker,
  type SendCall,
  switchToMonad,
  useSendFlow,
} from "@baret/demo-evm/wallet";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useEffect, useRef, useState } from "react";
import { SignBlock } from "./SignBlock.js";
import { MONAD_TESTNET_ID, useDemoWallet, walletLabel } from "./useDemoWallet.js";

/**
 * "Sign with your wallet" for a site whose request is one call (or a call
 * and the call that undoes it): the wallet, the run and the reasons a press
 * cannot start, in one place, so PixelDrop, OrbitYield, ClaimHub and
 * LaunchPad wire it the same way NovaSwap does by hand.
 *
 * The site gives the calls for the version switched on and, when a balance
 * tells the story, the token to read before and after. The block keeps the
 * version and the values of the run it shows, not the inputs the visitor may
 * have changed since.
 */

export interface SignRun {
  readonly mode: "safe" | "danger";
  readonly calls: readonly SendCall[];
  /** The token whose balance is read before the first call and after the last. */
  readonly token?: { readonly address: Address; readonly decimals: number };
  /** What the step labels interpolate. */
  readonly values?: Record<string, string>;
}

export function useSiteSign(copy: SiteSign): {
  /** The connected wallet's address, null with none. */
  address: Address | null;
  /** The block, to hand to the site's card. `build` is asked for the run when the button is pressed; null when the inputs are refused. */
  block: (build: (owner: Address) => SignRun | null, current?: "safe" | "danger") => JSX.Element;
} {
  const { wallet } = useDemoWallet();
  const flow = useSendFlow();
  const connection = wallet.connection.status === "connected" ? wallet.connection : null;
  const address = addressOf(wallet);
  const chainId = connection?.chainId ?? null;
  const [need, setNeed] = useState<"wallet" | "network" | null>(null);
  const [ran, setRan] = useState<SignRun | null>(null);

  // A need clears once what it waited for arrives.
  useEffect(() => {
    if (need === "wallet" && address !== null) setNeed(null);
    if (need === "network" && chainId === MONAD_TESTNET_ID) setNeed(null);
  }, [need, address, chainId]);

  // Another account drops the run: its steps belong to the address before.
  const seen = useRef(address);
  const reset = flow.reset;
  useEffect(() => {
    if (seen.current === address) return;
    seen.current = address;
    reset();
    setRan(null);
  }, [address, reset]);

  function block(
    build: (owner: Address) => SignRun | null,
    current: "safe" | "danger" = "safe",
  ): JSX.Element {
    const mode = ran?.mode ?? "safe";
    return (
      <SignBlock
        flow={flow.state}
        labels={(ran ? copy.steps[mode] : []).map((label) => fill(label, ran?.values ?? {}))}
        walletName={connection ? walletLabel(connection.wallet) : ""}
        need={need}
        switching={wallet.switching}
        onConnect={requestPicker}
        onSwitch={() => void switchToMonad()}
        token={{ symbol: copy.token, decimals: ran?.token?.decimals ?? 18 }}
        outcome={[copy.outcome[mode]]}
        checks={connection !== null && isBaretExtension(connection.wallet.id)}
        attack={current === "danger"}
        ranAttack={ran?.mode === "danger"}
        onSign={() => {
          if (address === null) {
            setNeed("wallet");
            return;
          }
          if (chainId !== MONAD_TESTNET_ID) {
            setNeed("network");
            return;
          }
          setNeed(null);
          const run = build(address);
          if (run === null) return;
          setRan(run);
          const track = run.token ? { token: run.token.address, owner: address } : undefined;
          void flow.run(run.calls, track);
        }}
      />
    );
  }

  return { address, block };
}
