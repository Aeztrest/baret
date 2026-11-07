import { describe, expect, it } from "vitest";
import { routes } from "../routes.js";
import { headFor } from "./RootLayout.js";

/**
 * The built site is served from dist/<route>/index.html, so a static host
 * answers "/page/" as often as "/page". Both must get the same head.
 */
describe("headFor", () => {
  it("drops a trailing slash before the title lookup", () => {
    expect(headFor("//").path).toBe("/");
    expect(headFor("//").title).toBe(routes.home.title);
  });

  it("marks an unknown URL noindex and leaves real pages indexable", () => {
    expect(headFor("/does-not-exist").noindex).toBe(true);
    expect(headFor("/does-not-exist/").title).toBe(routes.notFound.title);
    expect(headFor("/").noindex).toBe(false);
    expect(headFor("/").demo).toBe(false);
  });
});
