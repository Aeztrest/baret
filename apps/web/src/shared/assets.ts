/**
 * Every showcase asset path, with its intrinsic size. The only file in the app
 * where an asset path is written.
 *
 * Paths never go into @baret/content: the route test treats every string that
 * starts with "/" as an href [SB 1.8]. Files live in apps/showcase/public and
 * are named by their canonical FILE name (ASSET_MAP_CANONICAL.md), never by the
 * prompt ids. `ground` is the paper colour sampled from an illustration's
 * edges; a well paints it behind the image so letterboxing shows no seam. The
 * asset shape and the srcset helpers live in @baret/web-ui (lib/img).
 */

import { avif, type ImgAsset, widths } from "@baret/web-ui/lib/img";

export type { ImgAsset } from "@baret/web-ui/lib/img";
export { PARTNER_LOGOS } from "../partners/logos.js";

/**
 * The `sizes` each route's LCP picture renders with. scripts/head.mjs writes
 * a preload for the same set and sizes into that route's HTML, so the browser
 * starts the one candidate it will use with the HTML, not after the scripts.
 */
export const LCP_SIZES = {
  home: "100vw",
  agents: "100vw",
  install: "(min-width: 1024px) 480px, 100vw",
  // The well sits inside the 16 px phone gutters: 100vw would ask a DPR 2
  // phone for the 1254 px original instead of the 768 px copy.
  docs: "(min-width: 1024px) 480px, calc(100vw - 32px)",
} as const;

export const IMG = {
  l01: {
    src: "/assets/landing/l-01.webp",
    width: 1536,
    height: 768,
    srcSet: widths("/assets/landing/l-01.webp", 1536, [768, 1024]),
    avifSrcSet: avif(widths("/assets/landing/l-01.webp", 1536, [768, 1024])),
  },
  l06: {
    src: "/assets/landing/l-06.webp",
    width: 1536,
    height: 1024,
    srcSet: widths("/assets/landing/l-06.webp", 1536, [768, 1024]),
    avifSrcSet: avif(widths("/assets/landing/l-06.webp", 1536, [768, 1024])),
  },
  l07: {
    src: "/assets/landing/l-07.webp",
    width: 1536,
    height: 1024,
    avifSrcSet: avif("/assets/landing/l-07.webp"),
  },
  l09: {
    src: "/assets/landing/l-09.webp",
    width: 1536,
    height: 1024,
    ground: "#121212",
    srcSet: widths("/assets/landing/l-09.webp", 1536, [768, 1024]),
    avifSrcSet: avif(widths("/assets/landing/l-09.webp", 1536, [768, 1024])),
  },
  /** Pillar 1, Pre-sign Guard: the site office (FILE l-12, chalk line art). */
  l12: {
    src: "/assets/landing/l-12.webp",
    width: 1312,
    height: 1199,
    ground: "#EBEAE4",
    srcSet: widths("/assets/landing/l-12.webp", 1312, [480, 768, 1024]),
  },
  /** Pillar 2, Authorization Ledger: the tag rack (FILE l-13, chalk line art). */
  l13: {
    src: "/assets/landing/l-13.webp",
    width: 1374,
    height: 1145,
    ground: "#DBD9D1",
    srcSet: widths("/assets/landing/l-13.webp", 1374, [480, 768]),
  },
  /** Pillar 3, Post-sign Monitor: the dark watchtower (FILE l-14, painted night). */
  l14: {
    src: "/assets/landing/l-14.webp",
    width: 1374,
    height: 1145,
    ground: "#221D3D",
    srcSet: widths("/assets/landing/l-14.webp", 1374, [480, 768]),
  },
  l21: {
    src: "/assets/landing/l-21.webp",
    width: 1254,
    height: 1254,
    ground: "#CAC4BA",
    srcSet: widths("/assets/landing/l-21.webp", 1254, [480, 768]),
  },
  l22: {
    src: "/assets/landing/l-22.webp",
    width: 1536,
    height: 1024,
    ground: "#CDC9C0",
    srcSet: widths("/assets/landing/l-22.webp", 1536, [480, 768]),
  },
  l23: {
    src: "/assets/landing/l-23.webp",
    width: 1254,
    height: 1254,
    ground: "#D6D2C8",
    srcSet: widths("/assets/landing/l-23.webp", 1254, [480, 768]),
  },
  l25: {
    src: "/assets/landing/l-25.webp",
    width: 1024,
    height: 1536,
    ground: "#EAE5D8",
    srcSet: widths("/assets/landing/l-25.webp", 1024, [480, 768]),
  },
  l26: {
    src: "/assets/landing/l-26.webp",
    width: 1254,
    height: 1254,
    ground: "#E8E5D6",
    srcSet: widths("/assets/landing/l-26.webp", 1254, [480, 768]),
  },
  l27: {
    src: "/assets/landing/l-27.webp",
    width: 1024,
    height: 1536,
    ground: "#EAE4D6",
    srcSet: widths("/assets/landing/l-27.webp", 1024, [480, 768]),
  },
} as const satisfies Record<string, ImgAsset>;

/**
 * The demo dApps' pictures, by site, under their canonical file names
 * (public/assets/showcase). Each site has a hero and the two versions
 * (NovaSwap's hero slot is its route picture). Checked one by one. The
 * ClaimHub danger picture (s-15) came with a green tag, the safe colour, on
 * the trap; its tag was recoloured to orange in place (only the green
 * pixels, from assets-raw/s-15.png) and the three copies re-encoded.
 */
export const SITE_ART = {
  novaswap: {
    routes: {
      src: "/assets/showcase/s-04.webp",
      width: 1536,
      height: 864,
      ground: "#A39D92",
      srcSet: widths("/assets/showcase/s-04.webp", 1536, [480, 768, 1024]),
    },
    safe: {
      src: "/assets/showcase/s-05.webp",
      width: 1536,
      height: 1024,
      ground: "#cfd0cb",
      srcSet: widths("/assets/showcase/s-05.webp", 1536, [480, 768, 1024]),
    },
    danger: {
      src: "/assets/showcase/s-06.webp",
      width: 1536,
      height: 953,
      ground: "#f4f1e7",
      srcSet: widths("/assets/showcase/s-06.webp", 1536, [480, 768, 1024]),
    },
  },
  scrybe: {
    hero: {
      src: "/assets/showcase/s-01.webp",
      width: 1536,
      height: 864,
      ground: "#080715",
      srcSet: widths("/assets/showcase/s-01.webp", 1536, [480, 768, 1024]),
    },
    safe: {
      src: "/assets/showcase/s-02.webp",
      width: 1536,
      height: 864,
      ground: "#1D1C1C",
      srcSet: widths("/assets/showcase/s-02.webp", 1536, [480, 768, 1024]),
    },
    danger: {
      src: "/assets/showcase/s-03.webp",
      width: 1536,
      height: 864,
      ground: "#161617",
      srcSet: widths("/assets/showcase/s-03.webp", 1536, [480, 768, 1024]),
    },
  },
  pixeldrop: {
    hero: {
      src: "/assets/showcase/s-07.webp",
      width: 1536,
      height: 864,
      ground: "#0D0B19",
      srcSet: widths("/assets/showcase/s-07.webp", 1536, [480, 768, 1024]),
    },
    safe: {
      src: "/assets/showcase/s-08.webp",
      width: 990,
      height: 1024,
      ground: "#463943",
      srcSet: widths("/assets/showcase/s-08.webp", 990, [480, 768]),
    },
    danger: {
      src: "/assets/showcase/s-09.webp",
      width: 1254,
      height: 1254,
      ground: "#CDCAC3",
      srcSet: widths("/assets/showcase/s-09.webp", 1254, [480, 768, 1024]),
    },
  },
  orbityield: {
    hero: {
      src: "/assets/showcase/s-10.webp",
      width: 1024,
      height: 1536,
      ground: "#CFCCC4",
      srcSet: widths("/assets/showcase/s-10.webp", 1024, [480, 768]),
    },
    safe: {
      src: "/assets/showcase/s-11.webp",
      width: 1024,
      height: 1536,
      ground: "#CFCCC3",
      srcSet: widths("/assets/showcase/s-11.webp", 1024, [480, 768]),
    },
    danger: {
      src: "/assets/showcase/s-12.webp",
      width: 1024,
      height: 1536,
      ground: "#D2CFC7",
      srcSet: widths("/assets/showcase/s-12.webp", 1024, [480, 768]),
    },
  },
  claimhub: {
    hero: {
      src: "/assets/showcase/s-13.webp",
      width: 1024,
      height: 1536,
      ground: "#28204A",
      srcSet: widths("/assets/showcase/s-13.webp", 1024, [480, 768]),
    },
    safe: {
      src: "/assets/showcase/s-14.webp",
      width: 1536,
      height: 1024,
      ground: "#E1DBD1",
      srcSet: widths("/assets/showcase/s-14.webp", 1536, [480, 768, 1024]),
    },
    danger: {
      src: "/assets/showcase/s-15.webp",
      width: 1254,
      height: 1254,
      ground: "#C8C5BD",
      srcSet: widths("/assets/showcase/s-15.webp", 1254, [480, 768, 1024]),
    },
  },
  launchpad: {
    hero: {
      src: "/assets/showcase/s-16.webp",
      width: 1024,
      height: 1536,
      ground: "#1F164F",
      srcSet: widths("/assets/showcase/s-16.webp", 1024, [480, 768]),
    },
    safe: {
      src: "/assets/showcase/s-17.webp",
      width: 1254,
      height: 1254,
      ground: "#CBC7BC",
      srcSet: widths("/assets/showcase/s-17.webp", 1254, [480, 768, 1024]),
    },
    danger: {
      src: "/assets/showcase/s-18.webp",
      width: 1254,
      height: 1254,
      ground: "#A3A19C",
      srcSet: widths("/assets/showcase/s-18.webp", 1254, [480, 768, 1024]),
    },
  },
} as const satisfies Record<string, Record<string, ImgAsset>>;

/**
 * /showcase, the hub. Every picture was opened and checked against its job.
 */
export const HUB_ART = {
  /** Six blank tags on a wire at a day site: six sites, one trap each (FILE h-01). */
  hero: {
    src: "/assets/showcase/h-01.webp",
    width: 1254,
    height: 1254,
    ground: "#C9C4BB",
    srcSet: widths("/assets/showcase/h-01.webp", 1254, [480, 768, 1024]),
  },
  /** A grid of squares with a few marked orange: many requests, a few flagged (FILE h-06). The filter's All six. */
  all: {
    src: "/assets/showcase/h-06.webp",
    width: 1536,
    height: 864,
    ground: "#FBFBF8",
    srcSet: widths("/assets/showcase/h-06.webp", 1536, [480, 768, 1024]),
  },
  /** Water running into a drain ringed in orange (FILE h-02). The filter's Drainers. */
  drainer: {
    src: "/assets/showcase/h-02.webp",
    width: 1254,
    height: 1254,
    ground: "#ABA497",
    srcSet: widths("/assets/showcase/h-02.webp", 1254, [480, 768, 1024]),
  },
  /** A tag beside a floor hatch (FILE h-03). The filter's Trust traps. */
  trap: {
    src: "/assets/showcase/h-03.webp",
    width: 1448,
    height: 1086,
    ground: "#A39C90",
    srcSet: widths("/assets/showcase/h-03.webp", 1448, [480, 768, 1024]),
  },
  /** A drum counter with an orange pointer (FILE h-04). The filter's Silent agents. */
  agent: {
    src: "/assets/showcase/h-04.webp",
    width: 1448,
    height: 1086,
    ground: "#A49E96",
    srcSet: widths("/assets/showcase/h-04.webp", 1448, [480, 768, 1024]),
  },
  /** Four line-art panels in one strip: plug, press, tag, frame (FILE h-05). Cropped one panel per step. */
  steps: { src: "/assets/showcase/h-05.webp", width: 1536, height: 864, ground: "#FCFAF8" },
  /** Two blank tags on black: two wallets, one request (FILE l-17, drawn for the landing comparison). */
  difference: {
    src: "/assets/landing/l-17.webp",
    width: 1536,
    height: 1024,
    ground: "#151415",
    srcSet: widths("/assets/landing/l-17.webp", 1536, [480, 768, 1024]),
  },
} as const satisfies Record<string, ImgAsset>;

/**
 * /docs. `cards` is keyed by the card's `file` in docs.content.ts, so a card
 * finds its picture without an index. The d-02 set was checked one by one.
 */
export const DOCS_ART = {
  /** A tower model on a drafting table, plans beside it (FILE l-33). */
  hero: {
    src: "/assets/landing/l-33.webp",
    width: 1254,
    height: 1254,
    ground: "#DFDCD2",
    srcSet: widths("/assets/landing/l-33.webp", 1254, [480, 768, 1024]),
  },
  /** Tags on a wire at a site, one fallen to the ground (FILE l-18). */
  limitations: {
    src: "/assets/landing/l-18.webp",
    width: 1536,
    height: 1024,
    ground: "#B0AAA4",
    srcSet: widths("/assets/landing/l-18.webp", 1536, [480, 768, 1024]),
  },
  /** A site office window at night: plans on the desk, the crane outside (FILE d-04). */
  cta: {
    src: "/assets/docs/d-04.webp",
    width: 1536,
    height: 1024,
    ground: "#150A0A",
    srcSet: widths("/assets/docs/d-04.webp", 1536, [768, 1024]),
  },
} as const satisfies Record<string, ImgAsset>;

/** The eleven docs cards' line drawings (FILE d-02a to d-02k), by card file. */
export const DOCS_CARD_ART: Readonly<Record<string, ImgAsset>> = {
  /** Vision: a hard hat from above. */
  "docs/PROJECT_OVERVIEW.md": {
    src: "/assets/docs/d-02a.webp",
    width: 1254,
    height: 1254,
    ground: "#F4F2EE",
    srcSet: widths("/assets/docs/d-02a.webp", 1254, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02a.webp", 1254, [480, 768, 1024])),
  },
  /** Architecture: a tower in section. */
  "docs/ARCHITECTURE.md": {
    src: "/assets/docs/d-02b.webp",
    width: 1024,
    height: 1536,
    ground: "#F3F2EE",
    srcSet: widths("/assets/docs/d-02b.webp", 1024, [480, 768]),
    avifSrcSet: avif(widths("/assets/docs/d-02b.webp", 1024, [480, 768])),
  },
  /** Wallet spec: a lockbox. */
  "docs/WALLET.md": {
    src: "/assets/docs/d-02c.webp",
    width: 1536,
    height: 1024,
    ground: "#EDEBE7",
    srcSet: widths("/assets/docs/d-02c.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02c.webp", 1536, [480, 768, 1024])),
  },
  /** Frontend content: a shopfront. */
  "docs/FRONTEND.md": {
    src: "/assets/docs/d-02d.webp",
    width: 1536,
    height: 1024,
    ground: "#EEECE8",
    srcSet: widths("/assets/docs/d-02d.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02d.webp", 1536, [480, 768, 1024])),
  },
  /** Contracts: a bolted plate. */
  "docs/CONTRACTS.md": {
    src: "/assets/docs/d-02e.webp",
    width: 1536,
    height: 1024,
    ground: "#EEECE8",
    srcSet: widths("/assets/docs/d-02e.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02e.webp", 1536, [480, 768, 1024])),
  },
  /** x402 payments: a parking meter. */
  "docs/X402_FACILITATOR.md": {
    src: "/assets/docs/d-02f.webp",
    width: 1536,
    height: 1024,
    ground: "#EFEDE9",
    srcSet: widths("/assets/docs/d-02f.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02f.webp", 1536, [480, 768, 1024])),
  },
  /** Resources: a toolbox. */
  "docs/RESOURCES.md": {
    src: "/assets/docs/d-02g.webp",
    width: 1536,
    height: 1024,
    ground: "#EEEDE9",
    srcSet: widths("/assets/docs/d-02g.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02g.webp", 1536, [480, 768, 1024])),
  },
  /** Bounties and tracks: a rosette. */
  "docs/BOUNTIES_AND_TRACKS.md": {
    src: "/assets/docs/d-02h.webp",
    width: 1024,
    height: 1536,
    ground: "#EEECE8",
    srcSet: widths("/assets/docs/d-02h.webp", 1024, [480, 768]),
    avifSrcSet: avif(widths("/assets/docs/d-02h.webp", 1024, [480, 768])),
  },
  /** Roadmap: a wall calendar. */
  "docs/ROADMAP.md": {
    src: "/assets/docs/d-02i.webp",
    width: 1536,
    height: 1024,
    ground: "#F0EEEA",
    srcSet: widths("/assets/docs/d-02i.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02i.webp", 1536, [480, 768, 1024])),
  },
  /** Decision log: a rubber stamp. */
  "docs/DECISIONS.md": {
    src: "/assets/docs/d-02j.webp",
    width: 1536,
    height: 1024,
    ground: "#EEECE8",
    srcSet: widths("/assets/docs/d-02j.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02j.webp", 1536, [480, 768, 1024])),
  },
  /** Brand: a swatch fan. */
  "docs/BRAND.md": {
    src: "/assets/docs/d-02k.webp",
    width: 1254,
    height: 1254,
    ground: "#EAE8E4",
    srcSet: widths("/assets/docs/d-02k.webp", 1254, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/docs/d-02k.webp", 1254, [480, 768, 1024])),
  },
};

/**
 * /install. `steps` follows the three steps in order: extract, open, load.
 */
export const INSTALL_ART = {
  /** A hard hat on a concrete block, a tag on its strap, a day site (FILE i-01). */
  hero: {
    src: "/assets/install/i-01.webp",
    width: 1536,
    height: 1024,
    ground: "#D6D7D8",
    srcSet: widths("/assets/install/i-01.webp", 1536, [768, 1024]),
    avifSrcSet: avif(widths("/assets/install/i-01.webp", 1536, [768, 1024])),
  },
  /** A crate opened on a hard hat: extract the zip (FILE i-03). */
  extract: {
    src: "/assets/install/i-03.webp",
    width: 1536,
    height: 1024,
    ground: "#E6E4E1",
    srcSet: widths("/assets/install/i-03.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/install/i-03.webp", 1536, [480, 768, 1024])),
  },
  /** A fence gate swung open: open the extensions page (FILE i-04). */
  open: {
    src: "/assets/install/i-04.webp",
    width: 1536,
    height: 1024,
    ground: "#E3E1DA",
    srcSet: widths("/assets/install/i-04.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/install/i-04.webp", 1536, [480, 768, 1024])),
  },
  /** A hand hanging a hard hat on a hook rail: load it and pin it (FILE i-05). */
  load: {
    src: "/assets/install/i-05.webp",
    width: 1536,
    height: 1024,
    ground: "#DEDACF",
    srcSet: widths("/assets/install/i-05.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/install/i-05.webp", 1536, [480, 768, 1024])),
  },
  /** Cutters taking a tag off its wire: when something goes wrong (FILE i-06). */
  help: {
    src: "/assets/install/i-06.webp",
    width: 1536,
    height: 1024,
    ground: "#6D6258",
    srcSet: widths("/assets/install/i-06.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/install/i-06.webp", 1536, [480, 768, 1024])),
  },
  /** A blank tag on black (FILE i-02). */
  cta: {
    src: "/assets/install/i-02.webp",
    width: 1536,
    height: 1024,
    ground: "#1C1C1B",
    srcSet: widths("/assets/install/i-02.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/install/i-02.webp", 1536, [480, 768, 1024])),
  },
} as const satisfies Record<string, ImgAsset>;

/**
 * /agents. The three layers in order: the check, the guarded signer, the vault.
 */
export const AGENTS_ART = {
  /** Robot carts with tags rolling across a night site: agents at work (FILE a-01). */
  hero: {
    src: "/assets/agents/a-01.webp",
    width: 1536,
    height: 1024,
    ground: "#2F275B",
    srcSet: widths("/assets/agents/a-01.webp", 1536, [768, 1024]),
    avifSrcSet: avif(widths("/assets/agents/a-01.webp", 1536, [768, 1024])),
  },
  /** A press drawn as a plan, a gauge on its line: measured before it acts (FILE a-05). */
  check: {
    src: "/assets/agents/a-05.webp",
    width: 1536,
    height: 1024,
    ground: "#F1F0EC",
    srcSet: widths("/assets/agents/a-05.webp", 1536, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/agents/a-05.webp", 1536, [480, 768, 1024])),
  },
  /** An open toolbox with a hard hat inside: the kit that wraps the signer (FILE a-02). */
  signer: {
    src: "/assets/agents/a-02.webp",
    width: 1254,
    height: 1254,
    ground: "#C9C6BC",
    srcSet: widths("/assets/agents/a-02.webp", 1254, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/agents/a-02.webp", 1254, [480, 768, 1024])),
  },
  /** A covered switch with a tag: caps and the kill switch (FILE a-04). */
  vault: {
    src: "/assets/agents/a-04.webp",
    width: 1254,
    height: 1254,
    ground: "#CFCBC3",
    srcSet: widths("/assets/agents/a-04.webp", 1254, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/agents/a-04.webp", 1254, [480, 768, 1024])),
  },
  /** A gloved hand picking one of three tags: pick a starting policy (FILE a-03). */
  policy: {
    src: "/assets/agents/a-03.webp",
    width: 1254,
    height: 1254,
    ground: "#C9C6BC",
    srcSet: widths("/assets/agents/a-03.webp", 1254, [480, 768, 1024]),
    avifSrcSet: avif(widths("/assets/agents/a-03.webp", 1254, [480, 768, 1024])),
  },
  /** A tag on a closed shutter: no answer, no signature (FILE a-06). */
  cta: {
    src: "/assets/agents/a-06.webp",
    width: 1024,
    height: 1536,
    ground: "#2D2D2D",
    srcSet: widths("/assets/agents/a-06.webp", 1024, [480, 768]),
    avifSrcSet: avif(widths("/assets/agents/a-06.webp", 1024, [480, 768])),
  },
} as const satisfies Record<string, ImgAsset>;

/**
 * The not-found page.
 */
export const NOT_FOUND_ART = {
  /** A site door tagged out (FILE l-29). */
  door: {
    src: "/assets/landing/l-29.webp",
    width: 1024,
    height: 1536,
    ground: "#D7D1C4",
    srcSet: widths("/assets/landing/l-29.webp", 1024, [480, 768]),
  },
} as const satisfies Record<string, ImgAsset>;

/** The brand pictures (FILE m-01 to m-12), shown on /kit. Marketing renders, not the logo: the logo is the vector Mark. */
export const BRAND_ART = {
  /** The mark in orange on chalk. */
  m01: {
    src: "/assets/brand/m-01.webp",
    width: 1536,
    height: 1024,
    ground: "#E5E5DE",
    srcSet: widths("/assets/brand/m-01.webp", 1536, [480]),
  },
  /** The mark in ink on orange. */
  m02: {
    src: "/assets/brand/m-02.webp",
    width: 1254,
    height: 1254,
    ground: "#FD5702",
    srcSet: widths("/assets/brand/m-02.webp", 1254, [480]),
  },
  /** The mark cut out of a steel plate. */
  m03: {
    src: "/assets/brand/m-03.webp",
    width: 1254,
    height: 1254,
    ground: "#31302E",
    srcSet: widths("/assets/brand/m-03.webp", 1254, [480]),
  },
  /** The mark as an enamel pin on a kraft tag. */
  m04: {
    src: "/assets/brand/m-04.webp",
    width: 1536,
    height: 1024,
    ground: "#4F4F4E",
    srcSet: widths("/assets/brand/m-04.webp", 1536, [480]),
  },
  /** The mark blind-embossed on a tag, on black. */
  m05: {
    src: "/assets/brand/m-05.webp",
    width: 1024,
    height: 1536,
    ground: "#181818",
    srcSet: widths("/assets/brand/m-05.webp", 1024, [480]),
  },
  /** The mark stencilled on concrete, barrier tape below. */
  m06: {
    src: "/assets/brand/m-06.webp",
    width: 1024,
    height: 1536,
    ground: "#A59F9A",
    srcSet: widths("/assets/brand/m-06.webp", 1024, [480]),
  },
  /** A crane lifting a crate with the mark, at night. */
  m07: {
    src: "/assets/brand/m-07.webp",
    width: 1024,
    height: 1536,
    ground: "#282357",
    srcSet: widths("/assets/brand/m-07.webp", 1024, [480]),
  },
  /** The mark as a cast object on concrete. */
  m08: {
    src: "/assets/brand/m-08.webp",
    width: 1536,
    height: 1024,
    ground: "#504D4C",
    srcSet: widths("/assets/brand/m-08.webp", 1536, [480]),
  },
  /** A real hard hat on a kraft tag. */
  m09: {
    src: "/assets/brand/m-09.webp",
    width: 1536,
    height: 1024,
    ground: "#9A9896",
    srcSet: widths("/assets/brand/m-09.webp", 1536, [480]),
  },
  /** The mark in orange on graphite. */
  m10: {
    src: "/assets/brand/m-10.webp",
    width: 1254,
    height: 1254,
    ground: "#151517",
    srcSet: widths("/assets/brand/m-10.webp", 1254, [480]),
  },
  /** The mark in ink on chalk. */
  m11: {
    src: "/assets/brand/m-11.webp",
    width: 1254,
    height: 1254,
    ground: "#F6F6F2",
    srcSet: widths("/assets/brand/m-11.webp", 1254, [480]),
  },
  /** The mark's construction, step by step. */
  m12: {
    src: "/assets/brand/m-12.webp",
    width: 1536,
    height: 512,
    ground: "#F1EFEA",
    srcSet: widths("/assets/brand/m-12.webp", 1536, [480]),
  },
} as const satisfies Record<string, ImgAsset>;

/** The social pictures (FILE x-01 to x-10), kept for posts and shown on /kit. Not the og:image: that is og.png, built to BRAND section 10. */
export const SOCIAL_ART = {
  /** A hard hat with a tag on a concrete block, day. */
  x01: {
    src: "/assets/social/x-01.webp",
    width: 1536,
    height: 1024,
    ground: "#C5C0BB",
    srcSet: widths("/assets/social/x-01.webp", 1536, [480]),
  },
  /** A blank tag on dark concrete. */
  x02: {
    src: "/assets/social/x-02.webp",
    width: 1024,
    height: 1536,
    ground: "#242322",
    srcSet: widths("/assets/social/x-02.webp", 1024, [480]),
  },
  /** Concrete slab, close. */
  x03: {
    src: "/assets/social/x-03.webp",
    width: 1536,
    height: 1024,
    ground: "#A89F94",
    srcSet: widths("/assets/social/x-03.webp", 1536, [480]),
  },
  /** Concrete wall with an orange bar at the foot: a share-card ground. */
  x04: {
    src: "/assets/social/x-04.webp",
    width: 1536,
    height: 1024,
    ground: "#AFA89F",
    srcSet: widths("/assets/social/x-04.webp", 1536, [480]),
  },
  /** A night skyline with a crane. */
  x05: {
    src: "/assets/social/x-05.webp",
    width: 1536,
    height: 865,
    ground: "#0F0C18",
    srcSet: widths("/assets/social/x-05.webp", 1536, [480]),
  },
  /** A hard-hat icon on orange (not the Baret mark's geometry). */
  x06: {
    src: "/assets/social/x-06.webp",
    width: 1254,
    height: 1254,
    ground: "#FD5002",
    srcSet: widths("/assets/social/x-06.webp", 1254, [480]),
  },
  /** The city at night from above. */
  x07: {
    src: "/assets/social/x-07.webp",
    width: 1536,
    height: 1024,
    ground: "#130F29",
    srcSet: widths("/assets/social/x-07.webp", 1536, [480]),
  },
  /** A hard hat with a tag on a roof edge, day. */
  x08: {
    src: "/assets/social/x-08.webp",
    width: 1536,
    height: 1024,
    ground: "#CAC7C6",
    srcSet: widths("/assets/social/x-08.webp", 1536, [480]),
  },
  /** A blueprint grid, one orange dash. */
  x09: {
    src: "/assets/social/x-09.webp",
    width: 1536,
    height: 1024,
    ground: "#F3F1EC",
    srcSet: widths("/assets/social/x-09.webp", 1536, [480]),
  },
  /** A sticker sheet: marks and tags. */
  x10: {
    src: "/assets/social/x-10.webp",
    width: 1536,
    height: 1024,
    ground: "#302C29",
    srcSet: widths("/assets/social/x-10.webp", 1536, [480]),
  },
} as const satisfies Record<string, ImgAsset>;

/** The brand clip: a blank tag drops in front of a site gate (10 s, no text in frame). On /kit, with controls, never autoplaying. */
export const BRAND_CLIP = { src: "/assets/video/v-01.webm", width: 1280, height: 576 } as const;
