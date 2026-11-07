import { type JSX, type ReactNode, useLayoutEffect } from "react";
import "./dapp-themes.css";

/** The six demo dApps, by route slug. */
export const DAPP_NAMES = [
  "scrybe",
  "novaswap",
  "pixeldrop",
  "orbityield",
  "claimhub",
  "launchpad",
] as const;

export type DappName = (typeof DAPP_NAMES)[number];

/**
 * Gives a demo dApp its own palette. Only the colours change: every shared
 * component reads the token variables that dapp-themes.css re-declares under
 * data-dapp, so fonts, corners, chamfers and layout stay Baret's.
 *
 * The attribute goes on the wrapper (correct from the first paint) and on
 * <html> while the page is mounted, so the body ground, overscroll, grain and
 * the eyelet cursor follow the dApp too. Baret's own UI inside the page sits
 * in data-scope="baret" and keeps Baret's palette.
 */
export function DappTheme({
  name,
  children,
}: {
  name: DappName;
  children: ReactNode;
}): JSX.Element {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.dapp = name;

    // The browser bar follows the dApp's ground, light or dark, and gets
    // Baret's own value back when the page goes.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const before = meta?.content;
    const sync = () => {
      const ground = getComputedStyle(root).getPropertyValue("--ground").trim();
      if (meta && ground) meta.content = ground;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", sync);
      if (meta && before !== undefined) meta.content = before;
      if (root.dataset.dapp === name) delete root.dataset.dapp;
    };
  }, [name]);

  return (
    <div data-dapp={name} className="min-h-dvh">
      {children}
    </div>
  );
}
