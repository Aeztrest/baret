import { demoFrame } from "@baret/content";
import { DEMO_FAUCET, explorerTx } from "@baret/demo-evm";
import type { FlowState, StepStatus } from "@baret/demo-evm/wallet";
import { Button, truncateAddress } from "@baret/ui";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useId } from "react";
import { displayAmount } from "../live.js";
import { TwoPaths } from "../site/TwoPaths.js";

/**
 * A site's "Sign with your wallet", the second button beside its main one:
 * the same request Baret's panel checks, sent straight to the connected
 * wallet with no check first. A line above it says the main button goes
 * through Baret's check, so the two read as one request, two paths (M2). Under it, each step of the run with what the
 * wallet and Monad testnet said, a hash that opens on the explorer, and once
 * every step is confirmed the tracked token's balance before and after.
 *
 * The block holds no state: the site owns the run (useSendFlow) and says why
 * a press did not start. A run that stopped never reads as done.
 */

const copy = demoFrame.sign;
const account = demoFrame.wallet.account;

/** A hash or outside link: underlined, 44 px tall, with the focus ring. */
export const LINK =
  "inline-flex min-h-11 w-max max-w-full items-center text-sm font-medium text-[color:var(--fg)] underline decoration-[color:var(--rule-strong)] underline-offset-4 [overflow-wrap:anywhere] hover:decoration-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

const ALERT = "text-sm font-medium text-[color:var(--blocked)] [overflow-wrap:anywhere]";

/** The dot's colour per status: a step in the wallet or on chain is the accent, an end that is not success is blocked. */
const DOT: Record<StepStatus, string> = {
  waiting: "bg-[color:var(--rule-strong)]",
  confirm: "bg-[color:var(--accent)]",
  pending: "bg-[color:var(--accent)]",
  done: "bg-[color:var(--safe)]",
  declined: "bg-[color:var(--blocked)]",
  unconfirmed: "bg-[color:var(--caution)]",
  failed: "bg-[color:var(--blocked)]",
};

/** A busy button stays focusable (aria-disabled), so a keyboard user keeps their place while the wallet is open. */
export const BUSY = "aria-disabled:cursor-not-allowed aria-disabled:opacity-40";

export function SignBlock({
  flow,
  labels,
  walletName,
  need,
  note = null,
  blocked = null,
  switching,
  onConnect,
  onSwitch,
  token,
  outcome,
  stoppedNote = null,
  busy = false,
  checks = false,
  attack = false,
  ranAttack = false,
  onSign,
}: {
  flow: FlowState;
  /** One label per step, already filled. */
  labels: readonly string[];
  /** The connected wallet's own name, "" with none. */
  walletName: string;
  /** Why the last press did not start, with the action that fixes it. */
  need: "wallet" | "network" | null;
  /** A site's own reason the last press did not start, read out once. */
  note?: string | null;
  /**
   * A reason the site already knows the run cannot start (NovaSwap: the
   * wallet holds no dUSDC). The button is then disabled and this sentence,
   * shown under it, is its description, so a press never does nothing silently.
   */
  blocked?: string | null;
  switching: "idle" | "busy" | "failed";
  onConnect: () => void;
  onSwitch: () => void;
  /** The tracked token, for the balance line. */
  token: { symbol: string; decimals: number };
  /** The site's sentences once every step is confirmed. */
  outcome: readonly string[];
  /** A sentence for a run that stopped after some steps confirmed (NovaSwap: the allowance stays open). */
  stoppedNote?: string | null;
  /** True while another wallet request of the page is open (the faucet). */
  busy?: boolean;
  /** True when the connected wallet is the Baret extension, which checks the request with Baret itself (D-040). */
  checks?: boolean;
  /** True while the site's attack version is switched on: the two paths show above the button. */
  attack?: boolean;
  /** True when the run shown is the attack version: its result reads as a warning. */
  ranAttack?: boolean;
  onSign: () => void;
}): JSX.Element {
  const titleId = useId();
  const blockedId = useId();
  const wallet = { wallet: walletName };
  const { steps, phase, error, before, after } = flow;
  const total = String(steps.length);
  const locked = phase === "running" || busy || blocked !== null;

  // The balance line only when both reads came back: a missing read is not a zero.
  const balance =
    phase === "done" && before !== null && after !== null
      ? fill(copy.balance, {
          token: token.symbol,
          before: displayAmount(before, token.decimals),
          after: displayAmount(after, token.decimals),
        })
      : null;

  // The last step the run reached, read out when it changes.
  let last = -1;
  steps.forEach((step, i) => {
    if (step.status !== "waiting") last = i;
  });
  const lastStep = last >= 0 ? steps[last] : undefined;
  const announce = lastStep
    ? [
        fill(copy.announce, {
          n: String(last + 1),
          total,
          status: fill(copy.status[lastStep.status], wallet),
        }),
        balance,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className="grid gap-3">
      {attack ? <TwoPaths /> : <p className={T.small}>{copy.checked}</p>}
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className={`w-full ${BUSY}`}
        aria-disabled={locked || undefined}
        aria-describedby={blocked !== null ? blockedId : undefined}
        onClick={() => {
          if (!locked) onSign();
        }}
      >
        {copy.action}
      </Button>
      {blocked !== null ? (
        <p id={blockedId} className="text-sm font-medium text-[color:var(--fg)]">
          {blocked}
        </p>
      ) : null}
      <p className={T.small}>{checks ? copy.noteChecked : copy.note}</p>

      {need === "wallet" ? (
        <div className="grid gap-2">
          <p role="alert" className={ALERT}>
            {copy.needs.wallet}
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
            {copy.needs.network}
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
      ) : note ? (
        <p role="alert" className={ALERT}>
          {note}
        </p>
      ) : null}

      {steps.length > 0 ? (
        <section aria-labelledby={titleId} className="grid gap-2">
          <h3 id={titleId} className={T.label}>
            {copy.title}
          </h3>
          <ol className="grid gap-2">
            {steps.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: steps keep their order for the whole run
              <li key={i} className="grid gap-1">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${DOT[step.status]}`}
                  />
                  <span className="min-w-0 flex-1 text-sm font-medium text-[color:var(--fg)] [overflow-wrap:anywhere]">
                    {labels[i] ?? ""}
                  </span>
                  <span className={`${T.small} shrink-0`}>
                    {fill(copy.status[step.status], wallet)}
                  </span>
                </div>
                {step.hash ? (
                  <a
                    href={explorerTx(step.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK}
                  >
                    {fill(copy.view, { hash: truncateAddress(step.hash) })}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>

          {phase === "stopped" ? (
            <>
              <p role="alert" className={ALERT}>
                {fill(copy.errors[error ?? "failed"], wallet)}
              </p>
              {error === "funds" ? (
                <a
                  href={DEMO_FAUCET ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK}
                >
                  {account.faucet.label}
                </a>
              ) : null}
              {stoppedNote && steps[0]?.status === "done" ? (
                <p className={T.small}>{stoppedNote}</p>
              ) : null}
            </>
          ) : null}

          {phase === "done" ? (
            <div
              className={`grid gap-2 border-l-2 py-1 pl-3 ${ranAttack ? "border-[color:var(--blocked)]" : "border-[color:var(--safe)]"}`}
            >
              <p
                className={`text-sm font-semibold ${ranAttack ? "text-[color:var(--blocked)]" : "text-[color:var(--fg)]"}`}
              >
                {ranAttack ? copy.through : copy.done}
              </p>
              {balance ? (
                <p className="text-sm font-medium tabular-nums text-[color:var(--fg)]">{balance}</p>
              ) : null}
              {outcome.map((line) => (
                <p key={line} className={T.small}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
