import { home } from "@baret/content";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";
import { SectionFrame } from "../../shared/SectionFrame.js";
import { SectionHeader } from "../../shared/SectionHeader.js";
import { LayerTabs } from "./pillars/LayerTabs.js";
import { STAT_ROW_DELAY, StatTile } from "./pillars/StatTile.js";

/**
 * How it works: the three layers as one interactive stage (LayerTabs), then
 * the four counted numbers in one row. Every word comes from home.pillars
 * and home.stats. The stage rises once; the stats count up once in view.
 */
export function PillarsSection(): JSX.Element {
  const { title, body } = home.pillars;
  const stats = home.stats;
  return (
    <SectionFrame sectionKey="pillars" ground="deep">
      <SectionHeader sectionKey="pillars" layout="split" keepBeats title={title} body={body} />
      <Reveal>
        <LayerTabs />
      </Reveal>
      <Reveal className="mt-12" delay={STAT_ROW_DELAY}>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {stats.items.map((stat, i) => (
            <li key={stat.label}>
              <StatTile value={stat.value} label={stat.label} index={i} stencil={i === 1} />
            </li>
          ))}
        </ul>
        <p className={`${T.small} mt-4 max-w-[72ch]`}>{stats.note}</p>
      </Reveal>
    </SectionFrame>
  );
}
