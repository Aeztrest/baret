import { PixelDropSite } from "./pixeldrop/PixelDropSite.js";
import { DappTheme } from "./theme/DappTheme.js";

/**
 * /pixeldrop. The mint scenario in PixelDrop's own palette (risograph card
 * stock and fluorescent ink). Copy lives in packages/content; the page is in
 * sites/pixeldrop and Baret's shared demo pieces in sites/kit.
 */
export function Component() {
  return (
    <DappTheme name="pixeldrop">
      <PixelDropSite />
    </DappTheme>
  );
}
