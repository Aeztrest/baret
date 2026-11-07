import { hub } from "@baret/content";
import { fill } from "@baret/web-ui/lib/util";
import { SCENARIOS, type Scenario } from "../sites/scenarios.js";

/**
 * The hub's pure pieces: the threat filter and the step strip's crop. Kept
 * out of the components so the tests read the same numbers the page uses.
 */

export type FilterId = (typeof hub.filters.items)[number]["id"];

/** The URL query key that holds the filter (`/showcase?filter=drainer`). */
export const FILTER_PARAM = "filter";

/** A query value read back as a filter id; anything unknown is "all". */
export function parseFilter(value: string | null): FilterId {
  return hub.filters.items.find((f) => f.id === value)?.id ?? "all";
}

/** The six sites, or the ones whose `threatClass` matches. */
export function filterScenarios(
  id: FilterId,
  list: readonly Scenario[] = SCENARIOS,
): readonly Scenario[] {
  return id === "all" ? list : list.filter((s) => s.threatClass === id);
}

/** What the status region says after the filter changes. */
export function filterStatus(count: number): string {
  return fill(hub.filters.status, { count: String(count) });
}

/**
 * The step strip (h-05, 1536 x 864) holds four drawings in four frames:
 * a cable end, a finger on a button, a tag on a wire, an empty frame. Each
 * frame is 357 x 457 px; these are their left edges, measured on the file.
 */
export const STRIP = { width: 1536, height: 864, panel: { width: 357, height: 457, top: 184 } };
export const PANEL_LEFT = [26, 401, 776, 1151] as const;

/**
 * The drawing each step shows. The steps run connect, pick a version, press,
 * read; the drawings run cable, press, tag, frame. "Pick a version" gets the
 * empty frame: the page stays the same, only the transaction changes.
 */
export const STEP_PANEL = [0, 3, 1, 2] as const;

/** The strip's transform for one step, as a share of the strip's own width. */
export function stripShift(step: number): string {
  const panel = STEP_PANEL[step] ?? 0;
  const left = PANEL_LEFT[panel] ?? 0;
  return `${((-left / STRIP.width) * 100).toFixed(3)}%`;
}

/** The strip's size and top offset inside a frame cut to one panel. */
export const STRIP_FRAME = {
  /** Width of the whole strip, as a share of one panel's width. */
  width: `${((STRIP.width / STRIP.panel.width) * 100).toFixed(3)}%`,
  /** How far the strip sits above the frame, as a share of the panel's height. */
  top: `${((-STRIP.panel.top / STRIP.panel.height) * 100).toFixed(3)}%`,
  /** The frame's own ratio: one panel. */
  ratio: `${STRIP.panel.width} / ${STRIP.panel.height}`,
} as const;
