import { novaswap } from "@baret/content";
import { NOVASWAP } from "@baret/demo-evm";
import { Button } from "@baret/ui";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { BarChart, PageFrame, PageHead as SitePageHead, Totals } from "../kit/site/Page.js";

/**
 * NovaSwap's Pools, Stats and Docs pages. Same grammar as the swap page: a
 * title, one short paragraph, then rows on hairlines. Every figure is sample
 * data from novaswap.content.ts and the page says so under its title.
 */

const pages = novaswap.site.pages;

function PageHead({ title, body }: { title: string; body: string }): JSX.Element {
  return <SitePageHead title={title} body={body} note={pages.sampleNote} />;
}

export function PoolsPage({ onSwap }: { onSwap: () => void }): JSX.Element {
  const { pools } = pages;
  const th = `${T.label} py-3 pr-4 text-left font-normal`;
  const wide = "hidden md:table-cell";
  return (
    <PageFrame>
      <PageHead title={pools.title} body={pools.body} />
      <Reveal>
        <table className="w-full border-collapse border-t border-[color:var(--rule-strong)]">
          <caption className="sr-only">{pools.title}</caption>
          <thead>
            <tr className="border-b border-[color:var(--rule)]">
              <th scope="col" className={th}>
                {pools.columns.pair}
              </th>
              <th scope="col" className={th}>
                {pools.columns.tvl}
              </th>
              <th scope="col" className={`${th} ${wide}`}>
                {pools.columns.volume}
              </th>
              <th scope="col" className={`${th} ${wide}`}>
                {pools.columns.fee}
              </th>
              <td />
            </tr>
          </thead>
          <tbody>
            {pools.items.map((pool) => (
              <tr
                key={pool.pair}
                className="border-b border-[color:var(--rule)] transition-colors hover:bg-[color:var(--surface)]"
              >
                {/* Symbols keep their own case (dUSDC, shMON), so no uppercase here. */}
                <th
                  scope="row"
                  className="py-4 pr-4 text-left font-display text-xl font-bold text-[color:var(--fg)] md:text-2xl"
                >
                  {pool.pair}
                </th>
                <td className={`${T.num} py-4 pr-4 text-[color:var(--fg)]`}>{pool.tvl}</td>
                <td className={`${T.num} ${wide} py-4 pr-4 text-[color:var(--fg-muted)]`}>
                  {pool.volume}
                </td>
                <td className={`${wide} py-4 pr-4`}>
                  <span className="border border-[color:var(--accent-edge)] px-2 py-1 font-mono text-label text-[color:var(--accent)]">
                    {pool.fee}
                  </span>
                </td>
                <td className="py-4 text-right">
                  <Button type="button" variant="ghost" size="sm" onClick={onSwap}>
                    {pools.action}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </PageFrame>
  );
}

export function StatsPage(): JSX.Element {
  const { stats } = pages;
  const { chart } = stats;
  return (
    <PageFrame>
      <PageHead title={stats.title} body={stats.body} />
      <BarChart
        title={chart.title}
        caption={chart.caption}
        unit={chart.unit}
        labels={chart.days}
        values={chart.values}
      />
      <Totals title={stats.top.title} items={stats.top.items} />
    </PageFrame>
  );
}

export function DocsPage(): JSX.Element {
  const { docs } = pages;
  return (
    <PageFrame>
      <PageHead title={docs.title} body={docs.body} />
      <div className={`${GRID} gap-y-10`}>
        <nav aria-label={docs.toc} className="col-span-4 md:col-span-8 lg:col-span-3">
          <div className="grid gap-3 lg:sticky lg:top-24">
            <p className={T.label}>{docs.toc}</p>
            <ul className="grid border-l border-[color:var(--rule)]">
              {docs.sections.map((section) => (
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

        <div className="col-span-4 grid gap-10 md:col-span-8 lg:col-span-8 lg:col-start-5">
          <div className="grid gap-3 border border-[color:var(--rule-strong)] bg-[color:var(--surface)] p-6">
            <p className={T.label}>{docs.contract.label}</p>
            <code className="block break-all font-mono text-base text-[color:var(--fg)]">
              {NOVASWAP.router}
            </code>
            <p className={T.small}>{docs.contract.note}</p>
          </div>
          {docs.sections.map((section) => (
            <Reveal
              key={section.id}
              className="grid scroll-mt-24 gap-3 border-t-2 border-[color:var(--accent-mark)] pt-5"
            >
              <h2 id={section.id} className={`${T.h3} text-[color:var(--fg)]`}>
                {section.title}
              </h2>
              <p className={`${T.body} max-w-[64ch]`}>{section.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
