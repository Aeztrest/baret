/**
 * AVIF twins and the extra WebP widths of the showcase pictures (IMPROVE E6).
 *
 * Encoded from the lossless masters in assets-raw (gitignored, local only),
 * never from the shipped WebP, so there is no generation loss. AVIF files keep
 * the WebP names and widths, `.avif`, so `avif()` (@baret/web-ui lib/img) maps
 * one to the other. src/shared/assets.ts is the source of truth: every set
 * below matches a srcSet / avifSrcSet there. Run by hand when a master changes:
 * `node scripts/encode-avif.mjs`. Needs ImageMagick 7 built with libheif, and
 * cwebp. The files are committed; nothing runs at build time.
 *
 * Arguments, in any order:
 *   `avif` or `webp`  runs one format only.
 *   `--dry-run`       checks every master and prints what it would write.
 *
 * Masters go by the shipped FILE name, never by the prompt ids: the landing
 * masters l-9 .. l-22 hold the next prompt's image (l-9.png is the picture
 * shipped as l-09, whatever its prompt says). The install masters are I-1 ..
 * I-6.png. s-15 has no master here: its shipped WebP is the recoloured file
 * (the green tag made orange by hand), so its copies are cut from that file,
 * not from assets-raw/s-15.png.
 *
 * Check every output by eye on the dark ground: AVIF can smear grain and band
 * smooth graphite skies. A frame that looks worse keeps WebP only (leave its
 * avifSrcSet unset in assets.ts).
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const RAW = at("../../../assets-raw/");
const PUBLIC = at("../public/assets/");
const AVIF_QUALITY = "55";

/** Read the shipped full-width WebP instead of a master (s-15 only). */
const SHIPPED = null;

/**
 * One shipped picture: folder under public/assets, master in assets-raw,
 * shipped name, full width, AVIF widths below full (null: no AVIF; the full
 * width is always encoded), WebP widths below full (the full WebP already
 * ships), WebP encoder.
 *
 * WebP encoders: "magick" is quality 80 (the bento pillars' -w480 / -w768
 * copies), "cwebp" is `cwebp -q 82` (the -w768 / -w1024 copies added later).
 */
const set = (dir, master, name, full, avif, webp = [], encoder = "cwebp") => ({
  dir,
  master,
  name,
  full,
  avif,
  webp,
  encoder,
});

const SMALL = [480, 768];
const ALL = [480, 768, 1024];
const HERO = [768, 1024];

const SETS = [
  // Landing (IMG).
  set("landing", "l-1.png", "l-01", 1536, HERO, HERO),
  set("landing", "l-6.png", "l-06", 1536, HERO),
  set("landing", "l-7.png", "l-07", 1536, []),
  set("landing", "l-9.png", "l-09", 1536, HERO, HERO),
  set("landing", "l-12.png", "l-12", 1312, null, ALL, "magick"),
  set("landing", "l-13.png", "l-13", 1374, null, SMALL, "magick"),
  set("landing", "l-14.png", "l-14", 1374, null, SMALL, "magick"),

  // Agents (AGENTS_ART).
  set("agents", "a-01.png", "a-01", 1536, HERO, [1024]),
  set("agents", "a-05.png", "a-05", 1536, ALL, [1024]),
  set("agents", "a-02.png", "a-02", 1254, ALL, [1024]),
  set("agents", "a-04.png", "a-04", 1254, ALL, [1024]),
  set("agents", "a-03.png", "a-03", 1254, ALL, [1024]),
  set("agents", "a-06.png", "a-06", 1024, SMALL),

  // Install (INSTALL_ART).
  set("install", "I-1.png", "i-01", 1536, HERO, [1024]),
  set("install", "I-3.png", "i-03", 1536, ALL, [1024]),
  set("install", "I-4.png", "i-04", 1536, ALL, [1024]),
  set("install", "I-5.png", "i-05", 1536, ALL, [1024]),
  set("install", "I-6.png", "i-06", 1536, ALL, [1024]),
  set("install", "I-2.png", "i-02", 1536, ALL, [1024]),

  // Docs cards (DOCS_CARD_ART).
  set("docs", "d-02a.png", "d-02a", 1254, ALL, [1024]),
  set("docs", "d-02b.png", "d-02b", 1024, SMALL),
  set("docs", "d-02c.png", "d-02c", 1536, ALL, [1024]),
  set("docs", "d-02d.png", "d-02d", 1536, ALL, [1024]),
  set("docs", "d-02e.png", "d-02e", 1536, ALL, [1024]),
  set("docs", "d-02f.png", "d-02f", 1536, ALL, [1024]),
  set("docs", "d-02g.png", "d-02g", 1536, ALL, [1024]),
  set("docs", "d-02h.png", "d-02h", 1024, SMALL),
  set("docs", "d-02i.png", "d-02i", 1536, ALL, [1024]),
  set("docs", "d-02j.png", "d-02j", 1536, ALL, [1024]),
  set("docs", "d-02k.png", "d-02k", 1254, ALL, [1024]),

  // Inner pages, WebP -w1024 only (HUB_ART, DOCS_ART).
  set("landing", "l-17.png", "l-17", 1536, null, [1024]),
  set("landing", "l-18.png", "l-18", 1536, null, [1024]),
  set("landing", "l-33.png", "l-33", 1254, null, [1024]),
  set("docs", "d-4.png", "d-04", 1536, null, [1024]),
  set("showcase", "h-1.png", "h-01", 1254, null, [1024]),
  set("showcase", "h-2.png", "h-02", 1254, null, [1024]),
  set("showcase", "h-3.png", "h-03", 1448, null, [1024]),
  set("showcase", "h-4.png", "h-04", 1448, null, [1024]),
  set("showcase", "h-6.jpg", "h-06", 1536, null, [1024]),

  // Demo sites, NovaSwap and the rest, WebP -w1024 only (SITE_ART).
  set("showcase", "s-1.jpg", "s-01", 1536, null, [1024]),
  set("showcase", "s-2.jpg", "s-02", 1536, null, [1024]),
  set("showcase", "s-3.jpg", "s-03", 1536, null, [1024]),
  set("showcase", "s-4.jpg", "s-04", 1536, null, [1024]),
  set("showcase", "s-5.jpg", "s-05", 1536, null, [1024]),
  set("showcase", "s-6.jpg", "s-06", 1536, null, [1024]),
  set("showcase", "s-7.jpg", "s-07", 1536, null, [1024]),
  set("showcase", "s-9.png", "s-09", 1254, null, [1024]),
  set("showcase", "s-14.png", "s-14", 1536, null, [1024]),
  set("showcase", SHIPPED, "s-15", 1254, null, [1024]),
  set("showcase", "s-17.png", "s-17", 1254, null, [1024]),
  set("showcase", "s-18.png", "s-18", 1254, null, [1024]),
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.find((a) => a === "avif" || a === "webp");

const sourceOf = (s) =>
  s.master === SHIPPED ? `${PUBLIC}${s.dir}/${s.name}.webp` : RAW + s.master;

/** Every file to write: [source, output, command, arguments]. */
const jobs = [];
for (const s of SETS) {
  const src = sourceOf(s);
  const base = `${PUBLIC}${s.dir}/${s.name}`;
  if (only !== "avif") {
    for (const w of s.webp) {
      const out = `${base}-w${w}.webp`;
      jobs.push(
        s.encoder === "magick"
          ? [
              src,
              out,
              "magick",
              [
                src,
                "-resize",
                `${w}x`,
                "-strip",
                "-quality",
                "80",
                "-define",
                "webp:method=6",
                out,
              ],
            ]
          : [src, out, "cwebp", ["-quiet", "-q", "82", "-resize", `${w}`, "0", src, "-o", out]],
      );
    }
  }
  if (only !== "webp" && s.avif) {
    for (const w of [...s.avif, s.full]) {
      const out = `${base}${w === s.full ? "" : `-w${w}`}.avif`;
      jobs.push([
        src,
        out,
        "magick",
        [
          src,
          "-resize",
          `${w}x`,
          "-strip",
          "-quality",
          AVIF_QUALITY,
          "-define",
          "heic:speed=4",
          out,
        ],
      ]);
    }
  }
}

// Check every source before writing anything, so a run never stops half way.
const missing = [...new Set(jobs.map(([src]) => src))].filter((src) => !existsSync(src));
if (missing.length > 0) throw new Error(`encode-avif: missing source\n  ${missing.join("\n  ")}`);

for (const [src, out, cmd, cmdArgs] of jobs) {
  const name = out.slice(PUBLIC.length);
  if (dryRun) {
    console.log(
      `${name}  <- ${src.startsWith(RAW) ? src.slice(RAW.length) : src.slice(PUBLIC.length)} (${cmd})`,
    );
    continue;
  }
  execFileSync(cmd, cmdArgs);
  console.log(`${name}  ${Math.round(statSync(out).size / 1024)} KB`);
}
console.log(`${dryRun ? "would write" : "wrote"} ${jobs.length} files`);
