/**
 * The panel's own keyframes, rendered once in a <style> inside the panel.
 * Every moving rule sits under prefers-reduced-motion: no-preference, so a
 * reader who asked for less motion gets the same layout, still. The class
 * names carry a "bp-" prefix (Baret panel) so nothing else picks them up.
 */
export const PANEL_MOTION = `
.bp-scan { position: absolute; inset: 0; pointer-events: none; }
.bp-skeleton { background: var(--rule); opacity: 0.7; }
@media (prefers-reduced-motion: no-preference) {
  .bp-scan::after {
    content: ""; position: absolute; top: 0; bottom: 0; width: 40%;
    background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--accent) 22%, transparent), transparent);
    animation: bp-scan 1400ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
  .bp-dot { animation: bp-dot 1000ms ease-in-out infinite; }
  .bp-skeleton {
    background: linear-gradient(90deg, var(--rule) 0%, var(--surface) 50%, var(--rule) 100%);
    background-size: 200% 100%;
    animation: bp-shimmer 1600ms linear infinite;
  }
  .bp-rise { animation: bp-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  .bp-stamp { animation: bp-stamp 520ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
}
@keyframes bp-scan { from { left: -40%; } to { left: 100%; } }
@keyframes bp-dot { 0%, 100% { transform: scale(0.7); opacity: 0.6; } 50% { transform: scale(1); opacity: 1; } }
@keyframes bp-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@keyframes bp-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes bp-stamp { from { opacity: 0; transform: scale(0.85) rotate(-4deg); } to { opacity: 1; transform: none; } }
`;
