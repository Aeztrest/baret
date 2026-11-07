import { common, demoFrame, findings } from "@baret/content";
import { Button, Sheet, SheetContent, SheetDescription, SheetTitle, Tag } from "@baret/ui";
import { ChangeList, type ExpectedKind } from "@baret/web-ui/components/CheckBlocks";
import { PlainWords } from "@baret/web-ui/components/PlainWords";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, type ReactNode, useLayoutEffect, useRef } from "react";
import type { ImgAsset } from "../../shared/assets.js";
import { shortAddress } from "./live.js";
import { Analyzing } from "./panel/Analyzing.js";
import { Callout } from "./panel/Callout.js";
import { FindingCards } from "./panel/FindingCards.js";
import { PANEL_MOTION } from "./panel/motion.js";
import { PanelDetails } from "./panel/PanelDetails.js";
import { expectedLabel, VerdictHero } from "./panel/VerdictHero.js";
import type { CheckState } from "./useCheck.js";
import { DEMO_CHECK_FROM } from "./wallet/useDemoWallet.js";

/**
 * Baret's panel on top of a demo dApp. It opens when the site's main button
 * is pressed, shows the check as four stages over the request, then the
 * result before anything is signed. It always sits in data-scope="baret", so
 * it keeps Baret's palette on any dApp theme, like the real extension would.
 *
 * The result reads top to bottom in the order a signer needs it: the verdict
 * and one sentence why, what changes, the findings, KIMI's plain words, what
 * would happen if it were signed, the lesson. The call, the page's claims,
 * the note on the expected verdict and the illustration fold into "Details".
 *
 * - sample: the expected verdict and the prepared findings;
 * - live: Baret's verdict, with a compact "Expected / Live" line under it;
 * - failed: Blocked, and a note that the check did not finish.
 *
 * A sample result offers "Check it live" (useCheck sets it): the same
 * request through Baret's server from a demo address, then labelled so.
 *
 * Shared by all six demo sites: each one passes its own copy.
 */

const { panel, outcome } = demoFrame;

export interface PanelCopy {
  readonly asks: string;
  readonly call: string;
  readonly expected: ExpectedKind;
  readonly expectedBody: string;
  readonly claims: readonly { claim: string; check: string }[];
  readonly without: { title: string; body: string };
  readonly lesson: { title: string; body: string };
}

export function AnalysisPanel({
  open,
  onOpenChange,
  state,
  live,
  mode,
  copy,
  image,
  extra,
  after,
  onTryOther,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: CheckState;
  /** True when the check goes to Baret's server, so the header can say so from the start. */
  live: boolean;
  /** The version that was checked, which may differ from the one switched on now. */
  mode: DemoMode;
  copy: PanelCopy;
  /** The scenario's illustration, folded into Details so it never pushes the verdict down. */
  image?: ImgAsset;
  /**
   * A site's own block after the verdict, for what the shared blocks cannot
   * show (Scrybe's run of payments against the cap).
   */
  extra?: ReactNode;
  /** A site's own block after the lesson (Scrybe's way to the agents page). */
  after?: ReactNode;
  onTryOther: () => void;
}): JSX.Element {
  const result = state.phase === "done" ? state.result : null;

  // The sheet opens from state, with no Radix trigger, so Radix has nothing
  // to send focus back to. Remember the control that opened it (a layout
  // effect runs before the sheet moves focus inside) and return there.
  const opener = useRef<HTMLElement | null>(null);
  // "Check it live" unmounts itself; focus moves to the header first so a
  // keyboard or screen-reader user is not dropped to <body>.
  const header = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const el = document.activeElement;
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
  }, [open]);

  // A live answer leads with its own reason: the first finding's title, or
  // what the verdict itself means when there is none. The page's prepared
  // sentence stays with a sample; on a live answer the expectation lives
  // only in the compact "Expected / Live" line.
  const first = result?.findings[0];
  const line =
    result && result.source === "live"
      ? first
        ? fill(findings[first.code].title, first.values)
        : common.verdicts[result.verdict].line
      : copy.expectedBody;
  // The lesson talks about the attack: it shows only when the answer does,
  // so an honest Safe result does not carry a warning that does not apply.
  const lessonApplies = result ? result.verdict !== "safe" || result.findings.length > 0 : false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={common.actions.close}
        data-scope="baret"
        onCloseAutoFocus={(event) => {
          const el = opener.current;
          if (!el?.isConnected) return;
          event.preventDefault();
          el.focus();
        }}
        className="gap-0 overflow-y-auto p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
      >
        <style>{PANEL_MOTION}</style>
        <header
          ref={header}
          tabIndex={-1}
          className="grid gap-2 border-b border-[color:var(--rule)] px-6 pt-5 pb-4 pr-14 outline-none"
        >
          <div className="flex items-center gap-3">
            <Tag tone="brand" size="sm">
              {common.brand.wordmark}
            </Tag>
            <SheetTitle className="font-display text-lg font-bold uppercase leading-none tracking-[0.02em] text-[color:var(--fg)]">
              {panel.title}
            </SheetTitle>
          </div>
          <SheetDescription className={T.small}>
            {/* A shown answer says where it came from; a wallet connected
                after a sample check does not relabel that sample. */}
            {(result ? result.source !== "sample" : live) ? panel.liveNote : panel.sample}
          </SheetDescription>
          {/* A visitor with no wallet can still ask Baret's server: the same
              request from a demo address, labelled as such. */}
          {state.phase === "done" && state.demo ? (
            <p className={`${T.small} text-[color:var(--fg)]`}>
              {fill(panel.checkLive.note, { address: shortAddress(DEMO_CHECK_FROM) })}
            </p>
          ) : null}
          {state.phase === "done" && state.checkLive ? (
            <div className="flex pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  header.current?.focus();
                  state.checkLive?.();
                }}
              >
                {panel.checkLive.label}
              </Button>
            </div>
          ) : null}
        </header>

        {/* The verdict is announced once it is ready; focus stays put. */}
        <p role="status" className="sr-only">
          {result ? common.verdicts[result.verdict].aria : ""}
        </p>

        {/* Addresses are one long word: let them wrap so the panel never
            outgrows a phone screen. */}
        <div className="grid gap-6 px-6 py-6 [overflow-wrap:anywhere]">
          {state.phase === "checking" ? <Analyzing step={state.step} call={copy.call} /> : null}

          {result?.source === "failed" ? (
            <>
              <VerdictHero
                kind="failed"
                verdict={result.verdict}
                kicker={panel.failed.title}
                line={panel.failed.body}
              />
              <PanelDetails asks={copy.asks} call={copy.call} image={image} />
            </>
          ) : null}

          {result && result.source !== "failed" ? (
            <>
              {result.source === "live" ? (
                <VerdictHero
                  kind="live"
                  verdict={result.verdict}
                  line={line}
                  expected={copy.expected}
                />
              ) : (
                <VerdictHero
                  kind="sample"
                  verdict={result.verdict}
                  label={expectedLabel(copy.expected)}
                  line={line}
                />
              )}
              {extra}
              <div
                className="bp-rise [&>section]:border-t-0 [&>section]:pt-0"
                style={{ animationDelay: "80ms" }}
              >
                <ChangeList rows={result.changes} approvals={result.approvals} />
              </div>
              <FindingCards items={result.findings} verdict={result.verdict} />
              {/* KIMI's plain-words reading of a live verdict; nothing when it is unavailable. */}
              {result.source === "live" && result.requestId ? (
                <PlainWords requestId={result.requestId} verdict={result.verdict} />
              ) : null}
              {mode === "danger" ? (
                <Callout tone="blocked" title={copy.without.title} body={copy.without.body} />
              ) : null}
              {lessonApplies ? (
                <Callout tone="neutral" title={panel.lesson} body={copy.lesson.body} />
              ) : null}
              {after}
              <PanelDetails asks={copy.asks} call={copy.call} claims={copy.claims} image={image} />
            </>
          ) : null}
        </div>

        {result ? (
          <footer className="mt-auto sm:sticky sm:bottom-0 grid gap-3 border-t border-[color:var(--rule-strong)] bg-[color:var(--ground)] px-6 py-4 sm:flex sm:items-center sm:justify-between">
            <div className="grid gap-0.5">
              <p className="font-medium text-[color:var(--fg)]">{outcome.stopped.title}</p>
              <p className={T.small}>{outcome.stopped.body}</p>
            </div>
            <Button type="button" variant="ghost" onClick={onTryOther} className="shrink-0">
              {outcome.again.label}
            </Button>
          </footer>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
