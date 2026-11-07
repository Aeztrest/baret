import { findings, home } from "@baret/content";
import { describe, expect, it } from "vitest";

/** Guards the sample data behind the landing widgets (H1-H4) so a copy edit
 *  cannot silently break a number, a link or a finding template. */
describe("landing demo content", () => {
  it("never claims the marquee lists every check", () => {
    expect(home.marquee.listLabel).not.toMatch(/\ball\b/i);
  });

  it("links every verdict sample to a real showcase site", () => {
    const hrefs = home.showcase.cards.map((card) => card.href as string);
    expect(home.caution.demo.samples.map((s) => s.id)).toEqual(["send", "swap", "approve"]);
    for (const sample of home.caution.demo.samples) {
      expect(hrefs).toContain(sample.href);
    }
  });

  it("fills only placeholders the finding templates declare", () => {
    const approve = findings[home.caution.demo.finding.code];
    expect(Object.keys(home.caution.demo.finding.values).sort()).toEqual(
      [...approve.values].sort(),
    );
    const cap = findings[home.agents.demo.findingCode];
    expect([...cap.values].sort()).toEqual(["actual", "amount", "asset", "cap"]);
  });

  it("offers a preset that fits the run and one that caps it, starting capped", () => {
    const { presets, initial, price, run } = home.agents.demo;
    const fits = (cap: number) => Math.floor(cap / price) >= run;
    expect(presets).toContain(initial);
    expect(fits(initial)).toBe(false);
    expect(presets.some(fits)).toBe(true);
  });
});
