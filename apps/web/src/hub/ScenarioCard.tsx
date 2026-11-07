import { hub } from "@baret/content";
import { Tag } from "@baret/ui/primitives/Tag";
import { Img } from "@baret/web-ui/components/Img";
import { VERDICT_TONE } from "@baret/web-ui/lib/tone";
import { T } from "@baret/web-ui/lib/type";
import { ArrowUpRight } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router";
import { CARD_MEDIA, WELL_GROUND } from "../landing/sections/showcase/cardMedia.js";
import { routeKeyFor, routes, warm } from "../routes.js";
import type { Scenario } from "../sites/scenarios.js";

/**
 * One site on the hub, one anchor: the name's link stretches over the whole
 * card (`::after`), so the card is the link and its accessible name is the
 * site's name; the verdict, the summary and the three "Watch for" lines stay
 * readable to screen readers. The focus ring is drawn on the card. Same
 * picture as the landing's card for the site, so a site keeps one face.
 *
 * Every card opens its site in a new tab (the hub stays open behind it).
 *
 * Hover: the border turns --fg and the picture pushes 2.5 % over 600 ms (the
 * card is a real link). Pressing tints the card before the route loads; intent
 * warms the site's chunk once.
 */

const { cardLabels } = hub;

const FOCUS =
  "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-[3px] has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-[color:var(--accent)]";
const STRETCH = "after:absolute after:inset-0 focus-visible:outline-none";
const PUSH =
  "transition-transform duration-[600ms] ease-out-soft group-hover/card:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100";
const NUDGE =
  "size-4 shrink-0 transition-transform duration-150 ease-out group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 group-has-[a:focus-visible]/card:translate-x-0.5 group-has-[a:focus-visible]/card:-translate-y-0.5 motion-reduce:transition-none";

/**
 * The site's path, from its slug: the registry's entry once the site is
 * ported, its pending path until then (routes.ts PENDING_PATHS).
 */
function pathOf(scenario: Scenario): string {
  const key = routeKeyFor(`/${scenario.slug}`);
  return key ? routes[key].path : `/${scenario.slug}`;
}

export function ScenarioCard({ scenario }: { scenario: Scenario }): JSX.Element {
  const href = pathOf(scenario);
  const media = CARD_MEDIA[href];
  const intent = (): void => {
    const key = routeKeyFor(href);
    if (key) warm(key);
  };
  return (
    <article
      className={`group/card relative flex h-full flex-col border border-[color:var(--rule)] bg-[color:var(--surface)] transition-[border-color,background-color] duration-150 ease-out hover:border-[color:var(--fg)] active:bg-[color:var(--ground-deep)] has-[a:focus-visible]:border-[color:var(--fg)] ${FOCUS}`}
    >
      <div
        className="relative aspect-[16/9] overflow-hidden border-b border-[color:var(--rule)] dark:brightness-[0.78] dark:contrast-[1.05]"
        style={{ backgroundColor: WELL_GROUND }}
      >
        {media ? (
          <div className={`absolute inset-0 ${PUSH}`}>
            <Img
              asset={media.asset}
              position={media.position}
              sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
              className="absolute inset-0 size-full"
            />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5 lg:p-6">
        <p className={T.label}>{scenario.category}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 className={`${T.h3} text-[color:var(--fg)]`}>
            <Link
              to={href}
              target="_blank"
              rel="noopener noreferrer"
              className={STRETCH}
              onPointerEnter={intent}
              onFocus={intent}
            >
              {scenario.name}
              <span className="sr-only"> {cardLabels.newTab}</span>
            </Link>
          </h3>
          <span>
            <span className="sr-only">{cardLabels.verdict} </span>
            <Tag tone={VERDICT_TONE[scenario.verdict]} size="sm">
              {cardLabels.verdicts[scenario.verdict]}
            </Tag>
          </span>
        </div>
        <p className={`${T.body} mt-3`}>{scenario.summary}</p>
        <p className={`${T.label} mt-6`}>{cardLabels.watchFor}</p>
        <ul className="mt-2 border-t border-[color:var(--rule)]">
          {scenario.watchFor.map((line) => (
            <li
              key={line}
              className="border-b border-[color:var(--rule)] py-2 text-sm leading-normal text-[color:var(--fg)]"
            >
              {line}
            </li>
          ))}
        </ul>
        <span
          aria-hidden="true"
          className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-[color:var(--fg-muted)] transition-colors duration-150 group-hover/card:text-[color:var(--fg)] group-has-[a:focus-visible]/card:text-[color:var(--fg)]"
        >
          {cardLabels.open}
          <ArrowUpRight className={NUDGE} strokeWidth={1.5} />
        </span>
      </div>
    </article>
  );
}
