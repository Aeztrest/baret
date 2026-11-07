import { ImgWell } from "@baret/web-ui/components/Img";
import { Reveal } from "@baret/web-ui/components/Reveal";
import type { ImgAsset } from "@baret/web-ui/lib/img";
import { FRAME, GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, useId } from "react";
import { Figure } from "./Page.js";

/**
 * The rest of a demo dApp's home page, in the landing's grammar: a number or
 * a heading, one short paragraph, rows of equal items on hairlines. The
 * stats are the fake site's own claims; Baret's panel says which of them it
 * cannot check. Shared by the six sites, each passing its own copy.
 */

type Stat = { readonly value: string; readonly label: string };
type Block = { readonly title: string; readonly body: string };
type Faq = { readonly question: string; readonly answer: string };

/**
 * The site's headline figures, each counting up once in view. `title` names
 * the block for heading navigation; it is read by screen readers only, since
 * the figures speak for themselves on screen.
 */
export function Stats({ items, title }: { items: readonly Stat[]; title?: string }): JSX.Element {
  const id = useId();
  return (
    <section
      className="border-y border-[color:var(--rule)]"
      {...(title ? { "aria-labelledby": id } : {})}
    >
      {title ? (
        <h2 id={id} className="sr-only">
          {title}
        </h2>
      ) : null}
      <Reveal>
        <dl className={`${FRAME} grid grid-cols-1 sm:grid-cols-3`}>
          {items.map((stat, i) => (
            // The term comes first in the markup; flex-col-reverse keeps the figure on top.
            <div
              key={stat.label}
              className={`flex flex-col-reverse justify-end gap-1 py-8 ${i > 0 ? "sm:border-l sm:border-[color:var(--rule)] sm:pl-8" : ""} ${i > 0 ? "border-t border-[color:var(--rule)] sm:border-t-0" : ""}`}
            >
              <dt className={T.small}>{stat.label}</dt>
              <dd className="font-display text-5xl font-extrabold tabular-nums text-[color:var(--fg)]">
                <Figure value={stat.value} />
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}

/** The picture's rendered width per breakpoint: 4 or 7 of 12 columns, 3 of 8. */
const PORTRAIT_SIZES = "(min-width: 1024px) 33vw, (min-width: 768px) 37vw, 100vw";
const LANDSCAPE_SIZES = "(min-width: 1024px) 58vw, 100vw";

/**
 * One picture beside the site's feature blocks, each under a 2 px accent
 * rule. A portrait picture (OrbitYield's silo, ClaimHub's gate, LaunchPad's
 * rocket) keeps its own 2:3 frame in a narrower column, so nothing is cut.
 */
export function Features({
  image,
  blocks,
  portrait = false,
}: {
  image: ImgAsset;
  blocks: readonly Block[];
  portrait?: boolean;
}): JSX.Element {
  return (
    <section className={`${FRAME} py-16 lg:py-24`}>
      <div className={`${GRID} gap-y-10 ${portrait ? "md:items-center" : "lg:items-center"}`}>
        <Reveal
          className={
            portrait
              ? "col-span-4 md:col-span-3 lg:col-span-4"
              : "col-span-4 md:col-span-8 lg:col-span-7"
          }
        >
          <ImgWell
            asset={image}
            ratio={portrait ? "2/3" : "16/10"}
            sizes={portrait ? PORTRAIT_SIZES : LANDSCAPE_SIZES}
            className="border border-[color:var(--rule)]"
          />
        </Reveal>
        <div
          className={`col-span-4 grid gap-8 ${portrait ? "md:col-span-5 lg:col-span-6 lg:col-start-6" : "md:col-span-8 lg:col-span-5"}`}
        >
          {blocks.map((block) => (
            <Reveal
              key={block.title}
              className="grid gap-3 border-t-2 border-[color:var(--accent-mark)] pt-5"
            >
              <h2 className={`${T.h3} text-[color:var(--fg)]`}>{block.title}</h2>
              <p className={T.body}>{block.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The questions themselves: one exclusive group (`name`), so opening one closes the others. */
export function FaqList({ items, name }: { items: readonly Faq[]; name: string }): JSX.Element {
  return (
    <div className="max-w-[760px] border-t border-[color:var(--rule)]">
      {items.map((item) => (
        <details
          key={item.question}
          name={name}
          className="group border-b border-[color:var(--rule)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium text-[color:var(--fg)] [&::-webkit-details-marker]:hidden">
            {item.question}
            <span
              aria-hidden="true"
              className="font-mono text-xl text-[color:var(--accent-mark)] transition-transform duration-150 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className={`${T.body} pb-5`}>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** The site's FAQ on its home page. `title` names it for heading navigation (screen readers only). */
export function Faq({
  items,
  name,
  title,
}: {
  items: readonly Faq[];
  name: string;
  title?: string;
}): JSX.Element {
  const id = useId();
  return (
    <section className={`${FRAME} pb-16 lg:pb-24`} {...(title ? { "aria-labelledby": id } : {})}>
      {title ? (
        <h2 id={id} className="sr-only">
          {title}
        </h2>
      ) : null}
      <FaqList items={items} name={name} />
    </section>
  );
}

export function SiteFooter({ note, hostname }: { note: string; hostname: string }): JSX.Element {
  return (
    <footer className="border-t border-[color:var(--rule)]">
      <div className={`${FRAME} flex flex-wrap items-center justify-between gap-4 py-8`}>
        <p className={T.small}>{note}</p>
        <p className="font-mono text-label uppercase text-[color:var(--fg-muted)]">{hostname}</p>
      </div>
    </footer>
  );
}
