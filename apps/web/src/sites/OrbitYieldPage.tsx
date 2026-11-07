import { OrbitYieldSite } from "./orbityield/OrbitYieldSite.js";
import { DappTheme } from "./theme/DappTheme.js";

/**
 * /orbityield. The staking scenario in OrbitYield's own palette (observatory
 * sage and a long-exposure lime). Copy lives in packages/content; the page is
 * in sites/orbityield and Baret's shared demo pieces in sites/kit.
 */
export function Component() {
  return (
    <DappTheme name="orbityield">
      <OrbitYieldSite />
    </DappTheme>
  );
}
