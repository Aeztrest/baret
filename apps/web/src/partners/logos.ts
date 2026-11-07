/**
 * The partners' own marks, by the `id` in partners.content.ts. Files live in
 * public/assets/partners/. Sources (2026-10-13):
 *  - monad: the logomark inlined on monad.xyz
 *  - mera: the "mera" wordmark from mera.category.xyz (its og image and site
 *    title), outlined in the site's Satoshi Medium; the favicon is only a
 *    generic serif letter
 *  - alchemy: media.alchemy.com, the mark from alchemy.com
 *  - dynamic: the icon from dynamic.xyz
 *  - cleanverse: cleanverse.com/favicon/logo.svg
 *  - chainlink: simple-icons, in Chainlink blue
 *  - kimi, qwen: the LobeHub AI icon set (the brands' marks)
 *  - envio, nansen, scamsniffer: each company's GitHub organisation avatar
 *
 * `bleed` marks a raster avatar that carries its own background and fills
 * the tile; a vector mark sits padded on the white plate instead.
 */
export interface PartnerLogo {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly bleed?: boolean;
}

const svg = (name: string): PartnerLogo => ({
  src: `/assets/partners/${name}.svg`,
  width: 96,
  height: 96,
});

export const PARTNER_LOGOS: Readonly<Record<string, PartnerLogo>> = {
  monad: svg("monad"),
  mera: svg("mera"),
  alchemy: svg("alchemy"),
  envio: { src: "/assets/partners/envio.png", width: 256, height: 256, bleed: true },
  nansen: { src: "/assets/partners/nansen.png", width: 256, height: 256, bleed: true },
  chainlink: svg("chainlink"),
  scamsniffer: { src: "/assets/partners/scamsniffer.jpg", width: 256, height: 256, bleed: true },
  cleanverse: svg("cleanverse"),
  dynamic: svg("dynamic"),
  kimi: svg("kimi"),
  qwen: svg("qwen"),
};
