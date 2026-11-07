import { home } from "@baret/content";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { SectionFrame } from "../../shared/SectionFrame.js";
import { SectionHeader } from "../../shared/SectionHeader.js";
import { ShowcaseCard } from "./showcase/ShowcaseCard.js";

/**
 * Six dApps: the six fake sites as one grid of equal cards (one column,
 * two from 768 px, three from 1024 px), each with its illustration on top
 * at one crop. Each site is one link and opens in a new tab. A footer
 * follows: the notice on the left, a ghost link into the showcase on the
 * right (stacked below 768 px).
 */
export function ShowcaseSection(): JSX.Element {
  const s = home.showcase;
  return (
    <SectionFrame sectionKey="showcase" ground="ground">
      <SectionHeader sectionKey="showcase" layout="split" title={s.title} body={s.body} />
      <Reveal className="mt-10">
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {s.cards.map((card) => (
            <li key={card.href}>
              <ShowcaseCard card={card} />
            </li>
          ))}
        </ul>
      </Reveal>
      <div className="mt-6 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <p className={`${T.small} max-w-[60ch]`}>{s.notice}</p>
        <LinkButton href={s.action.href} label={s.action.label} variant="ghost" newTab />
      </div>
    </SectionFrame>
  );
}
