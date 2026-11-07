import { home } from "@baret/content";
import { Img } from "@baret/web-ui/components/Img";
import { T } from "@baret/web-ui/lib/type";
import { cx } from "@baret/web-ui/lib/util";
import { type JSX, type KeyboardEvent, useRef, useState } from "react";
import { IMG, type ImgAsset } from "../../../shared/assets.js";
import { CapsSketch, ReadsSketch, WatchesSketch } from "./Sketches.js";
import { DARK_PRINT } from "./Tile.js";

/**
 * How it works as one interactive stage: three tabs (Reads it, Caps it,
 * Watches it) and one panel. Hover or focus a tab on a pointer device, or
 * click or tap it, and the stage swaps to that layer: its photo, a small
 * live sketch of what the layer does, its paragraph and its points.
 *
 * ARIA tabs: arrow keys move between the tabs (automatic activation), Home
 * and End jump to the ends. Every panel is in the markup (only the active
 * one is shown), so prerendered HTML and find-in-page keep all three.
 */

const { items, tabsLabel } = home.pillars;

interface Layer {
  readonly asset: ImgAsset;
  readonly fit: "cover" | "contain";
  readonly position: string;
  readonly dim: boolean;
  readonly Sketch: () => JSX.Element;
}

/** One photo per layer, all at one 16:9 crop (4:3 on phones), with the sketch on top. */
const LAYERS: readonly Layer[] = [
  { asset: IMG.l12, fit: "cover", position: "50% 55%", dim: true, Sketch: ReadsSketch },
  { asset: IMG.l13, fit: "cover", position: "50% 35%", dim: true, Sketch: CapsSketch },
  { asset: IMG.l14, fit: "cover", position: "30% 20%", dim: false, Sketch: WatchesSketch },
];

const tabId = (i: number): string => `layer-tab-${i}`;
const panelId = (i: number): string => `layer-panel-${i}`;

const FOCUS =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]";

function Stage({ layer, active }: { layer: Layer; active: boolean }): JSX.Element {
  const { Sketch } = layer;
  return (
    <div
      className={cx(
        "relative aspect-[4/3] overflow-hidden border border-[color:var(--rule-strong)] md:aspect-[16/9]",
        layer.dim && DARK_PRINT,
      )}
      {...(layer.asset.ground ? { style: { backgroundColor: layer.asset.ground } } : {})}
    >
      <Img
        asset={layer.asset}
        fit={layer.fit}
        position={layer.position}
        sizes="(min-width: 1024px) 760px, calc(100vw - 32px)"
        className="absolute inset-0 size-full"
      />
      <div className="absolute inset-x-3 bottom-3 md:inset-x-auto md:bottom-5 md:left-5">
        {active ? <Sketch /> : null}
      </div>
    </div>
  );
}

export function LayerTabs(): JSX.Element {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (i: number, focus = false): void => {
    setActive(i);
    if (focus) tabs.current[i]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const n = items.length;
    const map: Record<string, number> = {
      ArrowRight: (active + 1) % n,
      ArrowDown: (active + 1) % n,
      ArrowLeft: (active - 1 + n) % n,
      ArrowUp: (active - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    pick(next, true);
  };

  return (
    <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
      <div
        role="tablist"
        aria-label={tabsLabel}
        aria-orientation="vertical"
        onKeyDown={onKey}
        className="grid grid-cols-3 border-[color:var(--rule)] lg:sticky lg:top-24 lg:col-span-4 lg:grid-cols-1 lg:content-start lg:self-start lg:border-t"
      >
        {items.map((item, i) => {
          const on = i === active;
          return (
            <button
              key={item.label}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={on}
              aria-controls={panelId(i)}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(i)}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") pick(i);
              }}
              className={cx(
                "group relative flex min-h-11 flex-col items-start border-b-2 px-2 py-3 text-left transition-colors duration-200 lg:border-b lg:border-l-2 lg:px-5 lg:py-5",
                on
                  ? "border-[color:var(--accent)] text-[color:var(--fg)] lg:border-b-[color:var(--rule)]"
                  : "border-[color:var(--rule)] text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] lg:border-l-transparent",
                FOCUS,
              )}
            >
              <span className="font-mono text-label uppercase">
                <span className="max-lg:hidden">0{i + 1} </span>
                {item.label}
              </span>
              <span className={`${T.h3} mt-1 hidden lg:block`}>{item.title}</span>
            </button>
          );
        })}
      </div>
      {items.map((item, i) => {
        const layer = LAYERS[i];
        if (!layer) return null;
        return (
          <div
            key={item.label}
            role="tabpanel"
            id={panelId(i)}
            aria-labelledby={tabId(i)}
            hidden={i !== active}
            className="lg:col-span-8"
          >
            <Stage layer={layer} active={i === active} />
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-[1.4fr_1fr] md:gap-8">
              <div>
                <h3 className={`${T.h3} text-[color:var(--fg)] lg:hidden`}>{item.title}</h3>
                <p className="mt-2 max-w-[52ch] text-base leading-normal text-[color:var(--fg-muted)] lg:mt-0">
                  {item.body}
                </p>
              </div>
              <ul className="md:mt-1">
                {item.points.map((point) => (
                  <li
                    key={point}
                    className="border-t border-[color:var(--rule)] py-2 text-sm leading-normal text-[color:var(--fg)]"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}
