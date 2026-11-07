import { common } from "@baret/content";
import { ImgWell } from "@baret/web-ui/components/Img";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { routes } from "../routes.js";
import { NOT_FOUND_ART } from "../shared/assets.js";
import { PageHero } from "../shared/PageHero.js";

/**
 * The 404, in the landing's grammar: what happened in one stencil line, one
 * sentence, and the two ways back (the start, and the showcase most people
 * came for). A site door tagged out stands beside it. Reassuring, never
 * apologetic (BRAND section 09). RootLayout marks the page noindex.
 */
export function Component() {
  const { notFound, actions } = common;
  return (
    <div className="overflow-x-clip">
      <PageHero
        id="not-found"
        title={notFound.title}
        body={notFound.body}
        actions={
          <>
            <LinkButton
              href={notFound.back.href}
              newTab
              label={notFound.back.label}
              variant="primary"
              size="lg"
              icon="arrow-right"
              fullOnPhone
            />
            <LinkButton
              href={routes.showcase.path}
              newTab
              label={actions.openShowcase}
              size="lg"
              fullOnPhone
            />
          </>
        }
        picture={
          <ImgWell
            asset={NOT_FOUND_ART.door}
            ratio="4/5"
            dim
            sizes="(min-width: 1024px) 480px, 100vw"
            className="mx-auto max-w-[420px] border border-[color:var(--rule)] lg:max-w-none"
          />
        }
      />
    </div>
  );
}
