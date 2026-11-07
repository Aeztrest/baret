import { analysisPanel } from "@baret/content";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { Check } from "lucide-react";
import type { JSX } from "react";

/**
 * The panel while Baret checks one request: a scanning card over the call,
 * four stages that tick as the walk moves on, and the skeleton of the result
 * to come. The stages present one request (useCheck's walk), so nothing here
 * keeps its own clock; the last stage stays active until the answer lands.
 *
 * Motion is CSS only and lives under prefers-reduced-motion: no-preference
 * (PANEL_MOTION), so reduced motion gets the same stages, still.
 */

const copy = analysisPanel;

export function Analyzing({ step, call }: { step: number; call: string }): JSX.Element {
  const stages = copy.stages;
  const current = Math.min(Math.max(step, 0), stages.length - 1);
  // Progress grows with each finished stage, and half a stage for the active one.
  const progress = Math.round(((current + 0.5) / stages.length) * 100);
  const active = stages[current];

  return (
    <div className="grid gap-6" aria-busy="true">
      <div className="grid gap-3">
        <p className={T.label}>{copy.checking}</p>
        {/* The request under a scanning line: what Baret is reading right now. */}
        <div className="relative overflow-hidden rounded-[var(--radius-sm)] border border-[color:var(--rule)] bg-[color:var(--ground)] px-4 py-3">
          <code className="block font-mono text-sm text-[color:var(--fg)] [overflow-wrap:anywhere]">
            {call}
          </code>
          <span aria-hidden="true" className="bp-scan" />
        </div>
        <div
          role="progressbar"
          aria-label={copy.checking}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1 overflow-hidden rounded-full bg-[color:var(--rule)]"
        >
          <div
            className="h-full rounded-full bg-[color:var(--accent)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* One polite line per stage, so a screen reader hears the walk once. */}
      <p aria-live="polite" className="sr-only">
        {active ? fill(copy.stageAria, { stage: active.title }) : ""}
      </p>

      <ol className="grid gap-1">
        {stages.map((stage, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li
              key={stage.title}
              className={`flex items-start gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 transition-colors duration-300 motion-reduce:transition-none ${now ? "bg-[color:var(--surface)]" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${
                  done
                    ? "border-transparent bg-[color:var(--fg)] text-[color:var(--ground)]"
                    : now
                      ? "border-[color:var(--accent)]"
                      : "border-[color:var(--rule-strong)]"
                }`}
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : null}
                {now ? (
                  <span className="bp-dot size-2 rounded-full bg-[color:var(--accent)]" />
                ) : null}
              </span>
              <span className="grid gap-0.5">
                <span
                  className={`text-sm font-medium ${done || now ? "text-[color:var(--fg)]" : "text-[color:var(--fg-muted)]"}`}
                >
                  {stage.title}
                </span>
                {now ? <span className={T.small}>{stage.note}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {/* The shape of the answer to come: verdict, a line, two findings. */}
      <div aria-hidden="true" className="grid gap-3">
        <p className={T.label}>{copy.pendingVerdict}</p>
        <div className="bp-skeleton h-20 rounded-[var(--radius-sm)]" />
        <div className="bp-skeleton h-4 w-3/4 rounded-full" />
        <div className="bp-skeleton h-14 rounded-[var(--radius-sm)]" />
        <div className="bp-skeleton h-14 rounded-[var(--radius-sm)]" />
      </div>
    </div>
  );
}
