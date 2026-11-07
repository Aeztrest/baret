import { demoFrame, novaswap } from "@baret/content";
import { DEMO_FAUCET, explorerTx } from "@baret/demo-evm";
import type { FlowState } from "@baret/demo-evm/wallet";
import { Button, truncateAddress } from "@baret/ui";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import type { JSX } from "react";
import { BUSY, LINK } from "../kit/wallet/SignBlock.js";

/**
 * The attack card's faucet: the attack sells dUSDC, so the visitor takes 100
 * test dUSDC first, in one call the connected wallet signs. The button keeps
 * its label and its focus while the call is out; the line under it says
 * where the call is (in the wallet, on Monad testnet, received) with its hash
 * on the explorer, and a call that did not land says why, in the sign
 * block's words.
 */

const copy = novaswap.sign.faucet;
const sign = demoFrame.sign;
const faucetLink = demoFrame.wallet.account.faucet;

export function Faucet({
  flow,
  walletName,
  disabled = false,
  onTake,
}: {
  flow: FlowState;
  /** The connected wallet's own name. */
  walletName: string;
  /** True while another wallet request of the page is open (the sign run). */
  disabled?: boolean;
  onTake: () => void;
}): JSX.Element {
  const running = flow.phase === "running";
  const locked = running || disabled;
  const step = flow.steps[0];
  const hash = step?.hash ?? null;
  const status = running
    ? step?.status === "pending"
      ? copy.pending
      : fill(copy.busy, { wallet: walletName })
    : flow.phase === "done"
      ? copy.done
      : "";

  return (
    <div className="grid gap-2">
      <p className={T.small}>{copy.body}</p>
      <Button
        type="button"
        variant="soft"
        size="md"
        className={`justify-self-start ${BUSY}`}
        aria-disabled={locked || undefined}
        onClick={() => {
          if (!locked) onTake();
        }}
      >
        {copy.label}
      </Button>
      {/* Always mounted, so each change is read out. */}
      <p role="status" className={`${T.small} empty:hidden`}>
        {status}
      </p>
      {flow.phase === "stopped" ? (
        <p role="alert" className="text-sm font-medium text-[color:var(--blocked)]">
          {fill(sign.errors[flow.error ?? "failed"], { wallet: walletName })}
        </p>
      ) : null}
      {/* The call still pays a fee in MON: an account with none gets the faucet. */}
      {flow.phase === "stopped" && flow.error === "funds" ? (
        <a
          href={DEMO_FAUCET ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          {faucetLink.label}
        </a>
      ) : null}
      {hash ? (
        <a href={explorerTx(hash)} target="_blank" rel="noopener noreferrer" className={LINK}>
          {fill(sign.view, { hash: truncateAddress(hash) })}
        </a>
      ) : null}
    </div>
  );
}
