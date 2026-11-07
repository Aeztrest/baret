import { common } from "@baret/content";
import { Mark } from "@baret/ui";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { type JSX, useEffect, useId, useRef, useState } from "react";
import { NavLink } from "react-router";
import { NEW_TAB } from "../components/NewTabLink.js";
import { routes, warm } from "../routes.js";
import { MobileMenu } from "./MobileMenu.js";
import { NAV, ROW } from "./nav.js";

/**
 * The marketing header (Meric's revision, 2026-10-13): the logo, five page
 * links and one primary action, the web wallet.
 *
 * - The logo always goes to https://usebaret.com, from every page.
 * - The page links move within the tab; the current page has an underline
 *   and aria-current. From 1024 px they sit in the bar; below, a menu
 *   button opens them in a sheet (MobileMenu: focus trap, Escape).
 * - "Open wallet" leaves the site, so it opens a new tab.
 * - The bar is an opaque plate (BRAND: no glass). It takes the tone of the
 *   band beneath it (graphite over a [data-band="dark"] surface) and gains a
 *   soft shadow once the page has scrolled.
 */

/** Just under the 56 px header: the line whose band decides the header tone. */
const PROBE_Y = 57;

/** True when a [data-band="dark"] element covers the line just under the header. */
function darkBandUnderHeader(): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-band="dark"]')).some((el) => {
    if (el.closest("[data-site-header]")) return false;
    const r = el.getBoundingClientRect();
    return r.top <= PROBE_Y && r.bottom > PROBE_Y;
  });
}

export function SiteHeader({ pathname }: { pathname: string }): JSX.Element {
  const { dark, settled, scrolled } = useHeaderState(pathname);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // A new page closes the sheet.
  // biome-ignore lint/correctness/useExhaustiveDependencies: close on every path change
  useEffect(() => setOpen(false), [pathname]);

  const tone = dark
    ? "border-chalk/12 bg-graphite text-chalk"
    : "border-[color:var(--rule)] bg-[color:var(--ground)] text-[color:var(--fg)]";
  const shadow = scrolled && !open ? "shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)]" : "";

  return (
    <header
      data-site-header=""
      data-band={dark ? "dark" : "light"}
      className={`sticky top-0 z-40 h-14 border-b ${settled ? "transition-[background-color,color,border-color,box-shadow] duration-200 ease-out" : ""} ${tone} ${shadow}`}
    >
      <div
        className={`mx-auto flex h-full w-full items-center justify-between gap-3 ${ROW} max-[359px]:px-3`}
      >
        <a
          href={common.nav.home.href}
          aria-label={common.nav.home.label}
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]"
        >
          <Mark decorative size={22} slit={dark ? "var(--color-graphite)" : "var(--ground)"} />
          <span
            aria-hidden="true"
            className="font-stencil text-lg uppercase tracking-[0.04em] max-[374px]:hidden md:text-xl"
          >
            {common.brand.wordmark}
          </span>
        </a>

        <nav aria-label={common.nav.label} className="hidden min-w-0 lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((route) => (
              <li key={route.key}>
                <NavLink
                  to={route.path}
                  data-nav-item=""
                  viewTransition
                  onPointerEnter={() => warm(route.key)}
                  onFocus={() => warm(route.key)}
                  className={({ isActive }) => navClass(isActive, dark)}
                >
                  {route.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <WalletAction dark={dark} />
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? common.nav.menu.close : common.nav.menu.open}
            onClick={() => setOpen((o) => !o)}
            className="inline-flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)] lg:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="size-6" strokeWidth={1.5} />
            ) : (
              <Menu aria-hidden="true" className="size-6" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <MobileMenu
          id={menuId}
          dark={dark}
          onClose={(restoreFocus) => {
            setOpen(false);
            if (restoreFocus) toggleRef.current?.focus();
          }}
        />
      ) : null}
    </header>
  );
}

/**
 * The one primary action: the web wallet on its own domain, so a new tab.
 * A solid plate in the header's ink (never orange: the page's hero and
 * closing buttons stay the only orange in their viewport). The long label
 * from 640 px, the short one on phones.
 */
function WalletAction({ dark }: { dark: boolean }): JSX.Element {
  const { wallet, newTab } = common.nav;
  const face = dark
    ? "bg-chalk text-ink hover:bg-white"
    : "bg-[color:var(--fg)] text-[color:var(--ground)] hover:bg-[color:var(--fg)]/85";
  return (
    <a
      href={wallet.href}
      {...NEW_TAB}
      className="group inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]"
    >
      <span
        className={`chamfer-sm inline-flex h-9 items-center gap-1.5 px-3 font-display text-sm font-extrabold uppercase tracking-[0.08em] transition-[background-color,scale] duration-150 ease-out group-active:scale-[0.97] motion-reduce:group-active:scale-100 ${face}`}
      >
        <span className="hidden sm:inline">{wallet.label}</span>
        <span className="sm:hidden">{wallet.short}</span>
        <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
        <span className="sr-only"> {newTab}</span>
      </span>
    </a>
  );
}

/**
 * 12 px mono labels. The current page carries a 2 px underline; hover
 * shows the accent. Only colours transition, never the outline, so the
 * focus ring appears at once. data-nav-item is the forced-colors hook in
 * tokens.css.
 */
export function navClass(active: boolean, dark: boolean): string {
  const base =
    "relative inline-flex min-h-11 items-center px-3 font-mono text-[12px] uppercase tracking-[0.06em] transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:transition-colors after:duration-150 hover:after:bg-[color:var(--accent)] focus-visible:outline-offset-0";
  if (active) {
    return `${base} ${dark ? "text-chalk after:bg-chalk" : "text-[color:var(--fg)] after:bg-[color:var(--fg)]"}`;
  }
  return `${base} after:bg-transparent ${dark ? "text-chalk/72 hover:text-chalk" : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"}`;
}

/**
 * The header's tone and shadow. Probes on scroll, on resize and whenever the
 * page tree changes (a lazy page mounts after the header). No DOM access
 * during render, so the server markup and the first client render agree.
 */
function useHeaderState(pathname: string): {
  dark: boolean;
  settled: boolean;
  scrolled: boolean;
} {
  const { scrollY } = useScroll();
  // The landing opens on a dark band, so seed from the route and the first
  // paint is already graphite instead of flashing the light plate.
  const [dark, setDark] = useState(pathname === routes.home.path);
  const [settled, setSettled] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const next = darkBandUnderHeader();
    setDark((d) => (d === next ? d : next));
    const past = y > 8;
    setScrolled((s) => (s === past ? s : past));
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-probe on every route change
  useEffect(() => {
    const probe = () => {
      const next = darkBandUnderHeader();
      setDark((d) => (d === next ? d : next));
      setScrolled(window.scrollY > 8);
    };
    probe();
    setSettled(true);
    window.addEventListener("resize", probe);
    const main = document.querySelector("main");
    const observer = new MutationObserver(probe);
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", probe);
      observer.disconnect();
    };
  }, [pathname]);

  return { dark, settled, scrolled };
}
