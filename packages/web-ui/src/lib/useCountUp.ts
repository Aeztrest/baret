import { useEffect, useState } from "react";
import { useReduce } from "./useReduce.js";

/**
 * A figure that counts up from zero once, on the first paint (BRAND section
 * 08 count-up; docs/WALLET.md 2.1: "Count-up animation on first load, none
 * afterwards"). 600 ms on an ease-out close to the BRAND curve, with no
 * overshoot, keeping the value's decimals and its thousands commas. Under
 * reduced motion, and on every later change, the value shows at once.
 *
 * Client-rendered surfaces only: a prerendered figure would paint as zero.
 */
export function useCountUp(value: string, duration = 600): string {
  const reduce = useReduce();
  const [shown, setShown] = useState(reduce ? value : zero(value));
  const [done, setDone] = useState(reduce);

  useEffect(() => {
    // `reduce` is read here as well as in the initial state: it can turn true
    // after the first render (a setting changed mid-count, or a hydrated page
    // whose first render used the server's "no preference").
    if (done || reduce) {
      setShown(value);
      return;
    }
    const target = Number.parseFloat(value.replaceAll(",", ""));
    if (!Number.isFinite(target) || target === 0) {
      setShown(value);
      setDone(true);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const t = Math.min((time - start) / duration, 1);
      // easeOutCubic, close to the BRAND curve and with no overshoot.
      const eased = 1 - (1 - t) ** 3;
      setShown(format(target * eased, value));
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        setShown(value);
        setDone(true);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, done, reduce]);

  return shown;
}

/** `n` written the way `like` is written: the same decimals, commas if it has them. */
export function format(n: number, like: string): string {
  const decimals = (like.split(".")[1] ?? "").length;
  const fixed = n.toFixed(decimals);
  if (!like.includes(",")) return fixed;
  const [whole = "", part] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return part === undefined ? grouped : `${grouped}.${part}`;
}

function zero(value: string): string {
  return format(0, value);
}
