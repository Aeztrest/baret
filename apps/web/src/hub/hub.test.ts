import { hub } from "@baret/content";
import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../sites/scenarios.js";
import {
  filterScenarios,
  filterStatus,
  PANEL_LEFT,
  parseFilter,
  STEP_PANEL,
  STRIP_FRAME,
  stripShift,
} from "./hub.js";

describe("the hub filter", () => {
  it("shows all six sites for All six", () => {
    expect(filterScenarios("all")).toHaveLength(6);
  });

  it("puts every site under exactly one threat class", () => {
    const classes = hub.filters.items.map((f) => f.id).filter((id) => id !== "all");
    const total = classes.reduce((n, id) => n + filterScenarios(id).length, 0);
    expect(total).toBe(SCENARIOS.length);
    for (const id of classes) expect(filterScenarios(id).length).toBeGreaterThan(0);
  });

  it("reads the filter back from the URL query, unknown values as all", () => {
    for (const { id } of hub.filters.items) expect(parseFilter(id)).toBe(id);
    expect(parseFilter(null)).toBe("all");
    expect(parseFilter("drainers")).toBe("all");
    expect(parseFilter("")).toBe("all");
  });

  it("keeps NovaSwap with the drainers (D-018)", () => {
    expect(filterScenarios("drainer").map((s) => s.slug)).toContain("novaswap");
  });

  it("announces the count", () => {
    expect(filterStatus(3)).toBe("3 of 6 sites shown.");
  });
});

describe("the step strip", () => {
  it("gives each of the four steps its own drawing", () => {
    expect(new Set(STEP_PANEL).size).toBe(hub.steps.items.length);
  });

  it("moves the strip left by the panel's edge", () => {
    expect(stripShift(0)).toBe(`${((-PANEL_LEFT[0] / 1536) * 100).toFixed(3)}%`);
    expect(stripShift(1)).toBe(`${((-PANEL_LEFT[3] / 1536) * 100).toFixed(3)}%`);
  });

  it("cuts the frame to one panel", () => {
    expect(STRIP_FRAME.ratio).toBe("357 / 457");
    expect(Number.parseFloat(STRIP_FRAME.width)).toBeCloseTo(430.252, 2);
  });
});
