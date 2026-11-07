import { titleIdOf } from "@baret/web-ui/components/Section";
import { describe, expect, it } from "vitest";
import { IDS, type SectionKey, titleId } from "./ids.js";

describe("landing anchors", () => {
  it("label every landing section by the heading id the shared Section expects", () => {
    for (const key of Object.keys(IDS) as SectionKey[]) {
      expect(titleId(key)).toBe(titleIdOf(IDS[key]));
    }
  });
});
