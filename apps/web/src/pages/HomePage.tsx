import { AgentsSection } from "../landing/sections/Agents.js";
import { FinalCtaSection } from "../landing/sections/FinalCta.js";
import { HeroSection } from "../landing/sections/Hero.js";
import { MarqueeSection } from "../landing/sections/Marquee.js";
import { OpenerSection } from "../landing/sections/Opener.js";
import { PillarsSection } from "../landing/sections/Pillars.js";
import { ShowcaseSection } from "../landing/sections/Showcase.js";
import { VerdictsSection } from "../landing/sections/Verdicts.js";

/**
 * The landing page. Every string comes from @baret/content and every section
 * lives in its own file under landing/sections, in scroll order: opener,
 * hero, checks, how it works, six dApps, verdicts, agents, closing.
 *
 * No <title> or description here: RootLayout renders the one of each for
 * every route. The motion provider and the signature layer (Lenis and the
 * eyelet cursor) are mounted once for every route in RootLayout.
 */
export function Component() {
  return (
    <div className="overflow-x-clip">
      {/* Seam: no spacer. The opener's last photo hands straight to the hero photo. */}
      <OpenerSection />
      <HeroSection />
      <MarqueeSection />
      <PillarsSection />
      <ShowcaseSection />
      <VerdictsSection />
      <AgentsSection />
      <FinalCtaSection />
    </div>
  );
}
