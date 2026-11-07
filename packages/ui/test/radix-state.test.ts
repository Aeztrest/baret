import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Switch } from "../src/components/switch.js";
import { Tabs, TabsList, TabsTrigger } from "../src/components/tabs.js";

/**
 * Regression: the re-skinned shadcn controls style state with bare attributes
 * (data-checked, data-active) while Radix 1.x emits data-state="...". Without
 * the variant mapping in tokens.css a switch never looked on and a tab never
 * looked current. This compiles the real stylesheet and checks that the class
 * a rendered control carries reaches the attribute Radix actually sets.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
// packages/ui does not depend on Tailwind itself; every app that consumes the
// stylesheet does, so borrow the showcase's copy.
// Tailwind is this package's own dev dependency (Metropolis resolved it from the showcase app).
const requireFromApp = createRequire(join(root, "packages", "ui", "package.json"));

async function compileTokens(candidates: string[]): Promise<string> {
  const { compile } = (await import(
    requireFromApp.resolve("tailwindcss")
  )) as typeof import("tailwindcss");
  const twDir = dirname(requireFromApp.resolve("tailwindcss/package.json"));
  const source = await readFile(join(here, "..", "src", "tokens.css"), "utf8");
  const compiler = await compile(source, {
    base: here,
    loadStylesheet: async (id: string) => {
      const file = id === "tailwindcss" ? "index.css" : id.replace(/^tailwindcss\//, "");
      const path = join(twDir, file);
      return { content: await readFile(path, "utf8"), base: twDir, path };
    },
  });
  return compiler.build(candidates);
}

describe("Radix state variants", () => {
  it("a checked Switch carries data-state=checked and a data-checked class", () => {
    const html = renderToStaticMarkup(createElement(Switch, { defaultChecked: true }));
    expect(html).toContain('data-state="checked"');
    expect(html).toContain("data-checked:bg-primary");
  });

  it("an active tab carries data-state=active", () => {
    const html = renderToStaticMarkup(
      createElement(
        Tabs,
        { defaultValue: "a" },
        createElement(TabsList, null, createElement(TabsTrigger, { value: "a" }, "A")),
      ),
    );
    expect(html).toContain('data-state="active"');
    expect(html).toContain("data-active:bg-background");
  });

  it("the compiled classes target the attributes Radix emits", async () => {
    const css = await compileTokens([
      "data-checked:bg-primary",
      "data-active:bg-background",
      "data-horizontal:flex-col",
      "state-on:bg-primary",
    ]);
    expect(css).toMatch(/data-checked\\:bg-primary:is\(.*\[data-state="checked"\]\) \{/);
    expect(css).toMatch(/data-active\\:bg-background:is\(.*\[data-state="active"\]\) \{/);
    expect(css).toMatch(/data-horizontal\\:flex-col:is\(.*\[data-orientation="horizontal"\]\) \{/);
    expect(css).toMatch(/state-on\\:bg-primary:is\(\[data-state="checked"\], \[data-state="on"\]/);
  });
});
