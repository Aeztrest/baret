import { ClaimHubSite } from "./claimhub/ClaimHubSite.js";
import { DappTheme } from "./theme/DappTheme.js";

/**
 * /claimhub. The airdrop scenario in ClaimHub's own palette (parcel kraft
 * and an ink stamp). Copy lives in packages/content; the page is in
 * sites/claimhub and Baret's shared demo pieces in sites/kit.
 */
export function Component() {
  return (
    <DappTheme name="claimhub">
      <ClaimHubSite />
    </DappTheme>
  );
}
