import "../styles/reveal.css";
import type { CSSProperties, JSX, ReactNode } from "react";
import { staggerDelay } from "../lib/motion.js";

/**
 * The landing surface enter, on CSS (IMPROVE A5).
 *
 * One shared IntersectionObserver marks each surface with `data-in` when it
 * is 10 % above the bottom of the viewport; reveal.css turns that into the
 * BRAND landing rise (460 ms, 14 px, once). The hidden state exists only once
 * the observer is attached: without script, without IntersectionObserver,
 * under reduced motion and in print every surface renders as a plain, fully
 * visible element. In server markup (renderToStaticMarkup) it is plain too.
 * happy-dom does define IntersectionObserver but never fires it, so in DOM
 * tests a surface carries `data-reveal` and never gets `data-in`; happy-dom
 * applies no CSS, so it still reads as visible there. No Motion code runs
 * here.
 *
 * Grid rule: use `Stagger` only for groups that stay on one row at every width
 * (header lines, a 4-up row). For grids that stack on phones, give each item
 * its own `Reveal delay={staggerDelay(i % cols)}`.
 */

type ItemTag = "div" | "li" | "article";
type GroupTag = "div" | "ul" | "ol";

let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  observer ??= new IntersectionObserver(
    (entries, io) => {
      for (const entry of entries) {
        // A surface the reader already scrolled (or jumped) past shows too.
        if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) continue;
        entry.target.setAttribute("data-in", "");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  return observer;
}

function prefersReduced(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A stable ref callback: hide the element only once it is being watched. */
function watch(el: HTMLElement | null): (() => void) | undefined {
  if (!el || el.hasAttribute("data-in") || prefersReduced()) return undefined;
  const io = sharedObserver();
  if (!io) return undefined;
  el.setAttribute("data-reveal", "surface");
  io.observe(el);
  return () => io.unobserve(el);
}

function delayStyle(delay: number | undefined): CSSProperties | undefined {
  return delay ? { transitionDelay: `${delay}s` } : undefined;
}

/** Rises 14 px and fades in over 460 ms on the BRAND ease, once, as it scrolls into view. */
export function Reveal({
  children,
  delay,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ItemTag;
}): JSX.Element {
  const props = { ref: watch, className, style: delayStyle(delay) };
  if (as === "li") return <li {...props}>{children}</li>;
  if (as === "article") return <article {...props}>{children}</article>;
  return <div {...props}>{children}</div>;
}

/**
 * A row of StaggerItems. It is a plain element: each item watches itself and
 * adds its own delay, so a row that wraps never animates off-screen.
 */
export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: GroupTag;
}): JSX.Element {
  if (as === "ul") return <ul className={className}>{children}</ul>;
  if (as === "ol") return <ol className={className}>{children}</ol>;
  return <div className={className}>{children}</div>;
}

/** One item of a Stagger: the surface enter, `staggerDelay(index)` late. */
export function StaggerItem({
  children,
  index,
  className,
  as = "div",
}: {
  children: ReactNode;
  index: number;
  className?: string;
  as?: ItemTag;
}): JSX.Element {
  return (
    <Reveal delay={staggerDelay(index)} {...(className ? { className } : {})} as={as}>
      {children}
    </Reveal>
  );
}
