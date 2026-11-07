import { home } from "@baret/content";
import { Tag } from "@baret/ui/primitives/Tag";
import { Img } from "@baret/web-ui/components/Img";
import { VERDICT_TONE } from "@baret/web-ui/lib/tone";
import { T } from "@baret/web-ui/lib/type";
import { ArrowUpRight } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router";
import { routeKeyFor, warm } from "../../../routes.js";
import { DARK_PRINT } from "../pillars/Tile.js";
import { CARD_MEDIA, WELL_GROUND } from "./cardMedia.js";

export type ShowcaseCardData = (typeof home.showcase.cards)[number];

/**
 * One site, one anchor, one card at every width: the illustration on top at
 * one 16:9 crop, then the name with its verdict, the hook and the open cue.
 * The product name's link stretches over the whole card with an `::after`,
 * so the card is the link and its accessible name is the product name.
 * The site opens in a new tab, so the landing stays where the reader left it.
 * The focus ring is drawn on the card (a ring on the anchor would only
 * circle the name). Hover pushes the illustration 2.5 % and nudges the arrow.
 */
const FOCUS =
  "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-[3px] has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-[color:var(--accent)]";

const STRETCH = "after:absolute after:inset-0 focus-visible:outline-none";

const NUDGE =
  "size-4 shrink-0 transition-transform duration-150 ease-out group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 group-has-[a:focus-visible]/card:translate-x-0.5 group-has-[a:focus-visible]/card:-translate-y-0.5 motion-reduce:transition-none";

/**
 * The page's only image hover: a slow 2.5% push on the card's illustration,
 * because the card is a real link. It sits on a wrapper so it never fights
 * the Img fade's transition; clipped by the well; off under reduced motion.
 */
const SLOW_ZOOM =
  "transition-transform duration-[600ms] ease-out-soft group-hover/card:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100";

/** The cue: "Open the site" and an up-right arrow (it opens a new tab), pinned to the bottom. */
function OpenCue(): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="mt-auto flex items-center gap-2 pt-4 font-sans font-semibold text-[14px] text-[color:var(--fg-muted)] leading-5 transition-colors duration-150 ease-out group-hover/card:text-[color:var(--fg)] group-has-[a:focus-visible]/card:text-[color:var(--fg)]"
    >
      {home.showcase.labels.open}
      <ArrowUpRight className={NUDGE} strokeWidth={1.5} />
    </span>
  );
}

/** The illustration well: one cover crop for all six, dimmed in dark theme (DARK_PRINT, shared with the bento tiles). */
function MediaWell({ href }: { href: string }): JSX.Element {
  const m = CARD_MEDIA[href];
  return (
    <div
      className={`relative aspect-[16/9] w-full shrink-0 overflow-hidden border-b border-[color:var(--rule)] ${DARK_PRINT}`}
      style={{ backgroundColor: WELL_GROUND }}
    >
      {m ? (
        <div className={`absolute inset-0 ${SLOW_ZOOM}`}>
          <Img
            asset={m.asset}
            fit="cover"
            position={m.position}
            sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, calc(100vw - 32px)"
            className="absolute inset-0 size-full"
          />
        </div>
      ) : null}
    </div>
  );
}

/** The expected verdict: an sr-only label, then the tag, the item's only colour. */
function Verdict({ card }: { card: ShowcaseCardData }): JSX.Element {
  return (
    <span>
      <span className="sr-only">{home.showcase.labels.verdict} </span>
      <Tag tone={VERDICT_TONE[card.verdict]} size="sm">
        {home.showcase.verdicts[card.verdict]}
      </Tag>
    </span>
  );
}

/** Starts loading the site's route chunk on intent, once (routes.warm); the new tab then hits the HTTP cache. */
function warmCard(href: string): void {
  const key = routeKeyFor(href);
  if (key) warm(key);
}

/** One site: well, name, verdict under it, hook, then the tap cue. */
export function ShowcaseCard({ card }: { card: ShowcaseCardData }): JSX.Element {
  return (
    <article
      className={`group/card relative flex h-full flex-col border border-[color:var(--rule)] bg-[color:var(--surface)] transition-[background-color,border-color] duration-150 ease-out hover:border-[color:var(--fg)] active:bg-[color:var(--ground-deep)] has-[a:focus-visible]:border-[color:var(--fg)] ${FOCUS}`}
    >
      <MediaWell href={card.href} />
      <div className="@container/text flex min-w-0 flex-1 flex-col px-5 py-4">
        <div className="flex flex-col items-start gap-1 @[22rem]/text:flex-row @[22rem]/text:items-center @[22rem]/text:justify-between @[22rem]/text:gap-4">
          <h3 className={`${T.h3} text-[color:var(--fg)]`}>
            <Link
              to={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className={STRETCH}
              onPointerEnter={() => warmCard(card.href)}
              onFocus={() => warmCard(card.href)}
            >
              {card.name}
            </Link>
          </h3>
          <Verdict card={card} />
        </div>
        <p className={`${T.body} mt-1.5`}>{card.hook}</p>
        <OpenCue />
      </div>
    </article>
  );
}
