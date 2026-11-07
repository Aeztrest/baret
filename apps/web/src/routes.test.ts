import * as content from "@baret/content";
import { buildHref, checkRegistry, findBrokenHrefs } from "@baret/routes";
import { describe, expect, it } from "vitest";
import { PENDING_PATHS, routes } from "./routes.js";

/**
 * Route tests for the web app.
 *
 * These exist because the three failure modes they cover are all silent. A
 * duplicate path shadows a page and nobody notices until someone opens it. A
 * link written in the copy points at a route that was renamed, and it 404s for
 * a visitor rather than for us. A page module fails to import, and the only
 * symptom is a blank screen behind an error boundary.
 */

describe("registry", () => {
  it("has no duplicate, uppercase or trailing-slash paths", () => {
    expect(checkRegistry(routes)).toEqual([]);
  });

  it("gives every route a title", () => {
    for (const [key, route] of Object.entries(routes)) {
      expect(route.title, `${key} has no title`).not.toBe("");
    }
  });

  it("never lists a ported page as pending", () => {
    for (const route of Object.values(routes)) {
      expect(PENDING_PATHS.has(route.path), route.path).toBe(false);
    }
  });
});

describe("links in the copy", () => {
  /**
   * The content package holds hrefs as plain strings, because it must not
   * depend on a router. This is the check that keeps them honest: a link points
   * at a route, or at a page listed as pending.
   */
  it("point at routes that exist or are pending", () => {
    const copy = { home: content.home, common: content.common };
    const broken = findBrokenHrefs(routes, copy).filter((path) => !PENDING_PATHS.has(path));
    expect(broken).toEqual([]);
  });
});

describe("buildHref", () => {
  it("returns the declared path", () => {
    expect(buildHref(routes, "home")).toBe("/");
  });

  it("appends a query string when given one", () => {
    expect(buildHref(routes, "home", undefined, { view: "agents" })).toBe("/?view=agents");
  });
});

/**
 * One test per route, each with its own budget. A single test that imported
 * every page cold (guard, zod, the content, every demo site) ran close to the
 * default 5 s timeout and failed now and then on a busy machine (K7).
 */
const LOAD_TIMEOUT = 30_000;

describe("page modules", () => {
  it.each(Object.entries(routes))(
    "%s loads and exports a Component",
    async (key, route) => {
      const module = await route.load();
      expect(module, `${key} exported nothing`).toBeTruthy();
      expect(
        (module as { Component?: unknown }).Component,
        `${key} has no Component export, so the router cannot render it`,
      ).toBeTypeOf("function");
    },
    LOAD_TIMEOUT,
  );
});
