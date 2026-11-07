import type { TagTone } from "@baret/ui/primitives/Tag";

/**
 * Verdict and state colour lookups. Every class is a complete literal so
 * Tailwind generates it; `bg-${tone}` would never be emitted.
 */

/** The verdicts a web app card can carry. "capped" is not a TagTone. */
export type CardVerdict = "safe" | "caution" | "blocked" | "capped";

/** Card verdict to tag tone. Same mapping as HubPage, so the two pages agree. */
export const VERDICT_TONE: Record<CardVerdict, TagTone> = {
  safe: "safe",
  caution: "caution",
  blocked: "blocked",
  capped: "blocked",
};
