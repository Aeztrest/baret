/**
 * Section anchors for the landing page, in scroll order.
 *
 * The single source for every `id`, `aria-labelledby` and in-page `#hash` on
 * `/`. Change an anchor here and every link and label follows.
 */
export const IDS = {
  opener: "intro",
  hero: "hero",
  marquee: "checks",
  pillars: "how-it-works",
  caution: "verdicts",
  agents: "agents",
  showcase: "showcase",
  cta: "start",
} as const;

export type SectionKey = keyof typeof IDS;

/** The id of a section's heading, which the section is labelled by. */
export function titleId(key: SectionKey): string {
  return `${IDS[key]}-title`;
}
