import { analysisPanel, demoFrame } from "@baret/content";
import { ClaimsList, TheAsk } from "@baret/web-ui/components/CheckBlocks";
import { ImgWell } from "@baret/web-ui/components/Img";
import { T } from "@baret/web-ui/lib/type";
import { ChevronDown } from "lucide-react";
import type { JSX } from "react";
import type { ImgAsset } from "../../../shared/assets.js";

/**
 * Everything a curious reader or a judge may want, folded by default so the
 * verdict, the changes and the findings stay above the fold: what the site
 * asks for and the raw call, what the page claims next to what Baret checks,
 * the note on the expected verdict, and the scenario's illustration.
 */

const { panel } = demoFrame;
const copy = analysisPanel.details;

export function PanelDetails({
  asks,
  call,
  claims,
  image,
}: {
  asks: string;
  call: string;
  claims?: readonly { claim: string; check: string }[];
  image?: ImgAsset | undefined;
}): JSX.Element {
  return (
    <details className="group rounded-[var(--radius-sm)] border border-[color:var(--rule)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] [&::-webkit-details-marker]:hidden">
        <span className="grid gap-0.5">
          <span className="font-medium text-[color:var(--fg)]">{copy.summary}</span>
          <span className={T.small}>{copy.hint}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-[color:var(--fg-muted)] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="grid gap-5 border-t border-[color:var(--rule)] px-4 pt-1 pb-5">
        <TheAsk asks={asks} call={call} />
        {claims && claims.length > 0 ? <ClaimsList claims={claims} /> : null}
        <section className="grid gap-2 border-t border-[color:var(--rule)] pt-5">
          <h3 className={T.label}>{panel.expected}</h3>
          <p className={T.small}>{panel.expectedNote}</p>
        </section>
        {image ? (
          <ImgWell
            asset={image}
            ratio="16/10"
            fit="contain"
            sizes="(min-width: 640px) 440px, 100vw"
            className="rounded-[var(--radius-sm)] border border-[color:var(--rule)]"
          />
        ) : null}
      </div>
    </details>
  );
}
