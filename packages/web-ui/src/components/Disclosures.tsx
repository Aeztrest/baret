import { ChevronDown, Plus } from "lucide-react";
import type { JSX } from "react";
import { T } from "../lib/type.js";
import { cx } from "../lib/util.js";

/**
 * A list of native <details> that act as one group: every item carries the
 * same `name`, so opening one closes the others (the exclusive-disclosure
 * rule, FRONTEND section 2). FAQ lists, troubleshooting, any question list.
 *
 * Native on purpose: keyboard, find-in-page and screen readers work with no
 * script. Hairlines between items, no boxes. The open ease comes from
 * `details::details-content` in tokens.css (Chromium; other browsers open at
 * once; reduced motion is instant everywhere).
 *
 * The glyph is quiet on Baret's own pages (`chevron`, muted ink, so a long
 * list never adds orange to the viewport) and the site's accent on a demo
 * dApp (`plus`, which takes that dApp's palette).
 */
export function Disclosures({
  name,
  items,
  glyph = "chevron",
  className,
}: {
  /** One name per list: it is what makes the items exclusive. */
  name: string;
  items: readonly { readonly summary: string; readonly body: string }[];
  glyph?: "chevron" | "plus";
  className?: string;
}): JSX.Element {
  return (
    <div className={cx("border-t border-[color:var(--rule)]", className)}>
      {items.map((item) => (
        <details
          key={item.summary}
          name={name}
          className="group border-b border-[color:var(--rule)]"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium leading-snug text-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)] [&::-webkit-details-marker]:hidden">
            {item.summary}
            {glyph === "plus" ? (
              <Plus
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-5 shrink-0 text-[color:var(--accent)] transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none"
              />
            ) : (
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-5 shrink-0 text-[color:var(--fg-muted)] transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
              />
            )}
          </summary>
          <p className={`${T.body} max-w-[64ch] pb-5`}>{item.body}</p>
        </details>
      ))}
    </div>
  );
}
