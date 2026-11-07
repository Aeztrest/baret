import { hub } from "@baret/content";
import { ImgWell } from "@baret/web-ui/components/Img";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { T } from "@baret/web-ui/lib/type";
import { useCountUp } from "@baret/web-ui/lib/useCountUp";
import type { JSX } from "react";
import { HUB_ART } from "../shared/assets.js";
import { PageHero } from "../shared/PageHero.js";

/**
 * The hub's opening: the claim, the way down to the six sites, and the four
 * numbers the page stands on (sites, kinds of threat, detectors, rules) as one
 * quiet row, then the simulation notice. Six blank tags on a wire on the
 * right: six sites, one trap each. The picture is on the first screen on
 * desktop, so it loads as a priority image, which also shows it without a
 * fade (ImgWell has no separate fade switch).
 */

const { hero, stats } = hub;

/**
 * One figure counting up once on first load (BRAND section 08), the same as
 * the landing's stat tiles: screen readers get the final value once, the
 * counting digits are hidden from them, and an invisible copy of the final
 * value holds the width so nothing shifts. Reduced motion: the value at once.
 */
function Figure({ value }: { value: string }): JSX.Element {
  const shown = useCountUp(value);
  return (
    <>
      <span className="sr-only">{value}</span>
      <span className="relative inline-block tabular-nums" aria-hidden="true">
        <span className="invisible">{value}</span>
        <span className="absolute inset-y-0 right-0">{shown}</span>
      </span>
    </>
  );
}

/**
 * Four figures on one hairline: 2 x 2 on phones, one row from 640 px. The
 * label is the term and comes first in the DOM; the number is drawn above it.
 */
function StatsRow(): JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 sm:gap-x-0 sm:border-t sm:border-[color:var(--rule)] sm:pt-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col-reverse justify-end gap-1 border-t border-[color:var(--rule)] pt-3 sm:border-t-0 sm:border-l sm:px-4 sm:pt-0 sm:first:border-l-0 sm:first:pl-0"
        >
          <dt className={`${T.small} max-w-[16ch]`}>{stat.label}</dt>
          <dd
            data-numeric=""
            className={`font-display text-4xl font-extrabold leading-none text-[color:var(--fg)] ${T.num}`}
          >
            <Figure value={stat.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function HubHero(): JSX.Element {
  return (
    <PageHero
      title={hero.title}
      body={hero.body}
      actions={
        <>
          <LinkButton
            href={hero.actions.primary.href}
            label={hero.actions.primary.label}
            variant="primary"
            size="lg"
            icon="arrow-down"
            fullOnPhone
          />
          <LinkButton
            href={hero.actions.secondary.href}
            label={hero.actions.secondary.label}
            size="lg"
            newTab
            fullOnPhone
          />
        </>
      }
      after={
        <>
          <StatsRow />
          <p className={`${T.small} mt-6 max-w-[60ch]`}>{hero.notice}</p>
        </>
      }
      picture={
        <ImgWell
          asset={HUB_ART.hero}
          ratio="1/1"
          dim
          loading="priority"
          sizes="(min-width: 1024px) 480px, 100vw"
          className="border border-[color:var(--rule)]"
        />
      }
    />
  );
}
