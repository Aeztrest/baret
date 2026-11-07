import { T } from "@baret/web-ui/lib/type";
import { Lightbulb, TriangleAlert } from "lucide-react";
import type { JSX } from "react";

/**
 * A short titled note in the panel: "If this were signed" in the Blocked
 * colour (what the attack would do), "Take this with you" in a neutral one.
 */
export function Callout({
  tone,
  title,
  body,
}: {
  tone: "blocked" | "neutral";
  title: string;
  body: string;
}): JSX.Element {
  const Icon = tone === "blocked" ? TriangleAlert : Lightbulb;
  return (
    <section
      className={`flex gap-3 rounded-[var(--radius-sm)] px-4 py-4 ${
        tone === "blocked"
          ? "bg-[color:var(--blocked-dim)]"
          : "border border-[color:var(--rule)] bg-[color:var(--surface)]"
      }`}
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 size-4 shrink-0 ${tone === "blocked" ? "text-[color:var(--blocked-ink)]" : "text-[color:var(--fg-muted)]"}`}
      />
      <div className="grid gap-1">
        <h3 className="font-medium text-[color:var(--fg)]">{title}</h3>
        <p className={T.small}>{body}</p>
      </div>
    </section>
  );
}
