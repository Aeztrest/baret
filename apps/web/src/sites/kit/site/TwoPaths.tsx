import { demoFrame } from "@baret/content";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import type { JSX } from "react";

/**
 * The attack version's "one request, two paths" (M2), set right above the
 * buttons so it is read before a press: with Baret the request is declined
 * before anything is signed; with a wallet that has no pre-sign check it goes
 * to that wallet's own prompt and can be approved. Two equal columns on a
 * wide card, stacked on a narrow one. Static: nothing moves.
 */

const copy = demoFrame.sign.paths;

const ROW = "grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 p-3";

export function TwoPaths(): JSX.Element {
  return (
    <section
      aria-label={copy.title}
      className="grid border border-[color:var(--rule)] text-[color:var(--fg)] @container"
    >
      <p className="border-b border-[color:var(--rule)] px-3 py-2 font-display text-xs font-extrabold uppercase tracking-[0.06em] text-[color:var(--fg-muted)]">
        {copy.title}
      </p>
      <div className="grid @[30rem]:grid-cols-2">
        <div
          className={`${ROW} border-b border-[color:var(--rule)] @[30rem]:border-r @[30rem]:border-b-0`}
        >
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-4 text-[color:var(--safe)]"
            strokeWidth={2}
          />
          <p className="text-sm font-semibold">{copy.baret.label}</p>
          <p className="col-start-2 text-sm leading-normal text-[color:var(--fg-muted)]">
            {copy.baret.body}
          </p>
        </div>
        <div className={ROW}>
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 text-[color:var(--blocked)]"
            strokeWidth={2}
          />
          <p className="text-sm font-semibold">{copy.plain.label}</p>
          <p className="col-start-2 text-sm leading-normal text-[color:var(--fg-muted)]">
            {copy.plain.body}
          </p>
        </div>
      </div>
    </section>
  );
}
