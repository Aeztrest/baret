import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it } from "vitest";
import { PRERENDERED, render } from "./entry-server.js";
import { resolveRoute, routeObjects } from "./router.js";
import { routes } from "./routes.js";

/**
 * Every route ships prerendered (scripts/prerender.mjs). These tests keep it
 * that way: a component that reads the browser while rendering either throws
 * here or makes hydration fall back to a full client render, which shows up
 * as a recoverable error.
 */
describe("prerendered pages", () => {
  afterEach(() => {
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/");
  });

  it("lists every route of the registry", () => {
    const paths = Object.values(routes)
      .map((r) => r.path)
      .filter((p) => !p.includes("*"));
    expect([...PRERENDERED].sort()).toEqual([...paths, "/404"].sort());
  });

  it("renders without a browser, head tags left to the static head", async () => {
    const html = await render("/");
    expect(html.startsWith("<div")).toBe(true);
    expect(html).toContain("<h1");
    expect(html).toContain('id="main"');
    expect(html).not.toMatch(/<title/);
  });

  it("renders the not-found page for an unknown path", async () => {
    const html = await render("/404");
    expect(html).toContain("<h1");
    expect(html).toContain('id="not-found"');
  });

  it.each(PRERENDERED)(
    "hydrates %s with no mismatch",
    async (path) => {
      const container = document.createElement("div");
      container.innerHTML = await render(path);
      expect(container.innerHTML).toContain("<h1");
      document.body.append(container);
      window.history.replaceState({}, "", path);
      await resolveRoute(path);
      const errors: unknown[] = [];
      await act(async () => {
        hydrateRoot(container, <RouterProvider router={createBrowserRouter(routeObjects)} />, {
          onRecoverableError: (error) => errors.push(error),
        });
      });
      expect(errors).toEqual([]);
    },
    30_000,
  );
});
