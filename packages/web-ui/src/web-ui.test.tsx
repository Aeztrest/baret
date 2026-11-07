import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { asVerdict, FindingList } from "./components/CheckBlocks.js";
import { CopyButton } from "./components/CopyButton.js";
import { Disclosures } from "./components/Disclosures.js";
import { LinkButton } from "./components/LinkButton.js";
import { Reveal } from "./components/Reveal.js";
import { titleIdOf } from "./components/Section.js";
import { splitLead } from "./components/SectionHeader.js";
import { avif } from "./lib/img.js";
import { staggerDelay } from "./lib/motion.js";
import { VERDICT_TONE } from "./lib/tone.js";
import { counted, fill } from "./lib/util.js";

describe("web-ui helpers", () => {
  it("caps the stagger at five steps", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(2)).toBe(0.12);
    expect(staggerDelay(9)).toBe(0.3);
  });

  it("maps the capped verdict to the blocked tone", () => {
    expect(VERDICT_TONE.capped).toBe("blocked");
  });

  it("derives a section's heading id from its anchor", () => {
    expect(titleIdOf("agents")).toBe("agents-title");
  });

  it("fills a finding's title as well as its sentence", () => {
    const html = renderToStaticMarkup(
      <FindingList
        items={[
          { code: "POST_BALANCE_TOO_LOW", values: { actual: "0", limit: "0.1", asset: "MON" } },
        ]}
      />,
    );
    expect(html).toContain("Below your MON floor");
    expect(html).not.toContain("{asset}");
  });
});

describe("LinkButton", () => {
  it("puts the focus ring on the unclipped link and the chamfer on the face", () => {
    for (const href of ["https://example.org", "#hero"]) {
      const html = renderToStaticMarkup(<LinkButton href={href} label="Go" />);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const link = doc.querySelector("a");
      const face = link?.querySelector("span");
      expect(link?.className).toContain("focus-visible:outline-solid");
      expect(link?.className).not.toContain("chamfer-sm");
      expect(face?.className).toContain("chamfer-sm");
    }
  });

  it("opens external links without a referrer", () => {
    const html = renderToStaticMarkup(<LinkButton href="https://example.org" label="Go" />);
    expect(html).toContain('rel="noreferrer"');
  });

  it("routes internal paths through the router", () => {
    const router = createMemoryRouter([
      { path: "/", element: <LinkButton href="/showcase" label="Go" variant="primary" /> },
    ]);
    const html = renderToStaticMarkup(<RouterProvider router={router} />);
    expect(html).toContain('href="/showcase"');
  });
});

describe("web-ui text helpers", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("{origin} may spend {amount} {asset}.", { origin: "ClaimHub", amount: "25" })).toBe(
      "ClaimHub may spend 25 {asset}.",
    );
  });

  it("picks the singular twin at one and fills both forms", () => {
    const many = "{count} sites on {network}";
    const one = "One site on {network}";
    expect(counted(1, many, one, { network: "testnet" })).toBe("One site on testnet");
    expect(counted(3, many, one, { network: "testnet" })).toBe("3 sites on testnet");
    expect(counted(0, many, one, { network: "testnet" })).toBe("0 sites on testnet");
    expect(counted(1, "{count} items", "{count} item")).toBe("1 item");
  });

  it("splits an intro after its first sentence", () => {
    expect(splitLead("One. Two words. Three.")).toEqual(["One.", "Two words. Three."]);
    expect(splitLead("Only one")).toEqual(["Only one", ""]);
  });

  it("maps a WebP srcset to its AVIF twin", () => {
    expect(avif("/a/l-06-w768.webp 768w, /a/l-06.webp 1536w")).toBe(
      "/a/l-06-w768.avif 768w, /a/l-06.avif 1536w",
    );
  });
});

describe("Reveal", () => {
  it("renders visible markup with no hidden state before an observer runs", () => {
    const html = renderToStaticMarkup(<Reveal delay={0.12}>Text</Reveal>);
    expect(html).not.toContain("data-reveal");
    expect(html).not.toContain("opacity");
    expect(html).toContain("Text");
  });
});

describe("LinkButton size sm", () => {
  it("keeps a 44 px hit area around the 36 px face", () => {
    const html = renderToStaticMarkup(<LinkButton href="#hero" label="Go" size="sm" />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("a")?.className).toContain("min-h-11");
    expect(doc.querySelector("a > span")?.className).toContain("h-9");
  });
});

describe("Disclosures", () => {
  it("gives every item one name, so opening one closes the others", () => {
    const html = renderToStaticMarkup(
      <Disclosures
        name="faq"
        items={[
          { summary: "One?", body: "Yes." },
          { summary: "Two?", body: "No." },
        ]}
      />,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const names = [...doc.querySelectorAll("details")].map((d) => d.getAttribute("name"));
    expect(names).toEqual(["faq", "faq"]);
    expect(doc.querySelectorAll("details[open]")).toHaveLength(0);
  });
});

describe("CopyButton", () => {
  it("is a real button with its label and an empty status region", () => {
    const html = renderToStaticMarkup(<CopyButton text="0xabc" label="Copy" done="Copied" />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("button")?.textContent).toBe("Copy");
    expect(doc.querySelector('[role="status"]')?.textContent).toBe("");
  });
});

describe("expected verdicts", () => {
  it("checks a capped expectation against Blocked", () => {
    expect(asVerdict("capped")).toBe("blocked");
    expect(asVerdict("caution")).toBe("caution");
  });
});
