/**
 * Prerenders every route into its dist file after the client build
 * (IMPROVE E5, then PAGE-08 and MAIN-01 for the other routes).
 *
 * A page used to paint only once its scripts had loaded and run: about 2.1 s
 * on a throttled phone for the landing, 3.5 to 4.7 s for the others, with the
 * hero picture painting later still. With the markup in the HTML the first
 * frame needs the HTML and the CSS alone, and React hydrates it when the
 * scripts arrive. Without JavaScript the page still reads.
 *
 * Steps: build src/entry-server.tsx for Node into node_modules/.cache (never
 * shipped), then for each path in PRERENDERED render it and write the markup
 * into the empty #root of the file route-heads.mjs has already written for
 * it: dist/index.html for "/", dist/<route>/index.html for the others and
 * dist/404.html for the not-found page. Each file carries the path it was
 * made for in data-prerender on <html> ("*" for the 404), which index.html
 * and main.tsx compare with the URL before they show or hydrate the markup.
 */
import { readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "node_modules/.cache/baret-ssr");
const dist = join(root, "dist");
const EMPTY = '<div id="root"></div>';
const HTML_OPEN = '<html lang="en">';

await build({
  root,
  logLevel: "warn",
  // Everything is bundled, React included. Left external, a package that a
  // workspace library depends on (Radix, through @baret/web-ui) is resolved
  // by Node from wherever it finds one, with a React of its own next to it,
  // and the render fails with two copies of React.
  ssr: { noExternal: true },
  build: {
    ssr: "src/entry-server.tsx",
    outDir,
    emptyOutDir: true,
    copyPublicDir: false,
    rolldownOptions: {
      // Chunking does not matter in a bundle that only runs here once.
      onLog(level, log, handler) {
        if (log.code === "INEFFECTIVE_DYNAMIC_IMPORT") return;
        handler(level, log);
      },
    },
  },
});

/** The dist file route-heads.mjs wrote for `path`, and the mark its <html> gets. */
function fileFor(path) {
  if (path === "/") return { file: join(dist, "index.html"), mark: "/" };
  if (path === "/404") return { file: join(dist, "404.html"), mark: "*" };
  return { file: join(dist, path.slice(1), "index.html"), mark: path };
}

const { PRERENDERED, render } = await import(pathToFileURL(join(outDir, "entry-server.js")).href);
let total = 0;
for (const path of PRERENDERED) {
  const markup = await render(path);
  if (!markup.startsWith("<div"))
    throw new Error(`prerender: unexpected markup at the start of ${path}`);
  const { file, mark } = fileFor(path);
  const shell = await readFile(file, "utf8");
  if (!shell.includes(EMPTY)) throw new Error(`prerender: ${file} has no empty #root`);
  if (!shell.includes(HTML_OPEN)) throw new Error(`prerender: ${file} has no <html lang="en">`);
  await writeFile(
    file,
    shell
      .replace(HTML_OPEN, `<html lang="en" data-prerender="${mark}">`)
      .replace(EMPTY, `<div id="root">${markup}</div>`),
  );
  total += markup.length;
}
await rm(outDir, { recursive: true, force: true });
console.log(
  `prerender: ${PRERENDERED.length} pages written into dist (${Math.round(total / 1024)} KB of markup)`,
);
