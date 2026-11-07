import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "../lib/util.js";

/**
 * A link that looks like a BRAND button.
 *
 * The chamfer is a clip-path, and a clip-path also clips the focus outline.
 * So the focusable element is the unclipped outer link, which carries the
 * orange ring, and the chamfered face is an inner span [SB 0.12, 1.6].
 *
 * A clip-path also cuts a CSS border without drawing the cut. The outlined
 * variants therefore draw the diagonal themselves: an 8 px corner SVG whose
 * 2 px stroke is centred on the clip edge, so exactly 1 px survives the clip
 * and meets the top and right borders. It needs no knowledge of the ground.
 */

type Variant = "primary" | "ghost" | "ghostInverse";
type Icon = "none" | "arrow-right" | "arrow-down" | "arrow-up-right";

const FACE: Record<Variant, string> = {
  // The transparent border keeps the box in forced colours (IMPROVE F2) and
  // gives both variants the same height.
  primary:
    "border border-transparent bg-[color:var(--accent)] text-[color:var(--on-accent)] group-hover:bg-[color:var(--accent-deep)]",
  ghost:
    "border border-[color:var(--fg)] text-[color:var(--fg)] group-hover:bg-[color:var(--ground-deep)]",
  ghostInverse: "border border-chalk text-chalk group-hover:bg-chalk group-hover:text-ink",
};

/** The stroke colour of the corner diagonal; it matches each border. */
const EDGE: Record<Variant, string | null> = {
  primary: null,
  ghost: "stroke-[color:var(--fg)]",
  ghostInverse: "stroke-chalk",
};

function ChamferEdge({ stroke }: { stroke: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 8"
      className="pointer-events-none absolute -top-px -right-px size-[var(--chamfer-sm)] overflow-visible"
    >
      <line
        x1="0"
        y1="0"
        x2="8"
        y2="8"
        className={stroke}
        strokeWidth="2"
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type Size = "sm" | "md" | "lg";

/** The face. `sm` is the 36 px header action (IMPROVE D2). */
const SIZE: Record<Size, string> = { sm: "h-9 px-3", md: "h-11 px-4", lg: "h-12 px-6" };

/** The hit area. A small face still sits inside a 44 px target. */
const HIT: Record<Size, string> = { sm: "min-h-11 items-center", md: "", lg: "" };

const OUTER =
  "group inline-flex focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

const INNER =
  "chamfer-sm relative inline-flex items-center justify-center gap-2 font-display text-base font-extrabold uppercase tracking-[0.08em] transition-[background-color,color,scale] duration-150 ease-out group-active:scale-[0.97] group-active:duration-100 motion-reduce:group-active:scale-100";

function IconGlyph({ icon }: { icon: Icon }): JSX.Element | null {
  const props = { className: "size-4", strokeWidth: 1.5, "aria-hidden": true } as const;
  if (icon === "arrow-right") return <ArrowRight {...props} />;
  if (icon === "arrow-down") return <ArrowDown {...props} />;
  if (icon === "arrow-up-right") return <ArrowUpRight {...props} />;
  return null;
}

export function LinkButton({
  href,
  label,
  variant = "ghost",
  size = "md",
  icon = "none",
  fullOnPhone,
  newTab,
}: {
  href: string;
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: Icon;
  fullOnPhone?: boolean;
  /** Opens in a new tab, so the page that links (and its in-memory state) stays open. */
  newTab?: boolean;
}): JSX.Element {
  const tab = newTab ? ({ target: "_blank", rel: "noopener noreferrer" } as const) : {};
  const outer = cx(OUTER, HIT[size], fullOnPhone && "max-md:w-full");
  const face: ReactNode = (
    <span className={cx(INNER, SIZE[size], FACE[variant], fullOnPhone && "max-md:w-full")}>
      {label}
      <IconGlyph icon={icon} />
      {EDGE[variant] ? <ChamferEdge stroke={EDGE[variant]} /> : null}
    </span>
  );

  if (href.startsWith("http")) {
    return (
      <a href={href} rel="noreferrer" className={outer} {...tab}>
        {face}
      </a>
    );
  }
  if (href.startsWith("#")) {
    return (
      <a href={href} className={outer} {...tab}>
        {face}
      </a>
    );
  }
  return (
    <Link to={href} viewTransition className={outer} {...tab}>
      {face}
    </Link>
  );
}
