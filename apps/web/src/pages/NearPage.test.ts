import { describe, expect, it } from "vitest";
import { titleOf } from "./NearPage.js";

describe("the NEAR panel's finding titles", () => {
  it("fills placeholders from the verdict's values", () => {
    expect(titleOf("COUNTERPARTY_FIRST_PAYMENT", { address: "shop.testnet" })).toBe(
      "First time paying shop.testnet",
    );
  });

  it("keeps a placeholder the verdict did not send, and an unknown code as itself", () => {
    expect(titleOf("COUNTERPARTY_FIRST_PAYMENT")).toBe("First time paying {address}");
    expect(titleOf("NOT_A_CODE")).toBe("NOT_A_CODE");
  });
});
