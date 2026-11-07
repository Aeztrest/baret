import { home } from "@baret/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LayerTabs } from "./LayerTabs.js";

function mount(): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<LayerTabs />);
  return host;
}

describe("how it works: layer tabs", () => {
  it("renders one tab and one panel per layer, the first selected", () => {
    const host = mount();
    const tabs = host.querySelectorAll('[role="tab"]');
    const panels = host.querySelectorAll('[role="tabpanel"]');
    expect(tabs).toHaveLength(home.pillars.items.length);
    expect(panels).toHaveLength(home.pillars.items.length);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(host.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
  });

  it("keeps every layer's words in the markup for find-in-page", () => {
    const text = mount().textContent ?? "";
    for (const item of home.pillars.items) {
      expect(text).toContain(item.body);
      for (const point of item.points) expect(text).toContain(point);
    }
  });

  it("wires each tab to its panel", () => {
    const host = mount();
    for (const tab of host.querySelectorAll('[role="tab"]')) {
      const panel = host.querySelector(`#${tab.getAttribute("aria-controls")}`);
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    }
  });
});
