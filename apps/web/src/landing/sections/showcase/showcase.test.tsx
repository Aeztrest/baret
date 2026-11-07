import { check, common, home } from "@baret/content";
import type { JSX } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { ShowcaseCard, type ShowcaseCardData } from "./ShowcaseCard.js";

const { cards, labels } = home.showcase;

/** Renders one item inside a router and returns it as a DOM tree. */
function mount(element: JSX.Element): HTMLElement {
  const router = createMemoryRouter([{ path: "/", element }]);
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<RouterProvider router={router} />);
  return host;
}

const SHAPES: ReadonlyArray<[string, (card: ShowcaseCardData) => JSX.Element]> = [
  ["card", (card) => <ShowcaseCard card={card} />],
];

describe.each(SHAPES)("showcase %s", (_shape, render) => {
  it("renders six sites, each with exactly one anchor named after the site", () => {
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      const anchors = mount(render(card)).querySelectorAll("a");
      expect(anchors).toHaveLength(1);
      expect(anchors[0]?.getAttribute("href")).toBe(card.href);
      expect(anchors[0]?.textContent).toBe(card.name);
      expect(anchors[0]?.hasAttribute("aria-label")).toBe(false);
      expect(anchors[0]?.getAttribute("target")).toBe("_blank");
      expect(anchors[0]?.getAttribute("rel")).toContain("noopener");
    }
  });

  it("labels the verdict for screen readers before the tag text", () => {
    for (const card of cards) {
      const host = mount(render(card));
      const sr = host.querySelector(".sr-only");
      expect(sr?.textContent?.trim()).toBe(labels.verdict);
      const text = host.textContent ?? "";
      const verdict = home.showcase.verdicts[card.verdict];
      expect(text.indexOf(labels.verdict)).toBeLessThan(text.indexOf(verdict));
    }
  });

  it("keeps the card's verdict words the same as the shared ones", () => {
    const { safe, caution, blocked, unreachable } = common.verdicts;
    expect(home.showcase.verdicts).toEqual({
      safe: safe.label,
      caution: caution.label,
      blocked: blocked.label,
      unreachable: unreachable.label,
      capped: check.capped,
    });
  });

  it("shows Scrybe as blocked at the cap", () => {
    const scrybe = cards.find((c) => c.name === "Scrybe");
    expect(scrybe).toBeDefined();
    if (scrybe) expect(mount(render(scrybe)).textContent).toContain("Blocked at the cap");
  });
});

describe("showcase card", () => {
  it("shows a visible open cue that stays out of the accessible name", () => {
    for (const card of cards) {
      const host = mount(<ShowcaseCard card={card} />);
      expect(host.textContent).toContain(labels.open);
      expect(host.querySelectorAll("a")).toHaveLength(1);
      expect(host.querySelector("a")?.textContent).toBe(card.name);
      for (const svg of host.querySelectorAll("svg")) {
        expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
      }
    }
  });
});
