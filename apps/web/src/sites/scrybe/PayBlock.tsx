import { demoFrame, scrybe } from "@baret/content";
import { explorerTx } from "@baret/demo-evm";
import { Button, truncateAddress } from "@baret/ui";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useId } from "react";
import { BUSY, LINK } from "../kit/wallet/SignBlock.js";
import type { PayState } from "./pay.js";
import { usdc } from "./sample.js";

/**
 * Scrybe's second button: the question paid for real (pay.ts). Under it, the
 * step the payment is at, then either the answer with the settlement's
 * transaction or the reason it stopped. A payment that stopped never reads
 * as paid. The block holds no state: the site owns the run.
 */

const copy = scrybe.pay;
const sign = demoFrame.sign;
const account = demoFrame.wallet.account;

const ALERT = "text-sm font-medium text-[color:var(--blocked)] [overflow-wrap:anywhere]";

export function PayBlock({
  state,
  walletName,
  need,
  switching,
  onConnect,
  onSwitch,
  price,
  merchant,
  checks,
  onPay,
}: {
  state: PayState;
  /** The connected wallet's own name, "" with none. */
  walletName: string;
  /** Why the last press did not start, with the action that fixes it. */
  need: "wallet" | "network" | null;
  switching: "idle" | "busy" | "failed";
  onConnect: () => void;
  onSwitch: () => void;
  /** The price before the 402 names it, in base units. */
  price: bigint;
  merchant: string;
  /** True when the connected wallet is the Baret extension, which checks the payment itself. */
  checks: boolean;
  onPay: () => void;
}): JSX.Element {
  const titleId = useId();
  const { phase, error, answer, hash } = state;
  const running = phase === "asking" || phase === "signing" || phase === "settling";
  const values = {
    amount: usdc(state.amount ?? price),
    merchant: truncateAddress(merchant),
    wallet: walletName,
  };
  const line = running
    ? fill(copy.status[phase], values)
    : phase === "done"
      ? fill(copy.done, values)
      : phase === "stopped"
        ? fill(copy.errors[error ?? "failed"], values)
        : "";

  return (
    <div className="grid gap-3">
      <p className={T.small}>{copy.checked}</p>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className={`w-full ${BUSY}`}
        aria-disabled={running || undefined}
        onClick={() => {
          if (!running) onPay();
        }}
      >
        {copy.action}
      </Button>
      <p className={T.small}>{fill(checks ? copy.noteChecked : copy.note, values)}</p>

      {need === "wallet" ? (
        <div className="grid gap-2">
          <p role="alert" className={ALERT}>
            {sign.needs.wallet}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="justify-self-start"
            onClick={onConnect}
          >
            {demoFrame.errors.noWallet.action.label}
          </Button>
        </div>
      ) : need === "network" ? (
        <div className="grid gap-2">
          <p role="alert" className={ALERT}>
            {sign.needs.network}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="md"
            className="justify-self-start"
            disabled={switching === "busy"}
            onClick={onSwitch}
          >
            {switching === "busy" ? account.switch.busy : account.switch.label}
          </Button>
          {switching === "failed" ? (
            <p role="alert" className={ALERT}>
              {account.switch.failed}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase !== "idle" ? (
        <section aria-labelledby={titleId} className="grid gap-2">
          <h3 id={titleId} className={T.label}>
            {copy.title}
          </h3>
          {phase === "stopped" ? (
            <>
              <p role="alert" className={ALERT}>
                {line}
              </p>
              {error === "balance" || error === "funds" ? (
                <a
                  href={copy.faucet.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK}
                >
                  {copy.faucet.label}
                </a>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-medium text-[color:var(--fg)]">{line}</p>
          )}
          {phase === "done" && hash ? (
            <>
              <a href={explorerTx(hash)} target="_blank" rel="noopener noreferrer" className={LINK}>
                {fill(sign.view, { hash: truncateAddress(hash) })}
              </a>
              <h4 className={T.label}>{copy.answer}</h4>
              <p className="text-sm text-[color:var(--fg)] [overflow-wrap:anywhere]">{answer}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {phase === "stopped" ? "" : line}
      </p>
    </div>
  );
}
