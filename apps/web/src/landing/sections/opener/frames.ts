import type { Responsive } from "@baret/web-ui/components/Img";
import { IMG, type ImgAsset } from "../../../shared/assets.js";

/**
 * The three opener frames, in line order. Frame i illustrates
 * `home.opener.lines[i]`: the Confirm button, the inspector's desk, the
 * three tags. Every frame is one photo over the whole stage, painted on its
 * own `asset.ground` where it has one, so a contained picture letterboxes
 * without a seam and without a mask.
 */
export interface PictureFrame {
  readonly asset: ImgAsset;
  readonly fit: Responsive<"cover" | "contain">;
  readonly position: Responsive<string>;
  /**
   * Frame 0 is the LCP. The rest mount one step ahead of the reader, frame 1
   * only after the page load event (see Opener), so once mounted they load
   * at once.
   */
  readonly loading: "priority" | "eager";
  /**
   * A CSS background painted behind a contained picture, when one flat
   * `asset.ground` cannot match the print's edges. Wins over `asset.ground`.
   */
  readonly backdrop?: string;
  /**
   * Extra classes on the picture, for a zoom that object-position alone
   * cannot give (a cover crop that already spans the source width).
   */
  readonly zoom?: string;
}

export const FRAMES: readonly PictureFrame[] = [
  {
    // From lg up the cover crop spans the full source width, so
    // object-position cannot move the skyline off-frame. A 1.7x zoom pinned
    // to the right edge drops the crane and the tall towers, so the hero
    // plate (l-01) stays the page's only skyline and this frame reads as the
    // button alone.
    asset: IMG.l06,
    fit: "cover",
    position: { base: "80% 50%", md: "72% 35%", lg: "40% 35%" },
    zoom: "lg:scale-[1.7] lg:origin-[100%_37%]",
    loading: "priority",
  },
  {
    asset: IMG.l07,
    fit: "cover",
    position: { base: "12% 50%", md: "50% 70%", lg: "50% 100%" },
    loading: "eager",
  },
  {
    // Contained below lg, so all three tags stay in view. Covered from lg up,
    // so the wire runs edge to edge; 85% lifts the tags clear of the line.
    asset: IMG.l09,
    fit: { base: "contain", lg: "cover" },
    // 44% on phone evens the gaps above the print and between it and the line.
    position: { base: "50% 44%", lg: "50% 85%" },
    loading: "eager",
    // The print's edge rows run #10 to #1E; one flat #171717 sits in the
    // middle of that range, so the letterbox shows no seam and no gradient.
    backdrop: "#171717",
  },
];
