import type { CSSProperties } from "react";
import type { Responsive } from "./img.js";

/**
 * Private helpers for the shared landing components. Not part of the frozen
 * API in BLUEPRINT section 4; sections do not need them.
 */

/**
 * Join class strings with single spaces, skipping empty parts. A plain join,
 * never tailwind-merge, so `T.*` sizes, `text-label` and `text-display-*`
 * survive next to a colour.
 */
export function cx(...parts: ReadonlyArray<string | false | null | undefined>): string {
  let out = "";
  for (const part of parts) {
    if (part) out = out === "" ? part : `${out} ${part}`;
  }
  return out;
}

/**
 * Fill `{name}` placeholders (the findings.content.ts templates) from sample
 * values. An unknown name stays as written, so a gap is visible, never blank.
 */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

/**
 * Pick the singular twin of a counted line when `count` is 1, then fill the
 * chosen form with `{count}` and the other values. Both forms are filled, so
 * a placeholder in the `...One` string never leaks.
 */
export function counted(
  count: number,
  many: string,
  one: string,
  values: Readonly<Record<string, string>> = {},
): string {
  return fill(count === 1 ? one : many, { ...values, count: String(count) });
}

/** A responsive value resolved mobile-first: md falls back to base, lg to md. */
export interface Cascade<V> {
  readonly base: V;
  readonly md: V;
  readonly lg: V;
}

export function cascade<V extends string>(value: Responsive<V>): Cascade<V> {
  if (typeof value === "string") return { base: value, md: value, lg: value };
  const md = value.md ?? value.base;
  return { base: value.base, md, lg: value.lg ?? md };
}

/** object-position read from three custom properties, one per breakpoint. */
export const POSITION_CLASSES =
  "[object-position:var(--op-base)] md:[object-position:var(--op-md)] lg:[object-position:var(--op-lg)]";

/** The custom properties POSITION_CLASSES reads. Default is the centre. */
export function positionStyle(position: Responsive<string> | undefined): CSSProperties {
  const p = cascade(position ?? "50% 50%");
  return { "--op-base": p.base, "--op-md": p.md, "--op-lg": p.lg } as CSSProperties;
}
