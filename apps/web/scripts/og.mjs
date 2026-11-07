/**
 * Renders scripts/og.html into public/og.png at 1200 x 630 (IMPROVE G3),
 * and public/apple-touch-icon.png at 180 x 180 (G2): the ink mark on a
 * square orange plate, no rounding (BRAND section 10, extension icon rule).
 * Run by hand when the brand changes: `node scripts/og.mjs`. Needs a
 * Playwright install; set PLAYWRIGHT_CORE to its index.mjs if it is not
 * resolvable from here. The PNG is committed; nothing runs at build time.
 */
import { fileURLToPath, pathToFileURL } from "node:url";

const core = process.env.PLAYWRIGHT_CORE ?? "playwright-core";
const { chromium } = await import(core);
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(here("./og.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.locator("#card").screenshot({ path: here("../public/og.png") });

// The mark spans 58 x 35 units of its 64 grid; 120 px wide leaves the plate
// a 30 px margin either side. The visor cut shows the orange plate.
const icon = `<body style="margin:0"><div id="icon" style="width:180px;height:180px;display:grid;place-items:center;background:#ff4f00">
<svg width="120" viewBox="3 14 58 35" xmlns="http://www.w3.org/2000/svg"><path fill="#121316" fill-rule="evenodd" d="M13 38C13 22.5 21 14 32 14s19 8.5 19 24ZM21 27v4h22v-4Z"/><path fill="#121316" d="M6 41h52l3 3.5-3 4.5H6l-3-4.5Z"/></svg></div></body>`;
await page.setViewportSize({ width: 180, height: 180 });
await page.setContent(icon);
await page.locator("#icon").screenshot({ path: here("../public/apple-touch-icon.png") });
await browser.close();
