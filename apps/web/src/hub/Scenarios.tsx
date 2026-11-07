import { hub } from "@baret/content";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { Section, titleIdOf } from "@baret/web-ui/components/Section";
import { SectionHeader } from "@baret/web-ui/components/SectionHeader";
import { Segment } from "@baret/web-ui/components/Segment";
import { staggerDelay } from "@baret/web-ui/lib/motion";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { FILTER_PARAM, filterScenarios, filterStatus, parseFilter } from "./hub.js";
import { ScenarioCard } from "./ScenarioCard.js";

/**
 * The six sites and their filter. A native radio group (one tab stop, arrow
 * keys) narrows the cards to one threat class; beside it, that class's
 * one sentence. The pictures live on the cards only. Cards that do not match leave the DOM, and
 * one status region says how many are shown. No timers, nothing moves on
 * its own; a card that appears rises once like every surface.
 *
 * The filter lives in the URL (`?filter=drainer`), one history entry per
 * pick, so a link opens on it and Back/Forward bring it back with the list
 * that ScrollRestoration's saved position was measured on. "All" drops the
 * query. A pick never scrolls the page.
 */

const ID = "scenarios";
const { filters } = hub;

export function Scenarios(): JSX.Element {
  const name = useId();
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get(FILTER_PARAM));
  const [said, setSaid] = useState("");
  const shown = filterScenarios(filter);
  const current = filters.items.find((f) => f.id === filter) ?? filters.items[0];

  // The status follows the URL, so a pick and Back/Forward both announce the
  // count. The first render (a fresh load or a deep link) stays quiet; the
  // last filter is compared rather than a flag, so StrictMode's second
  // effect run does not announce either.
  const last = useRef(filter);
  useEffect(() => {
    if (last.current === filter) return;
    last.current = filter;
    setSaid(filterStatus(filterScenarios(filter).length));
  }, [filter]);

  const pick = (value: string): void => {
    const next = parseFilter(value);
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "all") out.delete(FILTER_PARAM);
        else out.set(FILTER_PARAM, next);
        return out;
      },
      { preventScrollReset: true },
    );
  };

  return (
    <Section id={ID} ground="deep">
      <SectionHeader titleId={titleIdOf(ID)} title={hub.scenarios.title} layout="stack" />

      <div className="mt-10 flex flex-col gap-4 border-y border-[color:var(--rule)] py-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <fieldset className="min-w-0">
          <legend className="sr-only">{filters.label}</legend>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {filters.items.map((item) => (
              <Segment
                key={item.id}
                name={name}
                value={item.id}
                checked={item.id === filter}
                label={item.label}
                onSelect={pick}
              />
            ))}
          </div>
        </fieldset>
        <p className={`${T.body} text-[color:var(--fg-muted)] md:max-w-[36ch] md:text-right`}>
          {current?.body}
        </p>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {shown.map((scenario, i) => (
          <Reveal as="li" key={scenario.slug} delay={staggerDelay(i % 3)}>
            <ScenarioCard scenario={scenario} />
          </Reveal>
        ))}
      </ul>

      <p role="status" className="sr-only">
        {said}
      </p>
    </Section>
  );
}
