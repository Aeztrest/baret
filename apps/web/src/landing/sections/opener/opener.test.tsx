import { home } from "@baret/content";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OpenerSection } from "../Opener.js";

describe("opener loop", () => {
  it("renders every line, a pause control and no skip link", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<OpenerSection />);
    const text = host.textContent ?? "";
    for (const line of home.opener.lines) expect(text).toContain(line);
    expect(host.querySelector(`[aria-label="${home.opener.pause}"]`)).not.toBeNull();
    expect(host.querySelector('a[href="#hero"]')).toBeNull();
    expect("skip" in home.opener).toBe(false);
  });
});
