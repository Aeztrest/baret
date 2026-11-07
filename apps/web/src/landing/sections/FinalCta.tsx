import { home } from "@baret/content";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { TextReveal } from "@baret/web-ui/components/TextReveal";
import { T } from "@baret/web-ui/lib/type";
import { Fragment, type JSX } from "react";
import { titleId } from "../../shared/ids.js";
import { SectionFrame } from "../../shared/SectionFrame.js";
import { SecondaryAction } from "./hero/SecondaryAction.js";

const { cta } = home;

/**
 * Closing: one centred column on graphite in both themes, mirroring the
 * hero, so the page opens and closes on the same ground. The stencil title
 * is the page's second and last; the filled button is the page's last.
 * `band="dark"` tells the site header to turn graphite over it. In dark
 * theme the band is lifted to a lighter graphite (#24252a) so it stands
 * apart from the section above, and the top rule reinforces where the
 * closing band starts; light theme needs none.
 *
 * Motion: only the title's words rise out of their masks (TextReveal). The
 * body, actions and trust line never wait for an animation. Reduced motion:
 * static.
 *
 * The trust line is a row of short facts split by a middle dot; a fact
 * links only where it has a real destination (cta.facts).
 */
/** Widened so a fact may carry a link; none does today. */
const FACTS: readonly { readonly label: string; readonly href?: string }[] = cta.facts;

function TrustLine(): JSX.Element {
  return (
    <p className="mt-5 text-sm text-chalk/70">
      {FACTS.map((fact, i) => (
        <Fragment key={fact.label}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          {fact.href ? (
            <a
              href={fact.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-chalk/40 underline-offset-4 transition-colors duration-150 hover:text-chalk hover:decoration-chalk"
            >
              {fact.label}
            </a>
          ) : (
            <span>{fact.label}</span>
          )}
        </Fragment>
      ))}
    </p>
  );
}

export function FinalCtaSection(): JSX.Element {
  return (
    <SectionFrame
      sectionKey="cta"
      ground="band"
      band="dark"
      className="dark:border-t dark:border-[color:var(--rule-strong)]"
    >
      <div className="mx-auto max-w-[40rem] text-center">
        <TextReveal
          id={titleId("cta")}
          className={`${T.h2Stencil} text-balance text-chalk max-[379px]:text-[2.5rem]`}
          text={cta.title}
        />
        <p className="mt-8 text-base leading-normal font-medium text-chalk/80 md:mt-10 md:text-lg">
          {cta.body}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton
            href={cta.actions.primary.href}
            label={cta.actions.primary.label}
            variant="primary"
            size="lg"
            icon="arrow-right"
            fullOnPhone
            newTab
          />
          <SecondaryAction action={cta.actions.secondary} />
        </div>
        <TrustLine />
      </div>
    </SectionFrame>
  );
}
