import { analysisPanel, common, hub } from "@baret/content";
import { asVerdict, type ExpectedKind } from "@baret/web-ui/components/CheckBlocks";
import type { Verdict } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { JSX } from "react";

/**
 * The first thing the panel shows once the answer is in: one verdict, big,
 * in its colour and with its own icon, and one sentence why. A live answer
 * carries a compact "Expected / Live" line under it, so a judge can see at a
 * glance that the server agreed with the page. The icon is never the only
 * signal: the word is always written out.
 */

const copy = analysisPanel;

const ICON = { safe: ShieldCheck, caution: ShieldAlert, blocked: ShieldX } as const;

const TONE: Record<Verdict, { card: string; ink: string }> = {
  safe: {
    card: "border-[color:var(--safe)] bg-[color:var(--safe-dim)]",
    ink: "text-[color:var(--safe-ink)]",
  },
  caution: {
    card: "border-[color:var(--caution)] bg-[color:var(--caution-dim)]",
    ink: "text-[color:var(--caution-ink)]",
  },
  blocked: {
    card: "border-[color:var(--blocked)] bg-[color:var(--blocked-dim)]",
    ink: "text-[color:var(--blocked-ink)]",
  },
};

/** The word for an expected verdict: "capped" reads "Blocked at the cap". */
export function expectedLabel(expected: ExpectedKind): string {
  return expected === "capped" ? hub.cardLabels.verdicts.capped : common.verdicts[expected].label;
}

export function VerdictHero({
  kind,
  verdict,
  label,
  line,
  kicker,
  expected,
}: {
  /** Where the verdict came from: the page's sample, Baret's server, or no answer. */
  kind: "sample" | "live" | "failed";
  verdict: Verdict;
  /** The word on the card; defaults to the verdict's own label. */
  label?: string;
  /** One sentence why. */
  line: string;
  /** The small label above the word; defaults to where the verdict came from. */
  kicker?: string | undefined;
  /** Set on a live answer: the verdict the page expected, for the comparison line. */
  expected?: ExpectedKind;
}): JSX.Element {
  const Icon = ICON[verdict];
  const tone = TONE[verdict];
  const matches = expected ? asVerdict(expected) === verdict : true;

  return (
    <section
      aria-labelledby="bp-verdict"
      className={`bp-rise grid gap-3 rounded-[var(--radius-md)] border-l-4 px-5 py-5 ${tone.card}`}
    >
      <p className={T.label}>{kicker ?? copy.verdictKicker[kind]}</p>
      <div className="flex items-center gap-3">
        <Icon
          aria-hidden="true"
          className={`bp-stamp size-9 shrink-0 ${tone.ink}`}
          strokeWidth={2}
        />
        <h3
          id="bp-verdict"
          className={`font-display text-[2rem] leading-none font-extrabold uppercase md:text-[2.5rem] ${tone.ink}`}
        >
          {label ?? common.verdicts[verdict].label}
        </h3>
      </div>
      <p className={`${T.body} text-[color:var(--fg)]`}>{line}</p>

      {expected ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[color:var(--rule)] pt-3 text-sm">
          <dl className="contents">
            <div className="flex gap-1.5">
              <dt className="text-[color:var(--fg-muted)]">{copy.compare.expected}</dt>
              <dd className="font-medium text-[color:var(--fg)]">{expectedLabel(expected)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-[color:var(--fg-muted)]">{copy.compare.live}</dt>
              <dd className="font-medium text-[color:var(--fg)]">
                {common.verdicts[verdict].label}
              </dd>
            </div>
          </dl>
          <p
            className={`rounded-full px-2 py-0.5 font-mono text-label uppercase ${
              matches
                ? "bg-[color:var(--safe-dim)] text-[color:var(--safe-ink)]"
                : "bg-[color:var(--caution-dim)] text-[color:var(--caution-ink)]"
            }`}
          >
            {matches ? copy.compare.match : copy.compare.mismatch}
          </p>
        </div>
      ) : null}
    </section>
  );
}
