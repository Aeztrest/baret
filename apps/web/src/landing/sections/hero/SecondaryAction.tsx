import { LinkButton } from "@baret/web-ui/components/LinkButton";
import type { JSX } from "react";

/**
 * The secondary action, "Install the extension". Below 768 px it reads
 * "Install on desktop" (same link), because the steps cannot be done on a
 * phone. The hidden copy is display:none, so only one link is ever in the
 * tab order and the accessibility tree. It opens in a new tab.
 */
export function SecondaryAction({
  action,
}: {
  action: { label: string; labelPhone: string; href: string };
}): JSX.Element {
  return (
    <>
      <span className="contents md:hidden">
        <LinkButton
          href={action.href}
          label={action.labelPhone}
          variant="ghostInverse"
          size="lg"
          fullOnPhone
          newTab
        />
      </span>
      <span className="contents max-md:hidden">
        <LinkButton
          href={action.href}
          label={action.label}
          variant="ghostInverse"
          size="lg"
          newTab
        />
      </span>
    </>
  );
}
