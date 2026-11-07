import { hub } from "@baret/content";
import { Difference } from "../hub/Difference.js";
import { HubHero } from "../hub/HubHero.js";
import { Scenarios } from "../hub/Scenarios.js";
import { Steps } from "../hub/Steps.js";
import { ClosingBand } from "../shared/ClosingBand.js";

/**
 * /showcase, the proving ground. Five blocks, each with one job (owner's
 * order, 2026-10-03): the claim and the numbers, the six sites with their
 * filter, how a check goes in four steps, the difference against a wallet
 * with no pre-sign check, and the way in. Every word comes from
 * hub.content.ts and each site's own scenario.
 */
export function Component() {
  const { cta } = hub;
  return (
    <div className="overflow-x-clip">
      <HubHero />
      <Scenarios />
      <Steps />
      <Difference />
      <ClosingBand
        title={cta.title}
        body={cta.body}
        primary={cta.actions.primary}
        secondary={cta.actions.secondary}
        keepBeats
      />
    </div>
  );
}
