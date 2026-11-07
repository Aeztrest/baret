// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as assets from "./assets";

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));

/** Every /assets/ path in the registry: srcs, and each srcset candidate's URL. */
function referenced(): Set<string> {
  const paths = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      for (const candidate of value.split(",")) {
        const url = candidate.trim().split(/\s+/)[0] ?? "";
        if (url.startsWith("/assets/")) paths.add(url);
      }
    } else if (value && typeof value === "object") {
      for (const inner of Object.values(value)) walk(inner);
    }
  };
  walk(assets);
  return paths;
}

/** Every file under public/assets, as the URL the page would ask for. */
function shipped(dir = `${PUBLIC}/assets`, base = "/assets"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? shipped(`${dir}/${entry.name}`, `${base}/${entry.name}`)
      : entry.name.startsWith(".")
        ? []
        : [`${base}/${entry.name}`],
  );
}

describe("asset registry", () => {
  const paths = referenced();

  it("finds the registry's paths", () => {
    expect(paths.size).toBeGreaterThan(100);
  });

  it("points every src and srcset candidate at a file in public", () => {
    const missing = [...paths].filter((path) => !existsSync(`${PUBLIC}${path}`));
    expect(missing).toEqual([]);
  });

  it("ships no file in public/assets that the registry does not use", () => {
    const orphans = shipped().filter((path) => !paths.has(path));
    expect(orphans).toEqual([]);
  });
});
