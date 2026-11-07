import { hub } from "@baret/content";
import { ImgWell } from "@baret/web-ui/components/Img";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { Section, titleIdOf } from "@baret/web-ui/components/Section";
import { SectionHeader } from "@baret/web-ui/components/SectionHeader";
import { GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { HUB_ART } from "../shared/assets.js";

/**
 * Same request, with and without a check: a real table with one row per
 * aspect, the plain wallet's answer muted and Baret's in --fg, then the way
 * to NovaSwap, where both paths run (M2). Two blank tags on black stand beside
 * it from 1024 px, a tall frame that holds the table's height (two paths, one request). On phones the table keeps its
 * three columns at a smaller size, so nothing scrolls sideways at 320 px.
 */

const ID = "difference";
const { comparison } = hub;

const CELL = "py-4 pr-3 align-top text-sm leading-normal md:pr-6 md:text-base";

export function Difference(): JSX.Element {
  return (
    <Section id={ID} ground="deep">
      <SectionHeader
        titleId={titleIdOf(ID)}
        title={comparison.title}
        body={comparison.body}
        layout="split"
      />
      <div className={`${GRID} mt-12 gap-y-8 lg:items-start`}>
        <Reveal className="col-span-4 hidden lg:sticky lg:top-24 lg:block lg:col-span-4">
          <ImgWell
            asset={HUB_ART.difference}
            ratio="4/5"
            sizes="(min-width: 1024px) 380px, 100vw"
            className="border border-[color:var(--rule)]"
          />
        </Reveal>
        <Reveal className="col-span-4 md:col-span-8 lg:col-span-8">
          <table className="w-full table-fixed border-collapse border-t border-[color:var(--rule-strong)]">
            <caption className="sr-only">{comparison.title}</caption>
            <colgroup>
              <col className="w-[28%] md:w-[24%]" />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-[color:var(--rule)]">
                <td />
                <th scope="col" className={`${T.label} py-3 pr-3 text-left font-normal md:pr-6`}>
                  {comparison.columns.without}
                </th>
                <th scope="col" className={`${T.label} py-3 pr-3 text-left font-normal md:pr-6`}>
                  {comparison.columns.with}
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.aspect} className="border-b border-[color:var(--rule)]">
                  <th
                    scope="row"
                    className={`${CELL} text-left font-display font-bold uppercase tracking-[0.02em] text-[color:var(--fg)]`}
                  >
                    {row.aspect}
                  </th>
                  <td className={`${CELL} text-[color:var(--fg-muted)]`}>{row.without}</td>
                  <td className={`${CELL} font-medium text-[color:var(--fg)]`}>{row.with}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-8">
            <LinkButton
              href={comparison.action.href}
              label={comparison.action.label}
              size="lg"
              icon="arrow-right"
              fullOnPhone
              newTab
            />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
