import { ScrybeSite } from "./scrybe/ScrybeSite.js";
import { DappTheme } from "./theme/DappTheme.js";

/**
 * /scrybe. The x402 scenario in Scrybe's own palette (newsprint and a
 * highlighter stroke). Copy lives in packages/content; the page is in
 * sites/scrybe and Baret's shared demo pieces in sites/kit.
 */
export function Component() {
  return (
    <DappTheme name="scrybe">
      <ScrybeSite />
    </DappTheme>
  );
}
