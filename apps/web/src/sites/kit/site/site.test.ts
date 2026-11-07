import { describe, expect, it } from "vitest";
import { viewFrom } from "./useSiteView.js";

describe("a demo site's pages", () => {
  const views = ["swap", "pools", "stats", "docs"] as const;

  it("opens the page named in ?view=", () => {
    expect(viewFrom(views, "stats")).toBe("stats");
  });

  it("falls back to the home page for no or an unknown view", () => {
    expect(viewFrom(views, null)).toBe("swap");
    expect(viewFrom(views, "admin")).toBe("swap");
  });
});
