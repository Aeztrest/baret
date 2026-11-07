import { demoFrame } from "@baret/content";
import { IDLE } from "@baret/demo-evm/wallet";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignBlock } from "./SignBlock.js";

/** Hale's 🐛 P1 (2026-10-10): with the Baret extension connected, the page said the request skips Baret's check. */
const props = {
  flow: IDLE,
  labels: ["Approve", "Swap"],
  need: null,
  switching: "idle" as const,
  onConnect: () => undefined,
  onSwitch: () => undefined,
  token: { symbol: "dUSDC", decimals: 6 },
  outcome: [],
  onSign: () => undefined,
};

describe("SignBlock", () => {
  it("says an ordinary wallet gets the request with no Baret check", () => {
    render(<SignBlock {...props} walletName="MetaMask" />);
    expect(screen.getByText(demoFrame.sign.note)).toBeTruthy();
  });

  it("never says so when the wallet is the Baret extension", () => {
    render(<SignBlock {...props} walletName={demoFrame.wallet.extension.name} checks />);
    expect(screen.getByText(demoFrame.sign.noteChecked)).toBeTruthy();
    expect(screen.queryByText(demoFrame.sign.note)).toBeNull();
  });

  it("shows both paths before a press on the attack version only", () => {
    const { unmount } = render(<SignBlock {...props} walletName="MetaMask" attack />);
    expect(screen.getByText(demoFrame.sign.paths.baret.body)).toBeTruthy();
    expect(screen.getByText(demoFrame.sign.paths.plain.body)).toBeTruthy();
    unmount();
    render(<SignBlock {...props} walletName="MetaMask" />);
    expect(screen.queryByText(demoFrame.sign.paths.plain.body)).toBeNull();
  });

  it("heads a finished attack run as one that went through", () => {
    const flow = {
      ...IDLE,
      phase: "done" as const,
      steps: [{ status: "done" as const, hash: null }],
    };
    render(
      <SignBlock {...props} flow={flow} walletName="MetaMask" outcome={["Taken."]} ranAttack />,
    );
    expect(screen.getByText(demoFrame.sign.through)).toBeTruthy();
    expect(screen.getByText("Taken.")).toBeTruthy();
  });

  /** Live test 2026-10-14 (P2): with no dUSDC, a press did nothing and said nothing. */
  it("disables the button with its reason as the description when the run cannot start", () => {
    const onSign = vi.fn();
    render(<SignBlock {...props} walletName="MetaMask" blocked="No dUSDC yet." onSign={onSign} />);
    const button = screen.getByRole("button", { name: demoFrame.sign.action });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toBe("No dUSDC yet.");
    fireEvent.click(button);
    expect(onSign).not.toHaveBeenCalled();
  });

  it("names the faucet when the account cannot pay the amount and its fee", () => {
    const flow = {
      ...IDLE,
      phase: "stopped" as const,
      error: "funds" as const,
      steps: [{ status: "failed" as const, hash: null }],
    };
    render(<SignBlock {...props} flow={flow} walletName="MetaMask" />);
    expect(screen.getByText(demoFrame.sign.errors.funds)).toBeTruthy();
    const link = screen.getByRole("link", { name: demoFrame.wallet.account.faucet.label });
    expect(link.getAttribute("href")).toBe("https://faucet.monad.xyz");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
