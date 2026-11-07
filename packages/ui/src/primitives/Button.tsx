import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../cn.js";

/**
 * The button.
 *
 * Written rather than generated. shadcn's button carries six variants, eight
 * sizes, a translate on press and rounded corners, and almost none of it
 * survives contact with this brand: our buttons are square with one chamfered
 * corner, set in Big Shoulders, uppercase and tracked. There was more to delete
 * than to keep.
 *
 * Four variants, and the ratio rule decides when to use which. A screen gets
 * one primary. If it has two, one of them is wrong.
 */

const VARIANT = {
  /** The one action the screen exists for. */
  /* The transparent border is invisible until forced colours paint it, so
     the primary keeps its box in high contrast and matches ghost's height. */
  primary:
    "text-[color:var(--on-accent)] before:border-transparent before:bg-[color:var(--accent)] hover:before:bg-[color:var(--accent-deep)]",
  /** Everything else. A rule, not a fill. */
  ghost:
    "text-[color:var(--fg)] before:border-[color:var(--fg)] hover:before:bg-[color:var(--ground-deep)]",
  /** Quieter than ghost, for a third action in a row. */
  soft: "text-[color:var(--fg)] before:border-transparent before:bg-[color:var(--ground-deep)] hover:before:bg-[color:var(--rule)]",
  /**
   * Revoke, reset, sign anyway. Red is reserved for an action that cannot be
   * undone, so that red always means the same thing. The text takes the ink
   * shade, which holds 4.5:1 on the light grounds; the rule and fill keep red.
   */
  danger:
    "text-[color:var(--blocked-ink)] before:border-[color:var(--blocked)] hover:text-[color:var(--surface)] hover:before:bg-[color:var(--blocked)]",
} as const;

const SIZE = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-lg",
  /* Square, for a button that is only an icon: close, copy, dismiss. The
     label still has to exist for a screen reader, as an aria-label. */
  icon: "size-11",
  "icon-sm": "size-9",
} as const;

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  /** Render as the child element, for a link that looks like a button. */
  asChild?: boolean;
  /** Fills the row. Used in the popup, where a row is 328px wide. */
  block?: boolean;
}

export function Button({
  variant = "ghost",
  size = "md",
  asChild = false,
  block = false,
  className,
  type,
  ...rest
}: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";

  return (
    <Component
      // A button inside a form defaults to submit, which has surprised people
      // on every project that did not set this.
      type={asChild ? undefined : (type ?? "button")}
      data-slot="button"
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center gap-2 font-display font-extrabold uppercase tracking-[0.08em]",
        // A clip-path also clips the element's own outline, so the button
        // stays unclipped and carries the focus ring, and the chamfered face
        // (fill and border) is painted by a pseudo-element behind the label.
        "before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:border before:content-[''] before:[clip-path:polygon(0_0,calc(100%_-_var(--chamfer-sm))_0,100%_var(--chamfer-sm),100%_100%,0_100%)]",
        // Listed properties only: outline-color stays out so the focus ring
        // appears instantly. The face gives under a press (0.97), 100ms in,
        // 150ms out, and holds still for a viewer who asked for less motion.
        "transition-[color,transform] duration-150 ease-out before:transition-[background-color,border-color] before:duration-150 before:ease-out active:scale-[0.97] active:duration-100 motion-reduce:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--accent)]",
        "disabled:pointer-events-none disabled:opacity-40",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    />
  );
}
