/**
 * The page's running smooth scroll, registered by SmoothScroll. It lives
 * apart from SmoothScroll so a page can stop a glide without loading Lenis:
 * a demo site's view links import this, and Lenis stays off their first
 * paint (SmoothScroll arrives later, lazily, through Signature).
 */
interface Glide {
  stop(): void;
  start(): void;
}

let running: Glide | null = null;

/** SmoothScroll calls this with its instance, and with null when it goes. */
export function registerGlide(next: Glide | null): void {
  running = next;
}

/** The registered instance, so SmoothScroll can tell whether it is still its own. */
export function currentGlide(): Glide | null {
  return running;
}

/**
 * Ends a glide still in flight, at the real scroll position. stop() and
 * start() each reset Lenis; a modal that still locks the page keeps it
 * stopped. Does nothing when no smooth scroll is running.
 */
export function stopGlide(): void {
  const glide = running;
  if (!glide) return;
  glide.stop();
  if (!document.body.hasAttribute("data-scroll-locked")) glide.start();
}
