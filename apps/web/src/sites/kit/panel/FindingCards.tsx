import { analysisPanel, demoFrame, findings } from "@baret/content";
import { bodyOf, hasValues } from "@baret/web-ui/components/CheckBlocks";
import type { CheckFinding, Verdict } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { JSX } from "react";

/**
 * The findings as short cards: the title, the sentence, the fix when it
 * applies. Same words as the shared FindingList (bodyOf, hasValues), laid out
 * to scan: one card each, an icon in the verdict's colour, a count in the
 * heading. No findings reads as one quiet line, never as an empty box.
 */

const { panel } = demoFrame;
const copy = analysisPanel;

const EDGE: Record<Verdict, string> = {
  safe: "border-l-[color:var(--rule-strong)]",
  caution: "border-l-[color:var(--caution)]",
  blocked: "border-l-[color:var(--blocked)]",
};
const INK: Record<Verdict, string> = {
  safe: "text-[color:var(--fg-muted)]",
  caution: "text-[color:var(--caution-ink)]",
  blocked: "text-[color:var(--blocked-ink)]",
};

export function FindingCards({
  items,
  verdict,
}: {
  items: readonly CheckFinding[];
  /** The verdict on screen: findings of a Caution answer are amber, of a Blocked one red. */
  verdict: Verdict;
}): JSX.Element {
  const count =
    items.length === 1
      ? copy.findingsCount.one
      : fill(copy.findingsCount.many, { count: String(items.length) });

  return (
    <section className="grid gap-3">
      <h3 className="flex items-baseline justify-between gap-3">
        <span className={T.label}>{panel.findings}</span>
        {items.length > 0 ? <span className={T.label}>{count}</span> : null}
      </h3>
      {items.length === 0 ? (
        <p className={`flex items-center gap-2 ${T.small}`}>
          <CircleCheck
            aria-hidden="true"
            className="size-4 shrink-0 text-[color:var(--safe-ink)]"
          />
          {panel.noFindings}
        </p>
      ) : (
        <ul className="grid gap-2">
          {items.map((item, i) => {
            const text = findings[item.code];
            const { template, values } = bodyOf(text, item);
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: an answer can repeat a code (both sides of a compliance check), and the list never reorders.
                key={`${item.code}-${i}`}
                className={`bp-rise flex gap-3 rounded-[var(--radius-sm)] border border-l-4 border-[color:var(--rule)] bg-[color:var(--surface)] px-4 py-3 ${EDGE[verdict]}`}
                style={{ animationDelay: `${120 + i * 80}ms` }}
              >
                <TriangleAlert
                  aria-hidden="true"
                  className={`mt-0.5 size-4 shrink-0 ${INK[verdict]}`}
                />
                <div className="grid min-w-0 gap-1">
                  <p className="font-medium text-[color:var(--fg)]">
                    {fill(text.title, item.values)}
                  </p>
                  <p className={T.small}>{fill(template, values)}</p>
                  {"fix" in text && text.fix && hasValues(text.fix, item.values) ? (
                    <p className="text-sm text-[color:var(--fg)]">{fill(text.fix, item.values)}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
