import { NovaSwapSite } from "./novaswap/NovaSwapSite.js";
import { DappTheme } from "./theme/DappTheme.js";

/**
 * /novaswap. Threat demo in NovaSwap's own palette (cobalt on steel). Copy
 * lives in packages/content; the page is in sites/novaswap and Baret's
 * shared demo pieces (the strip and the panel) in sites/kit.
 */
export function Component() {
  return (
    <DappTheme name="novaswap">
      <NovaSwapSite />
    </DappTheme>
  );
}
