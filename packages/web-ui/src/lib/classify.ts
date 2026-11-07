/**
 * What the pointer is over, for the eyelet cursor. Read once per element the
 * pointer enters (pointerover), never per move.
 *
 * - `field`: a form field. The native caret shows and the eyelet hides.
 * - `link`: anything you can press: links, buttons, labels, summaries, or any
 *   element marked `data-cursor` (other than `text`). The ring opens.
 * - `text`: long-form body copy only: a paragraph that runs past about two
 *   lines, or anything marked `data-cursor="text"`. The dot becomes a caret,
 *   for selecting. Headings, labels, list items and short lines keep the dot
 *   and ring, so crossing a tile does not flip caret, ring, caret.
 * - `base`: everything else.
 */
export type CursorState = "base" | "link" | "text" | "field";

const FIELD =
  'input:not([type="button"],[type="submit"],[type="reset"],[type="checkbox"],[type="radio"],[type="range"]), textarea, select, [contenteditable="true"]';
const PRESSABLE =
  'a[href], button:not(:disabled), [role="button"], [role="tab"], [role="switch"], label[for], summary, [data-cursor]:not([data-cursor="text"])';
const OPT_IN_TEXT = '[data-cursor="text"]';

/** Lines past which a paragraph counts as long-form reading copy. */
const LONG_FORM_LINES = 2.5;

/** True for a paragraph taller than about two and a half of its own lines. */
function isLongForm(p: Element): boolean {
  if (!(p instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(p);
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  const line = Number.parseFloat(style.lineHeight) || fontSize * 1.2;
  return p.offsetHeight > line * LONG_FORM_LINES;
}

export function classify(target: EventTarget | null): CursorState {
  if (!(target instanceof Element)) return "base";
  if (target.closest(FIELD)) return "field";
  if (target.closest(PRESSABLE)) return "link";
  if (target.closest(OPT_IN_TEXT)) return "text";
  const p = target.closest("p");
  if (p && isLongForm(p)) return "text";
  return "base";
}

/** `rgb(255, 79, 0)` and its dark-theme sibling: the International Orange family. */
function isOrange(color: string): boolean {
  const m = color.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return false;
  const [r, g, b] = m.map(Number) as [number, number, number];
  const alpha = m[3] === undefined ? 1 : Number(m[3]);
  return alpha > 0.5 && r > 220 && g > 50 && g < 130 && b < 60;
}

/** `#rrggbb` to `[r, g, b]`, or null for anything else. */
function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [
    Number.parseInt(m[1] ?? "", 16),
    Number.parseInt(m[2] ?? "", 16),
    Number.parseInt(m[3] ?? "", 16),
  ];
}

/**
 * True when a computed background is the accent of the element's own scope:
 * Baret's orange on the landing, or a demo dApp's accent (sites/theme).
 */
function isAccentFill(style: CSSStyleDeclaration): boolean {
  if (isOrange(style.backgroundColor)) return true;
  const accent = hexRgb(style.getPropertyValue("--accent"));
  const m = style.backgroundColor.match(/\d+(\.\d+)?/g);
  if (!accent || !m || m.length < 3) return false;
  const alpha = m[3] === undefined ? 1 : Number(m[3]);
  if (alpha <= 0.5) return false;
  return m.slice(0, 3).every((v, i) => Math.abs(Number(v) - (accent[i] ?? -99)) <= 2);
}

/**
 * The ring colour over a pressable control. Null (the ring stays --fg, see
 * cursor.css) everywhere except over a control that is itself filled with
 * its scope's accent (the primary button), where the ring takes the
 * control's own label colour so it reads on the fill. The cursor never adds
 * an accent of its own: the viewport keeps one signal.
 */
export function ringColor(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest(PRESSABLE);
  if (!control) return null;
  // The fill can sit on an inner span (LinkButton's chamfer), so walk up from
  // the element under the pointer to the control.
  for (let el: Element | null = target; el; el = el.parentElement) {
    const style = window.getComputedStyle(el);
    if (isAccentFill(style)) return style.color;
    if (el === control) break;
  }
  return null;
}
