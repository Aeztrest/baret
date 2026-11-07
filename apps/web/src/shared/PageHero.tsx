import { titleIdOf } from "@baret/web-ui/components/Section";
import { TwoToneText } from "@baret/web-ui/components/SectionHeader";
import { TextReveal } from "@baret/web-ui/components/TextReveal";
import { FRAME, GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import type { JSX, ReactNode } from "react";

/**
 * The opening of an inner marketing page (hub, docs, install): a light,
 * split hero in the landing's frame. The copy column is an `@container`, so
 * the stencil title (T.h1Page) grows with its column; the lead's first
 * sentence is in --fg, the rest muted; the actions sit in the first viewport
 * at every width. The picture takes the right-hand columns from 1024 px and
 * follows the copy on phones, so the main action is never pushed down.
 *
 * `below` is a full-width row under both (the docs timeline). The title
 * reveals word by word on mount (it is above the fold); reduced motion shows
 * plain text.
 */
export function PageHero({
  id = "hero",
  title,
  body,
  keepCase,
  actions,
  after,
  picture,
  below,
}: {
  id?: string;
  title: string;
  body: string;
  keepCase?: readonly string[];
  /** The action row: one primary LinkButton at most. */
  actions: ReactNode;
  /** Small print under the actions (a notice, a stats row). */
  after?: ReactNode;
  picture: ReactNode;
  below?: ReactNode;
}): JSX.Element {
  return (
    <section
      id={id}
      aria-labelledby={titleIdOf(id)}
      className="relative bg-[color:var(--ground)] pt-10 pb-12 md:pt-12 md:pb-16 lg:pt-16 lg:pb-24"
    >
      <div className={FRAME}>
        <div className={`${GRID} gap-y-10 lg:items-center`}>
          <div className="@container col-span-4 md:col-span-8 lg:col-span-7">
            <TextReveal
              as="h1"
              id={titleIdOf(id)}
              className={`${T.h1Page} text-balance text-[color:var(--fg)]`}
              text={title}
              immediate
              {...(keepCase ? { keepCase } : {})}
            />
            <p className={`${T.lead} mt-6 max-w-[52ch] md:mt-8`}>
              <TwoToneText text={body} />
            </p>
            <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
            {after ? <div className="mt-8">{after}</div> : null}
          </div>
          <div className="col-span-4 md:col-span-8 lg:col-span-5">{picture}</div>
        </div>
        {below ? <div className="mt-12 lg:mt-16">{below}</div> : null}
      </div>
    </section>
  );
}
