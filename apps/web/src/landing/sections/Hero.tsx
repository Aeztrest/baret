import { home } from "@baret/content";
import { Img } from "@baret/web-ui/components/Img";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { Parallax } from "@baret/web-ui/components/Parallax";
import { TextReveal } from "@baret/web-ui/components/TextReveal";
import { FRAME, GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import { useInView } from "motion/react";
import { type JSX, useRef } from "react";
import { IMG } from "../../shared/assets.js";
import { IDS, titleId } from "../../shared/ids.js";
import { splitLead } from "../../shared/SectionHeader.js";
import { ScanLine } from "../../shared/webgl/ScanLine.js";
import { SkylineCanvas } from "../../shared/webgl/SkylineCanvas.js";
import { SecondaryAction } from "./hero/SecondaryAction.js";

/** Splits copy after each full stop, so every sentence of the H1 is its own line. */
function sentences(text: string): string[] {
  return text.split(/(?<=\.)\s+/).filter(Boolean);
}

/**
 * From 1440 px the photo is already scaled 1.2x for the layout, so the
 * drift overscan and the settle shrink there. l-01 is only 1536 px wide:
 * at 1920 the cover fit alone is 1.33x, so the motion's share of the
 * upscale drops from 1.11x to 1.07x; a 2560 px source is the real cure.
 */
const WIDE_DRIFT = { amount: 0.025, settle: 0.02 } as const;

/**
 * The H1 reveal waits until the headline's top has climbed past 65 % of the
 * viewport, so it plays in the upper half instead of at the bottom edge
 * while the opener's last caption is still leaving. Section headers keep
 * VIEWPORT_ONCE.
 */
const HERO_VIEWPORT = { once: true, margin: "0px 0px -35% 0px" } as const;

/**
 * The hero: one photo, one copy column, one action row. No plate, no card.
 *
 * From 1024 px the night skyline (l-01) fills the section and the copy sits
 * straight on its empty sky in columns 1 to 7, centred vertically. No eyebrow pill: the network status
 * lives in the closing note. From 1440 px the photo is scaled 1.2x from
 * its lower right corner, so the towers fill the right 55 % and sit close to
 * the copy instead of leaving an empty half. The skyline starts right of
 * column 6 at every width from 1024 to 1920. Distant window lights behind
 * the body drop single pixels to 3.6:1 at 1024 and 1280, so one flat 35 %
 * graphite veil covers the whole photo. No gradient scrim: measured on the
 * static frame, the flat veil alone keeps the body (chalk at 80 %) at a worst
 * pixel of 6.8:1 at 1440 and 7.7:1 or more at 1024, 1280 and 1920, above the
 * old 30 % veil plus left-hand ramp at every width.
 * Below 1024 px the photo is a band on top (280 px, 360 px from 768) with no
 * text on it, and the copy follows on plain graphite. The copy column is a
 * size container and the H1 is sized in cqi (T.h1), so it grows with its
 * column and never jumps at a breakpoint.
 *
 * Motion (none under reduced motion): from 768 px the photo drifts 3.5 %
 * each way against the scroll and settles from 1.04x (2.5 % and 1.02x from
 * 1440 px; the phone band stays still, web-ui Parallax), and a WebGL2 layer
 * repeats it pixel for pixel with a static paper grain and a few pixels of
 * lean toward the pointer (shared/webgl). On phones and coarse pointers the
 * canvas only carries the scan pass, then fades back to the native img. One orange scan pass runs once the hero is three quarters
 * in view, the H1 has landed and the scroll is at rest; from 1024 px it
 * starts right of the copy and crosses only the skyline. Its rule
 * (ScanLine) sits above the veil, so it reads as true International Orange;
 * for its 1.7 s it is accepted as a second orange beside the primary action.
 * The <img> stays underneath as the LCP and the fallback.
 *
 * The H1 reveals word by word once its top passes 65 % of the viewport
 * (HERO_VIEWPORT; web-ui TextReveal in controlled mode, one sentence per
 * line). Not on mount: the hero sits under the opener loop, so a
 * mount-time reveal would play unseen. The body and actions never wait for
 * an animation: they are plain text from the first paint. The body's first
 * sentence is set in chalk, the rest at 80 %. The hero photo is lazy: the
 * hero is never in the first viewport, so it never competes with the LCP.
 * Reduced motion: plain text.
 *
 * The 56px in min-h is the header height, owned by
 * HEADER_OFFSET in @baret/web-ui lib/layout.ts.
 */
export function HeroSection(): JSX.Element {
  const { actions } = home.hero;
  const [lead, rest] = splitLead(home.hero.body);
  const copy = useRef<HTMLDivElement>(null);
  const inView = useInView(copy, HERO_VIEWPORT);
  return (
    <section
      id={IDS.hero}
      data-band="dark"
      aria-labelledby={titleId("hero")}
      className="relative flex flex-col bg-graphite text-chalk lg:min-h-[max(720px,calc(100svh-56px))] lg:justify-center"
    >
      <div className="relative h-[280px] overflow-hidden md:h-[360px] lg:absolute lg:inset-0 lg:h-auto">
        <Parallax amount={0.035} settle={0.04} wide={WIDE_DRIFT}>
          <div className="relative size-full origin-[100%_85%] min-[1440px]:scale-[1.2]">
            <Img asset={IMG.l01} loading="lazy" position={{ base: "88% 60%", lg: "75% 60%" }} />
            <SkylineCanvas />
          </div>
        </Parallax>
        <span aria-hidden="true" className="absolute inset-0 hidden bg-graphite/35 lg:block" />
        <ScanLine />
      </div>

      <div className={`${FRAME} relative w-full`}>
        <div className={`${GRID} pt-10 pb-12 md:pt-12 md:pb-16 lg:py-24`}>
          <div ref={copy} className="@container col-span-4 md:col-span-8 lg:col-span-7">
            <TextReveal
              as="h1"
              id={titleId("hero")}
              className={`${T.h1} text-chalk`}
              text={sentences(home.hero.title)}
              show={inView}
            />
            <p className="mt-8 max-w-[44ch] text-lg leading-normal text-chalk/80 md:text-xl">
              <span className="text-chalk">{lead}</span> {rest}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <LinkButton
                href={actions.primary.href}
                label={actions.primary.label}
                variant="primary"
                size="lg"
                icon="arrow-right"
                fullOnPhone
                newTab
              />
              <SecondaryAction action={actions.secondary} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
