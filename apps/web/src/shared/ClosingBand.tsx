import { Img } from "@baret/web-ui/components/Img";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { Parallax } from "@baret/web-ui/components/Parallax";
import { titleIdOf } from "@baret/web-ui/components/Section";
import { TextReveal } from "@baret/web-ui/components/TextReveal";
import type { ImgAsset } from "@baret/web-ui/lib/img";
import { FRAME, GRID } from "@baret/web-ui/lib/layout";
import { T } from "@baret/web-ui/lib/type";
import type { JSX } from "react";

/**
 * The closing band of an inner marketing page: graphite in both themes
 * (`data-band="dark"`, so the site header turns graphite over it), the
 * page's second stencil title, one paragraph, the primary action (the page's
 * last orange) and a ghost one.
 *
 * Without a picture it is centred like the landing's closing. With one, it
 * splits: the copy on the left, a dark photo on the right that drifts a
 * little with the scroll (Parallax, none under reduced motion); below 1024 px
 * the photo is a band above the copy.
 */

type Action = { readonly label: string; readonly href: string };

export function ClosingBand({
  id = "start",
  title,
  body,
  primary,
  secondary,
  picture,
  keepBeats = false,
}: {
  id?: string;
  title: string;
  body: string;
  primary: Action;
  secondary: Action;
  /** A dark photo; leave it out for the centred form. */
  picture?: { asset: ImgAsset; position?: string };
  keepBeats?: boolean;
}): JSX.Element {
  const heading = (
    <TextReveal
      id={titleIdOf(id)}
      className={`${T.h2Stencil} text-balance text-chalk max-[379px]:text-[2.5rem]`}
      text={title}
      keepBeats={keepBeats}
    />
  );
  const actions = (
    <>
      <LinkButton
        href={primary.href}
        label={primary.label}
        variant="primary"
        size="lg"
        icon="arrow-right"
        fullOnPhone
        newTab={!primary.href.startsWith("#")}
      />
      <LinkButton
        href={secondary.href}
        label={secondary.label}
        variant="ghostInverse"
        size="lg"
        fullOnPhone
        newTab={!secondary.href.startsWith("#")}
      />
    </>
  );
  return (
    <section
      id={id}
      aria-labelledby={titleIdOf(id)}
      data-band="dark"
      className="relative bg-graphite text-chalk dark:border-t dark:border-[color:var(--rule-strong)] dark:bg-[#24252a]"
    >
      {picture ? (
        <div className={`${FRAME} lg:py-24`}>
          <div className={`${GRID} gap-y-0 lg:items-center`}>
            <div className="relative col-span-4 -mx-4 h-[240px] overflow-hidden md:col-span-8 md:-mx-8 md:h-[320px] lg:order-last lg:col-span-5 lg:col-start-8 lg:mx-0 lg:aspect-[4/5] lg:h-auto">
              <Parallax amount={0.03}>
                <Img
                  asset={picture.asset}
                  sizes="(min-width: 1024px) 480px, 100vw"
                  {...(picture.position ? { position: picture.position } : {})}
                  className="absolute inset-0 size-full"
                />
              </Parallax>
            </div>
            <div className="col-span-4 py-12 md:col-span-8 md:py-16 lg:col-span-6 lg:py-0">
              {heading}
              <p className="mt-8 max-w-[44ch] text-base leading-normal font-medium text-chalk/80 md:text-lg">
                {body}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`${FRAME} py-12 md:py-16 lg:py-24`}>
          <div className="mx-auto max-w-[40rem] text-center">
            {heading}
            <p className="mt-8 text-base leading-normal font-medium text-chalk/80 md:mt-10 md:text-lg">
              {body}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
          </div>
        </div>
      )}
    </section>
  );
}
