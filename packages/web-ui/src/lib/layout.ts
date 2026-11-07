/**
 * The landing frame: a 1276 px box with 16 / 32 / 48 px gutters, which leaves
 * the 1180 px content width BRAND section 06 asks for. Only BRAND rhythm steps
 * (4, 8, 12, 16, 24, 32, 48, 64, 96 px) appear in these strings.
 *
 * Join these with template literals, never with `cn()`: tailwind-merge does
 * not know the custom sizes and deletes them.
 */

/** The content container. Every section's children sit inside it. */
export const FRAME = "mx-auto w-full max-w-[1276px] px-4 md:px-8 lg:px-12";

/** 4 / 8 / 12 columns with 16 / 24 / 32 px gaps. One column is 69 px at 1180. */
export const GRID = "grid grid-cols-4 gap-x-4 md:grid-cols-8 md:gap-x-6 lg:grid-cols-12 lg:gap-x-8";

/** 48 / 64 / 96 px of vertical padding per section. */
export const SECTION_PAD = "py-12 md:py-16 lg:py-24";

/** 48 / 56 / 56 px: for a short block that should not read as a full chapter. */
export const SECTION_PAD_COMPACT = "py-12 md:py-14";

/**
 * concrete-2 as a fill. In dark theme the token pair (--ground #17181b,
 * --ground-deep #121316) sits only about 2 L* apart, so the band rhythm and
 * any deep card vanish; the landing raises dark deep fills to #24252a, about
 * 6 L* above --ground, without touching the shared tokens in packages/ui.
 */
export const DEEP_FILL = "bg-[color:var(--ground-deep)] dark:bg-[#24252a]";

/**
 * The section grounds. `ground` and `deep` are concrete and concrete-2; both
 * switch with the theme, and in dark theme each draws a strong rule on its
 * top seam so neighbouring bands never melt into one. `band` is graphite in
 * both themes, with no seam; pair it with `band="dark"` on SectionFrame.
 * In dark theme graphite sits at nearly the same lightness as --ground and
 * the footer, so the band lifts to the DEEP_FILL step (#24252a) and stays the
 * page's last big beat.
 */
const SEAM = "dark:border-t dark:border-[color:var(--rule-strong)]";

export const GROUND = {
  ground: `bg-[color:var(--ground)] ${SEAM}`,
  deep: `${DEEP_FILL} ${SEAM}`,
  band: "bg-graphite text-chalk dark:bg-[#24252a]",
} as const;

export type Ground = keyof typeof GROUND;

/**
 * A stage held under the site header: sticky at the header's bottom edge and
 * one viewport tall less the header. 56 px is the header's `h-14` in
 * layouts/RootLayout.tsx; change both together. The only owner of this value
 * in the landing, so sections never repeat it as a magic number.
 */
export const HEADER_OFFSET = "top-[56px] h-[calc(100svh-56px)]";
