import type { SiteView } from "@baret/content";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { BarChart, Fill, PageFrame, PageHead, Totals } from "./Page.js";
import { FaqList } from "./Sections.js";

/**
 * A demo site's secondary page, drawn from its copy (`SiteView`). Every kind
 * keeps the home page's grammar: the page title, one paragraph and the
 * sample-figures note, then rows on hairlines. The site's accent marks one
 * thing per page at most: the active row, the first share, the last bar.
 */

type Of<K extends SiteView["kind"]> = Extract<SiteView, { kind: K }>;

/** A table from 768 px; below it, each row stacks as its own list of label and value. */
function TableView({ view }: { view: Of<"table"> }): JSX.Element {
  const [first, ...rest] = view.columns;
  const th = `${T.label} py-3 pr-4 text-left font-normal`;
  return (
    <Reveal>
      <table className="hidden w-full border-collapse border-t border-[color:var(--rule-strong)] md:table">
        <caption className="sr-only">{view.title}</caption>
        <thead>
          <tr className="border-b border-[color:var(--rule)]">
            {view.columns.map((column) => (
              <th key={column} scope="col" className={th}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => {
            const [head, ...cells] = row;
            return (
              <tr
                key={head}
                className="border-b border-[color:var(--rule)] transition-colors hover:bg-[color:var(--surface)]"
              >
                <th
                  scope="row"
                  className="py-4 pr-4 text-left font-display text-xl font-bold uppercase text-[color:var(--fg)]"
                >
                  {head}
                </th>
                {cells.map((cell, i) => (
                  <td
                    key={`${head}-${rest[i] ?? i}`}
                    className={`${T.num} py-4 pr-4 ${i === 0 ? "text-[color:var(--fg)]" : "text-[color:var(--fg-muted)]"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="grid border-t border-[color:var(--rule-strong)] md:hidden">
        {view.rows.map((row) => {
          const [head, ...cells] = row;
          return (
            <li key={head} className="grid gap-3 border-b border-[color:var(--rule)] py-5">
              <div className="grid gap-0.5">
                <p className={T.label}>{first}</p>
                <p className="font-display text-xl font-bold uppercase text-[color:var(--fg)]">
                  {head}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {cells.map((cell, i) => (
                  <div key={`${head}-${rest[i] ?? i}`} className="grid gap-0.5">
                    <dt className={T.label}>{rest[i]}</dt>
                    <dd className={`${T.num} text-sm text-[color:var(--fg)]`}>{cell}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </Reveal>
  );
}

function DocsView({ view }: { view: Of<"docs"> }): JSX.Element {
  return (
    <div className={`${GRID} gap-y-10`}>
      <nav aria-label={view.toc} className="col-span-4 md:col-span-8 lg:col-span-3">
        <div className="grid gap-3 lg:sticky lg:top-24">
          <p className={T.label}>{view.toc}</p>
          <ul className="grid border-l border-[color:var(--rule)]">
            {view.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px block border-l-2 border-transparent py-2 pl-4 text-sm text-[color:var(--fg-muted)] hover:border-[color:var(--accent-mark)] hover:text-[color:var(--fg)]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div className="col-span-4 grid min-w-0 gap-10 md:col-span-8 lg:col-span-8 lg:col-start-5">
        {view.sections.map((section) => (
          <Reveal
            key={section.id}
            className="grid min-w-0 scroll-mt-24 gap-3 border-t-2 border-[color:var(--accent-mark)] pt-5"
          >
            <h2 id={section.id} className={`${T.h3} text-[color:var(--fg)]`}>
              {section.title}
            </h2>
            <p className={`${T.body} max-w-[64ch]`}>{section.body}</p>
            {section.code ? (
              <>
                {/* biome-ignore lint/a11y/useSemanticElements: the code box is a named region and keeps pre whitespace. */}
                <pre
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: the code scrolls sideways, so the keyboard must reach it.
                  tabIndex={0}
                  role="region"
                  aria-label={section.title}
                  className="overflow-x-auto outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-mark)] border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[color:var(--fg)] md:text-sm"
                >
                  <code>{section.code}</code>
                </pre>
              </>
            ) : null}
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function ListView({ view }: { view: Of<"list"> }): JSX.Element {
  return (
    <ol className="border-t border-[color:var(--rule-strong)]">
      {view.items.map((item) => (
        <Reveal
          as="li"
          key={item.title}
          className={`${GRID} gap-y-2 border-b border-[color:var(--rule)] py-6`}
        >
          <p className={`${T.label} col-span-4 md:col-span-2 lg:col-span-3`}>{item.label}</p>
          <div className="col-span-4 grid gap-2 md:col-span-6 lg:col-span-8">
            <h2 className={`${T.h3} text-[color:var(--fg)]`}>{item.title}</h2>
            <p className={`${T.body} max-w-[64ch]`}>{item.body}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

/** Each share's fill, in order: the accent first, then quieter inks. */
const SHARE_FILL = [
  "bg-[color:var(--accent-mark)]",
  "bg-[color:var(--fg)]",
  "bg-[color:var(--fg-muted)]",
  "bg-[color:var(--fg-faint)]",
] as const;

function SharesView({ view }: { view: Of<"shares"> }): JSX.Element {
  return (
    <Reveal className="grid gap-8">
      <Fill axis="x" aria-hidden className="flex h-12 gap-0.5 md:h-16">
        {view.items.map((item, i) => (
          <span
            key={item.label}
            className={SHARE_FILL[i % SHARE_FILL.length]}
            style={{ width: `${item.value}%` }}
          />
        ))}
      </Fill>
      <dl className="grid border-t border-[color:var(--rule-strong)] md:grid-cols-2">
        {view.items.map((item, i) => (
          // A group holds only its dt and dd (valid HTML for a dl): the swatch
          // sits inside the dt, and the dd is indented to the label.
          <div
            key={item.label}
            className={`grid gap-y-1 border-b border-[color:var(--rule)] py-5 ${i % 2 === 1 ? "md:border-l md:pl-6" : "md:pr-6"}`}
          >
            <dt className="flex items-baseline gap-4">
              <span
                aria-hidden="true"
                className={`size-3 shrink-0 self-start mt-2 ${SHARE_FILL[i % SHARE_FILL.length]}`}
              />
              <span className="flex flex-1 items-baseline justify-between gap-4">
                <span className={`${T.h3} text-[color:var(--fg)]`}>{item.label}</span>
                <span
                  className={`${T.num} font-display text-2xl font-extrabold text-[color:var(--fg)]`}
                >
                  {item.value}%
                </span>
              </span>
            </dt>
            <dd className={`${T.body} pl-7`}>{item.body}</dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}

function Body({ view, faqName }: { view: SiteView; faqName: string }): JSX.Element {
  switch (view.kind) {
    case "table":
      return <TableView view={view} />;
    case "chart":
      return (
        <>
          <BarChart
            title={view.chart.title}
            caption={view.chart.caption}
            unit={view.chart.unit}
            labels={view.chart.days}
            values={view.chart.values}
          />
          <Totals title={view.top.title} items={view.top.items} />
        </>
      );
    case "docs":
      return <DocsView view={view} />;
    case "list":
      return <ListView view={view} />;
    case "faq":
      return <FaqList items={view.items} name={faqName} />;
    case "shares":
      return <SharesView view={view} />;
  }
}

export function SiteViewPage({
  view,
  note,
  faqName,
}: {
  view: SiteView;
  /** The site's sample-figures note, under every page title. */
  note: string;
  /** The `name` of a FAQ page's exclusive group. */
  faqName: string;
}): JSX.Element {
  return (
    <PageFrame>
      <PageHead title={view.title} body={view.body} note={note} />
      <Body view={view} faqName={faqName} />
    </PageFrame>
  );
}
