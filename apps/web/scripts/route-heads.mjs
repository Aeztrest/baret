/**
 * Build-time files that depend on the route registry (IMPROVE G4, G5).
 *
 * - `dist/<route>/index.html` for every marketing route: the built index.html
 *   with that route's title, description, og:* and canonical, so a shared
 *   inner link unfurls with its own card. The host serves these files before
 *   the SPA fallback. The body is still the empty shell here: prerender.mjs
 *   runs after this and writes each route's markup into its file.
 * - The same file, marked noindex and left out of the sitemap, for the demo
 *   sites and the utility pages, so they never receive the landing's markup
 *   or its hero preload through the fallback; and `dist/404.html`, the same
 *   shell for unmatched paths on a host that serves a real 404.
 * - `dist/sitemap.xml` listing "/" and the marketing routes, and a Sitemap
 *   line appended to the robots.txt copied from public/. Both need absolute
 *   URLs, so they are written only when BARET_SITE_URL is set.
 *
 * The registry is read as text: importing routes.ts would pull every lazy
 * page into the config bundle. The demo sites are never listed (they carry
 * noindex), and neither is anything without `group: "marketing"`.
 */
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { headFor, replaceHead, stripHeadMarks } from "./head.mjs";

/** `{ key, path, title, group }` for each registry entry with a literal path and title. */
function registryRoutes(source) {
  const parts = source.split(/\n {2}(\w+): \{/).slice(1);
  const entries = [];
  for (let i = 0; i < parts.length; i += 2) entries.push({ key: parts[i], body: parts[i + 1] });
  return entries
    .map(({ key, body }) => ({
      key,
      path: body.match(/path: "([^"]+)"/)?.[1],
      title: body.match(/title: "([^"]+)"/)?.[1],
      group: body.match(/group: "([^"]+)"/)?.[1],
      module: body.match(/import\("\.\/([^"]+)\.js"\)/)?.[1],
    }))
    .filter((r) => r.path && r.title && r.path !== "/" && !/[:*]/.test(r.path));
}

/** `{ key, path, title }` for each registry entry whose group is "marketing". */
export function marketingRoutes(source) {
  return registryRoutes(source)
    .filter((r) => r.group === "marketing")
    .map(({ key, path, title, module }) => ({ key, path, title, module }));
}

/** The demo sites and the utility pages: a file of their own, never indexed. */
export function unlistedRoutes(source) {
  return registryRoutes(source)
    .filter((r) => r.group === "demo" || r.group === "utility")
    .map(({ key, path, title, module }) => ({ key, path, title, module }));
}

/** The manifest key of a route's content file (router.tsx HEAD): the hub's is hub. */
function contentKey(routeKey) {
  const name = routeKey === "showcase" ? "hub" : routeKey;
  return `../../packages/content/src/web/${name}.content.ts`;
}

/** Every manifest key `key` reaches through static imports, itself included. */
function closure(manifest, key, seen = new Set()) {
  if (seen.has(key) || !manifest[key]) return seen;
  seen.add(key);
  for (const next of manifest[key].imports ?? []) closure(manifest, next, seen);
  return seen;
}

/**
 * The route's own chunks and styles, which the browser would otherwise find
 * only after the entry has run and the router has asked for the page: one
 * round trip after another on a slow phone. The entry's own chunks are
 * already in the shell, so they are left out.
 */
function chunkPreloads(manifest, module, routeKey) {
  const key = ["tsx", "ts"].map((ext) => `src/${module}.${ext}`).find((k) => manifest[k]);
  if (!key) throw new Error(`route-heads: src/${module} is not in the build manifest`);
  const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
  const shell = closure(manifest, entry);
  // router.tsx loads the page's head (its content file) next to the page
  // and waits for both, so that chunk is preloaded too when it has one.
  const reach = closure(manifest, key);
  const content = manifest[contentKey(routeKey)] ? contentKey(routeKey) : null;
  if (content) closure(manifest, content, reach);
  const own = [...reach].filter((k) => !shell.has(k));
  const shellCss = new Set([...shell].flatMap((k) => manifest[k].css ?? []));
  const css = [...new Set(own.flatMap((k) => manifest[k].css ?? []))].filter(
    (f) => !shellCss.has(f),
  );
  return [
    ...own.map((k) => `<link rel="modulepreload" crossorigin href="/${manifest[k].file}">`),
    ...css.map((f) => `<link rel="preload" as="style" crossorigin href="/${f}">`),
  ];
}

function sitemap(site, paths) {
  const urls = paths.map((p) => `  <url><loc>${site}${p}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/**
 * `descriptions` maps a registry key to that page's meta description from
 * @baret/content; a route without one falls back to `description` (the brand
 * line). `heads` maps a demo site's key to its scenario `{ title,
 * description }`, which replaces the registry title in that site's file. The head markers are stripped from every written page, "/" included,
 * once they are no longer needed.
 */
export async function writeRouteHeads({
  outDir,
  routesFile,
  site,
  description,
  descriptions,
  heads,
}) {
  const source = await readFile(routesFile, "utf8");
  const routes = marketingRoutes(source);
  const shellFile = join(outDir, "index.html");
  const shell = await readFile(shellFile, "utf8");

  // The build manifest (build.manifest in vite.config.ts) maps each page to
  // its chunks. It is read here and removed, so it never ships.
  const manifestDir = join(outDir, ".vite");
  const manifest = JSON.parse(await readFile(join(manifestDir, "manifest.json"), "utf8"));
  await rm(manifestDir, { recursive: true, force: true });

  const write = async (route, head) => {
    const dir = join(outDir, route.path.slice(1));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), stripHeadMarks(replaceHead(shell, head)));
  };
  for (const route of routes) {
    const own = descriptions?.[route.key] ?? description;
    const preload = chunkPreloads(manifest, route.module, route.key);
    await write(route, headFor({ ...route, description: own, site, preload }));
  }
  for (const route of unlistedRoutes(source)) {
    const preload = chunkPreloads(manifest, route.module, route.key);
    const own = heads?.[route.key] ?? { title: route.title, description };
    await write(route, headFor({ ...route, ...own, site, noindex: true, preload }));
  }
  // A real 404 for hosts that serve one for unmatched paths (Vercel serves
  // dist/404.html with status 404 once no catch-all rewrite answers first):
  // the shell, noindex; prerender.mjs fills it with the not-found page.
  const notFound = source.match(/notFound: \{[^}]*title: "([^"]+)"/)?.[1];
  if (!notFound) throw new Error("route-heads: no notFound route found");
  const head404 = headFor({ path: "/404", title: notFound, description, site, noindex: true });
  await writeFile(join(outDir, "404.html"), stripHeadMarks(replaceHead(shell, head404)));
  await writeFile(shellFile, stripHeadMarks(shell));

  if (!site) return;
  await writeFile(join(outDir, "sitemap.xml"), sitemap(site, ["/", ...routes.map((r) => r.path)]));
  await appendFile(join(outDir, "robots.txt"), `\nSitemap: ${site}/sitemap.xml\n`);
}
