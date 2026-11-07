import { common } from "@baret/content";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { m } from "motion/react";
import { type JSX, useEffect, useRef } from "react";
import { NavLink } from "react-router";
import { NEW_TAB } from "../components/NewTabLink.js";
import { warm } from "../routes.js";
import { NAV } from "./nav.js";

/**
 * The page links under 1024 px: a sheet that drops from the header and
 * covers the page. Only mounted while open, so the server markup never has
 * it.
 *
 * - Focus moves to the first link; Tab and Shift+Tab stay inside the header
 *   (the logo, the wallet action, the close button and the links).
 * - Escape closes it and returns focus to the menu button; a click on the
 *   backdrop closes it too.
 * - The page behind does not scroll while it is open.
 * - It closes by itself at 1024 px and up, where the links sit in the bar.
 */
export function MobileMenu({
  id,
  dark,
  onClose,
}: {
  id: string;
  dark: boolean;
  onClose: (restoreFocus: boolean) => void;
}): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const header = panel.current?.closest("header");
    panel.current?.querySelector<HTMLElement>("a")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current(true);
        return;
      }
      if (event.key !== "Tab" || !header) return;
      const items = Array.from(
        header.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      ).filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => {
      if (wide.matches) close.current(false);
    };

    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, []);

  const tone = dark ? "bg-graphite text-chalk" : "bg-[color:var(--ground)] text-[color:var(--fg)]";
  const rule = dark ? "border-chalk/12" : "border-[color:var(--rule)]";

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 lg:hidden">
      {/* The backdrop: a click closes the sheet. Keyboard users have Escape. */}
      <m.button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => close.current(false)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <m.div
        ref={panel}
        id={id}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={`relative max-h-full overflow-y-auto border-b ${rule} ${tone}`}
      >
        <nav aria-label={common.nav.label} className="mx-auto w-full max-w-[1276px] px-4 md:px-8">
          <ul>
            {NAV.map((route) => (
              <li key={route.key} className={`border-b ${rule}`}>
                <NavLink
                  to={route.path}
                  data-nav-item=""
                  viewTransition
                  onFocus={() => warm(route.key)}
                  onClick={() => close.current(false)}
                  className={({ isActive }) =>
                    `flex min-h-14 items-center justify-between font-display text-2xl font-extrabold uppercase tracking-[0.02em] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)] ${isActive ? "" : dark ? "text-chalk/72" : "text-[color:var(--fg-muted)]"}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={`size-2 ${isActive ? "bg-[color:var(--accent)]" : "bg-transparent"}`}
                        />
                        {route.label}
                      </span>
                      <ArrowRight aria-hidden="true" className="size-5" strokeWidth={1.5} />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="py-6">
            <a
              href={common.nav.wallet.href}
              {...NEW_TAB}
              className={`chamfer-sm flex h-12 items-center justify-center gap-2 font-display text-base font-extrabold uppercase tracking-[0.08em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)] ${dark ? "bg-chalk text-ink" : "bg-[color:var(--fg)] text-[color:var(--ground)]"}`}
            >
              {common.nav.wallet.label}
              <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2} />
              <span className="sr-only"> {common.nav.newTab}</span>
            </a>
          </div>
        </nav>
      </m.div>
    </div>
  );
}
