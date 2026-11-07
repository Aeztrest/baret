import { useEffect, useState } from "react";

/**
 * True while the main pointer is fine and can hover (a mouse or trackpad).
 * False on touch screens, pen-without-hover and before the first effect, so
 * anything gated on it starts off and only switches on in the browser. Live:
 * docking a tablet to a keyboard and trackpad flips it without a reload.
 * Shared by the eyelet cursor and the smoothed wheel scroll.
 */
const QUERY = "(pointer: fine) and (hover: hover)";

export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = (): void => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return fine;
}
