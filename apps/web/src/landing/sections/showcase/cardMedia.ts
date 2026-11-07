import { IMG, type ImgAsset } from "../../../shared/assets.js";

/**
 * The illustration for each showcase card, keyed by the card's href. The keys
 * become `routes.<site>.path` as the demo sites land (TASKS.md T2.4).
 *
 * One crop rule for all six: every print fills its well (`cover`) at one
 * aspect ratio, and a per-asset focal point keeps the subject at the same
 * share of the frame. The isometric scenes (Scrybe, NovaSwap, PixelDrop)
 * and the paper objects (OrbitYield, ClaimHub, LaunchPad) then read as one
 * set, with no letterbox and no seam.
 */

/** The paper colour a well shows while its print loads. */
export const WELL_GROUND = "#E9E4D6";

export interface CardMedia {
  readonly asset: ImgAsset;
  /** object-position for the cover crop. */
  readonly position: string;
}

export const CARD_MEDIA: Readonly<Record<string, CardMedia>> = {
  "/scrybe": { asset: IMG.l21, position: "30% 60%" },
  "/novaswap": { asset: IMG.l22, position: "50% 50%" },
  "/pixeldrop": { asset: IMG.l23, position: "60% 66%" },
  "/orbityield": { asset: IMG.l25, position: "50% 40%" },
  "/claimhub": { asset: IMG.l26, position: "50% 20%" },
  "/launchpad": { asset: IMG.l27, position: "50% 40%" },
};
