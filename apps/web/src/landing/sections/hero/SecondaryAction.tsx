import { LinkButton } from "@baret/web-ui/components/LinkButton";
import type { JSX } from "react";

/**
 * The secondary action, with a shorter label below 768 px (same link). The
 * hidden copy is display:none, so only one link is ever in the tab order and
 * the accessibility tree. A link to another site opens in a new tab; a page
 * of this site opens in place.
 */
export function SecondaryAction({
  action,
}: {
  action: { label: string; labelPhone: string; href: string };
}): JSX.Element {
  const newTab = action.href.startsWith("http");
  return (
    <>
      <span className="contents md:hidden">
        <LinkButton
          href={action.href}
          label={action.labelPhone}
          variant="ghostInverse"
          size="lg"
          fullOnPhone
          newTab={newTab}
        />
      </span>
      <span className="contents max-md:hidden">
        <LinkButton
          href={action.href}
          label={action.label}
          variant="ghostInverse"
          size="lg"
          newTab={newTab}
        />
      </span>
    </>
  );
}
