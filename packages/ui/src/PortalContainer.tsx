import { createContext, type ReactNode, use } from "react";

/**
 * Where overlays are portalled.
 *
 * Radix sends dialogs, popovers, selects and dropdowns to `document.body` and
 * positions them fixed. That is right on a page and wrong in the extension
 * popup, which is 360 by 600 with `overflow: hidden`: anything wider than the
 * popup is clipped with no way to scroll to it.
 *
 * The three apps wrap their root in this and pass the element they want
 * overlays to land in. On the web that is `document.body` and the default is
 * correct, so nothing has to be done.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) {
  return <PortalContainerContext value={container}>{children}</PortalContainerContext>;
}

/** Null means Radix uses its default, which is `document.body`. */
export function usePortalContainer(): HTMLElement | null {
  return use(PortalContainerContext);
}
