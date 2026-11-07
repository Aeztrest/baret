import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RevealWords, revealLabel, TextReveal } from "./TextReveal.js";

/**
 * K6: every reader gets the heading text exactly once. The moving words are
 * the only copy, so the static HTML, textContent and the accessible name all
 * read the sentence once, with real spaces between the words.
 */
describe("TextReveal text appears once", () => {
  const one = "Check it first. Then sign.";
  const two = ["Check it first.", "Then sign."] as const;

  it("has the sentence once in textContent and as the heading name", () => {
    render(<TextReveal as="h1" text={one} keepBeats immediate />);
    const h = screen.getByRole("heading", { level: 1, name: one });
    expect(h.textContent).toBe(one);
  });

  it("joins forced lines with a space, once", () => {
    render(<TextReveal text={two} />);
    const h = screen.getByRole("heading", { level: 2, name: revealLabel(two) });
    expect(h.textContent).toBe("Check it first. Then sign.");
  });

  it("keeps a cased token in the single copy", () => {
    render(<TextReveal text="Pay over x402." keepCase={["x402"]} />);
    expect(screen.getByRole("heading").textContent).toBe("Pay over x402.");
  });

  it("hides nothing from assistive tech and adds no hidden copy", () => {
    const html = renderToStaticMarkup(<TextReveal as="h1" text={one} immediate />);
    expect(html).not.toContain("aria-hidden");
    expect(html).not.toContain("sr-only");
    const words = html.replace(/<[^>]+>/g, "");
    expect(words).toBe(one);
  });

  it("renders bare words inside a list item once", () => {
    render(
      <ul>
        <li>
          <RevealWords text="Your agent pays inside a limit." show={false} />
        </li>
      </ul>,
    );
    expect(screen.getByRole("listitem").textContent).toBe("Your agent pays inside a limit.");
  });
});
