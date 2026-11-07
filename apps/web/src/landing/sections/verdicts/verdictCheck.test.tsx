import { home, policy } from "@baret/content";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { VerdictsSection } from "../Verdicts.js";
import { approvalFinding } from "./verdictOf.js";

const { caution } = home;
const { demo } = caution;
const label = (id: string) => demo.samples.find((s) => s.id === id)?.label ?? "";
const impact = (v: string) => caution.examples.find((ex) => ex.verdict === v)?.impact ?? "";

function mount() {
  const router = createMemoryRouter([{ path: "/", element: <VerdictsSection /> }]);
  const view = render(<RouterProvider router={router} />);
  const marked = () =>
    [...view.container.querySelectorAll('li[aria-current="true"]')].map((li) =>
      li.getAttribute("data-verdict"),
    );
  const result = () => view.container.querySelector("[data-result]") as HTMLElement;
  return { view, marked, result, status: () => screen.getByRole("status") };
}

describe("verdict check (H1, H2)", () => {
  it("is a native radio group with the approve sample checked and an empty status", () => {
    const { marked, status } = mount();
    const group = screen.getByRole("group", { name: demo.legend });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(
      (screen.getByRole("radio", { name: label("approve") }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(marked()).toEqual(["blocked"]);
    expect(status().textContent).toBe("");
  });

  it("shows the result in the same event, marks the column and keeps focus", () => {
    const { marked, result, status } = mount();
    const send = screen.getByRole("radio", { name: label("send") });
    send.focus();
    fireEvent.click(send);
    expect(result().getAttribute("data-result")).toBe("safe");
    expect(marked()).toEqual(["safe"]);
    expect(status().textContent).toBe(`Safe. ${impact("safe")}`);
    expect(document.activeElement).toBe(send);
    expect(within(result()).getByRole("link").getAttribute("href")).toBe("/novaswap");
  });

  it("offers the rule switch only for the approve sample, with the slot kept", () => {
    const { view } = mount();
    expect(
      screen.getByRole("switch", { name: policy.fields["core.blockUnlimitedApprovals"].label }),
    );
    fireEvent.click(screen.getByRole("radio", { name: label("swap") }));
    expect(screen.queryByRole("switch")).toBeNull();
    expect(view.container.querySelector('[data-slot="rule"]')).not.toBeNull();
  });

  it("turning the rule off gives Caution and still shows the finding", () => {
    const { marked, result, status } = mount();
    const rule = screen.getByRole("switch") as HTMLInputElement;
    expect(rule.checked).toBe(true);
    expect(result().getAttribute("data-result")).toBe("blocked");
    // The Blocked column already says it; the demo result does not repeat it.
    expect(result().textContent).not.toContain(demo.rule.stopped);
    expect(result().textContent).toContain(approvalFinding());
    rule.focus();
    fireEvent.click(rule);
    expect(rule.checked).toBe(false);
    expect(result().getAttribute("data-result")).toBe("caution");
    expect(result().textContent).toContain(approvalFinding());
    expect(result().textContent).toContain(impact("blocked"));
    expect(marked()).toEqual(["caution"]);
    expect(status().textContent).toBe(demo.announce.ruleOff);
    expect(document.activeElement).toBe(rule);
    // The switch label never changes; only the state word does.
    expect(
      screen.getByRole("switch", { name: policy.fields["core.blockUnlimitedApprovals"].label }),
    );
    expect(result().textContent).toContain(demo.rule.off);
  });

  it("keeps all three verdict bodies in the DOM in every state", () => {
    const { view } = mount();
    for (const id of ["send", "swap", "approve"]) {
      fireEvent.click(screen.getByRole("radio", { name: label(id) }));
      const text = view.container.textContent ?? "";
      for (const ex of caution.examples) expect(text).toContain(ex.body);
    }
  });
});
