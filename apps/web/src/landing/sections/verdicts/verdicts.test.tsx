import { home } from "@baret/content";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { VerdictsSection } from "../Verdicts.js";

const { caution } = home;

function render(): Document {
  const router = createMemoryRouter([{ path: "/", element: <VerdictsSection /> }]);
  const html = renderToStaticMarkup(<RouterProvider router={router} />);
  return new DOMParser().parseFromString(html, "text/html");
}

describe("Verdicts section", () => {
  it("renders three columns in the order safe, caution, blocked", () => {
    const cols = [...render().querySelectorAll("li[data-verdict]")];
    expect(cols.map((c) => c.getAttribute("data-verdict"))).toEqual(["safe", "caution", "blocked"]);
  });

  it("shows every verdict body with no interaction and no tabs", () => {
    const doc = render();
    const text = doc.body.textContent ?? "";
    for (const ex of caution.examples) expect(text).toContain(ex.body);
    expect(doc.querySelector('[role="tab"], [role="tablist"]')).toBeNull();
  });

  it("renders one tier per column: the impact shows once, in the check, never in a column", () => {
    const doc = render();
    for (const col of doc.querySelectorAll("li[data-verdict]")) {
      const text = col.textContent ?? "";
      expect(text).not.toContain(caution.labels.impact);
      for (const ex of caution.examples) expect(text).not.toContain(ex.impact);
    }
    const all = doc.body.textContent ?? "";
    const blocked = caution.examples[2]?.impact ?? "";
    expect(all.split(blocked)).toHaveLength(2);
    expect(all.split(caution.labels.impact)).toHaveLength(2);
  });

  it("starts settled on the approve sample, Blocked, with that column marked", () => {
    const doc = render();
    expect(doc.querySelector("[data-result]")?.getAttribute("data-result")).toBe("blocked");
    const marked = [...doc.querySelectorAll('li[aria-current="true"]')];
    expect(marked.map((c) => c.getAttribute("data-verdict"))).toEqual(["blocked"]);
    expect(doc.querySelector('[role="status"]')?.textContent).toBe("");
  });

  it("closes with the fail-closed caption as one small line, no tag", () => {
    const line = render().querySelector('[data-verdict="unreachable"]');
    expect(line?.tagName).toBe("P");
    expect(line?.textContent).toBe(caution.honesty.title);
  });
});
