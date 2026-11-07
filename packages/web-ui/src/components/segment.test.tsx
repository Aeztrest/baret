import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Segment } from "./Segment.js";

function Pair() {
  const [v, setV] = useState("a");
  return (
    <>
      <Segment name="n" value="a" label="A" checked={v === "a"} onSelect={setV} />
      <Segment name="n" value="b" label="B" checked={v === "b"} onSelect={setV} />
    </>
  );
}

const face = (name: string) =>
  screen.getByRole("radio", { name }).nextElementSibling as HTMLElement;

/**
 * The selection swaps in the same frame (IMPROVE H contract). jsdom has no
 * Tailwind, so this checks the class contract that guarantees it: the face
 * may only ease while the press tint shows, never on select or deselect, so
 * the frame after a change already paints the selected face in full --fg.
 */
describe("segment face", () => {
  it("only transitions under the press tint, so selection is instant", () => {
    render(<Pair />);
    fireEvent.click(screen.getByRole("radio", { name: "B" }));
    expect((screen.getByRole("radio", { name: "B" }) as HTMLInputElement).checked).toBe(true);
    for (const name of ["A", "B"]) {
      const tokens = face(name).className.split(/\s+/);
      const motion = tokens.filter((t) => /(^|:)(transition|duration)/.test(t));
      expect(motion.length).toBeGreaterThan(0);
      for (const t of motion) expect(t.startsWith("peer-[:active:not(:checked)]:")).toBe(true);
      expect(tokens).toContain("peer-checked:bg-[color:var(--fg)]");
      expect(tokens).not.toContain("transition-colors");
    }
  });
});
