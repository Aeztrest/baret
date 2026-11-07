/**
 * The marketing type scale (BLUEPRINT section 3.2).
 *
 * Hierarchy comes from size steps, not from weight tricks. This is the only
 * file under `landing/` that may contain the stencil face: the page spends it
 * exactly three times (the hero title, the "25" stat, the closing title).
 *
 * Never pass a `T.*` string through `cn()`. tailwind-merge treats the custom
 * sizes as colours and deletes them. Concatenate with template literals, and
 * inside a shadcn component put display text in a child `<span>`.
 */
export const T = {
  /**
   * Hero title only. Stencil, 42 to 96 px, sized by its column: the hero
   * copy column is an `@container`, so the size grows with the column, not
   * with breakpoints. BRAND stencil tracking +4 %.
   */
  h1: "font-stencil uppercase text-[clamp(2.625rem,0.5rem+11cqi,6rem)] leading-[0.9] tracking-[0.04em]",
  /**
   * An inner page's title (hub, docs, install, agents, the wallet's screens).
   * The same stencil, one step down: 40 to 72 px, also sized by an
   * `@container` column, so a long page title stays a headline, not a wall.
   */
  h1Page:
    "font-stencil uppercase text-[clamp(2.5rem,0.75rem+8cqi,4.5rem)] leading-[0.9] tracking-[0.04em]",
  /** Section titles. Fluid 32 to 44 px, no breakpoint jump. */
  h2: "font-display font-extrabold uppercase text-[clamp(2rem,1.4rem+2.2vw,2.75rem)] leading-[0.95] tracking-normal md:tracking-[-0.01em]",
  /** The closing title only. Stencil, fluid 44 to 64 px. */
  h2Stencil:
    "font-stencil uppercase text-[clamp(2.75rem,1.9rem+3.4vw,4rem)] leading-[0.9] tracking-[0.04em]",
  /** Opener lines. Display, never stencil. 24 / 32 / 40 px. */
  line: "font-display font-extrabold uppercase text-2xl leading-[1.05] tracking-normal md:text-[2rem] md:leading-none md:tracking-[-0.01em] lg:text-[2.5rem]",
  /** Card and row titles. 20 / 24 / 24 px. */
  h3: "font-display font-bold uppercase text-xl leading-[1.05] tracking-[0.02em] md:text-2xl",
  /** The pillar verbs. 32 px at every width. */
  h3Large:
    "font-display font-extrabold uppercase text-[2rem] leading-[0.95] tracking-normal md:tracking-[-0.01em]",
  /** Kicker and footnote statements. 24 / 32 / 32 px. */
  statement:
    "font-display font-extrabold uppercase text-2xl leading-none tracking-normal md:text-[2rem] md:tracking-[-0.01em]",
  /** Section intros. 16 / 18 px, medium. text-pretty avoids one-word last lines. */
  lead: "text-pretty text-base leading-normal font-medium text-[color:var(--fg-muted)] md:text-lg",
  /** Running text. 16 px. */
  body: "text-pretty text-base leading-normal text-[color:var(--fg-muted)]",
  /** Notes and notices. 14 px. */
  small: "text-pretty text-sm leading-normal text-[color:var(--fg-muted)]",
  /** Mono labels. 11 px, muted: --fg-faint fails WCAG AA for text on the light grounds. */
  label: "font-mono text-label uppercase text-[color:var(--fg-muted)]",
  /** Stat values. 48 / 64 px, tabular, slashed zero. */
  stat: "font-display font-black text-5xl leading-[0.9] tabular-nums slashed-zero md:text-[4rem]",
  /** The one stencil stat. 48 / 64 px. */
  statStencil: "font-stencil text-5xl leading-[0.9] tabular-nums slashed-zero md:text-[4rem]",
  /**
   * Any number in running text or a label (caps, sample amounts, the chain
   * id, "17"): tabular figures and a slashed zero. Pair it with `data-numeric`.
   */
  num: "tabular-nums slashed-zero",
} as const;
