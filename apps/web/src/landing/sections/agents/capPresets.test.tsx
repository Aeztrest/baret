import { home } from "@baret/content";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CapPresets } from "./CapPresets.js";
import { amount, capProgress, capSentence } from "./capRun.js";

const { demo } = home.agents;

function mount() {
  const view = render(<CapPresets />);
  const result = () => view.container.querySelector("[data-result]") as HTMLElement;
  return { result, status: () => screen.getByRole("status") };
}

describe("daily-cap presets (H3)", () => {
  it("is a native radio group of four presets, starting on the initial cap", () => {
    const { result, status } = mount();
    const group = screen.getByRole("group", { name: demo.legend });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(demo.presets.map(String));
    expect(radios.find((r) => r.checked)?.value).toBe(String(demo.initial));
    expect(result().getAttribute("data-result")).toBe("capped");
    expect(result().textContent).toContain(demo.capped);
    expect(result().textContent).toContain(capSentence(demo.initial));
    expect(result().textContent).toContain(capProgress(demo.initial) ?? "");
    expect(status().textContent).toBe("");
  });

  it("switches to fits in the same event, drops the tag and keeps focus", () => {
    const { result, status } = mount();
    const big = screen.getByRole("radio", { name: amount(50) });
    big.focus();
    fireEvent.click(big);
    expect(result().getAttribute("data-result")).toBe("fits");
    expect(result().textContent).not.toContain(demo.capped);
    expect(result().textContent).toBe(capSentence(50));
    expect(status().textContent).toBe(capSentence(50));
    expect(document.activeElement).toBe(big);
  });

  it("announces the tag and the finding when the run is capped again", () => {
    const { result, status } = mount();
    fireEvent.click(screen.getByRole("radio", { name: amount(50) }));
    fireEvent.click(screen.getByRole("radio", { name: amount(10) }));
    expect(result().getAttribute("data-result")).toBe("capped");
    expect(status().textContent).toBe(`${demo.capped}. ${capSentence(10)}`);
  });

  it("labels the run as sample data", () => {
    render(<CapPresets />);
    expect(screen.getByText(demo.previewLabel, { normalizer: (s) => s })).toBeTruthy();
  });
});
