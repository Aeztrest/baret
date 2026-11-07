import { LaunchPadSite } from "./launchpad/LaunchPadSite.js";
import { DappTheme } from "./theme/DappTheme.js";

/**
 * /launchpad. The token sale scenario in LaunchPad's own palette (plum,
 * away from NovaSwap's cobalt). Copy lives in packages/content; the page is
 * in sites/launchpad and Baret's shared demo pieces in sites/kit.
 */
export function Component() {
  return (
    <DappTheme name="launchpad">
      <LaunchPadSite />
    </DappTheme>
  );
}
