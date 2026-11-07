// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Kept in sync with DAPP_NAMES in DappTheme.tsx (which imports the CSS itself). */
const DAPP_NAMES = ["scrybe", "novaswap", "pixeldrop", "orbityield", "claimhub", "launchpad"];

const css = readFileSync(new URL("./dapp-themes.css", import.meta.url), "utf8");

/** Every token a dApp palette must re-declare, in light and in both dark entry points. */
const TOKENS = [
  "--ground",
  "--ground-deep",
  "--surface",
  "--fg",
  "--fg-muted",
  "--fg-faint",
  "--fg-ghost",
  "--rule",
  "--rule-strong",
  "--control-edge",
  "--accent",
  "--accent-mark",
  "--accent-deep",
  "--accent-dim",
  "--on-accent",
  "--accent-edge",
  "--focus",
];

/** The declaration blocks whose selector list mentions this dApp. */
function blocksFor(name: string): string[] {
  const blocks: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const selector = m[1] ?? "";
    if (selector.includes(`[data-dapp="${name}"]`)) blocks.push(m[2] ?? "");
  }
  return blocks;
}

type Rgb = readonly [number, number, number];

/** A token's value in one block: #rrggbb, or rgb(r g b / a) laid over `under`. */
function colour(block: string, token: string, under?: Rgb): Rgb {
  const value = new RegExp(`${token}:\\s*([^;]+);`).exec(block)?.[1]?.trim() ?? "";
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
  const rgb = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(value);
  if (!rgb || !under) throw new Error(`${token} has no colour I can read: "${value}"`);
  const alpha = Number(rgb[4]);
  return [1, 2, 3].map(
    (i, k) => Number(rgb[i]) * alpha + (under[k] ?? 0) * (1 - alpha),
  ) as unknown as Rgb;
}

/** WCAG 2 contrast ratio. */
function ratio(a: Rgb, b: Rgb): number {
  const lum = (c: Rgb) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as unknown as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("dApp themes", () => {
  it.each(DAPP_NAMES)("%s defines every token in light, OS dark and explicit dark", (name) => {
    const blocks = blocksFor(name);
    expect(blocks).toHaveLength(3);
    for (const block of blocks) {
      for (const token of TOKENS) expect(block).toContain(`${token}:`);
    }
  });

  it("never re-themes the functional state colours", () => {
    for (const token of ["--safe:", "--caution:", "--blocked:", "--watching:", "--network:"]) {
      expect(css).not.toContain(token);
    }
  });

  it.each(DAPP_NAMES)(
    "%s keeps faint text at 4.5:1 and marks at 3:1 on ground and surface",
    (name) => {
      for (const block of blocksFor(name)) {
        for (const bg of ["--ground", "--surface"]) {
          const under = colour(block, bg);
          expect(ratio(colour(block, "--fg-faint", under), under)).toBeGreaterThanOrEqual(4.5);
          expect(ratio(colour(block, "--accent-mark"), under)).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );
});
