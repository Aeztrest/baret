import { launchpad } from "@baret/content";
import { launchpadUnits } from "@baret/content/web/launchpad.content";
import { Button } from "@baret/ui";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import type { JSX, ReactNode } from "react";
import { AttackSwitch } from "../kit/AttackSwitch.js";
import { parseAmount } from "../kit/amount.js";
import { AmountField } from "../kit/site/AmountField.js";
import { Fill } from "../kit/site/Page.js";
import { RAISED, tokensFor } from "./sample.js";

/**
 * The contribution box, LaunchPad's focal point: how much MON, the LNTL it
 * buys at the fixed price, the sale's limits, how much is raised, and the
 * one button. In the attack version the box says the same and LNTL still
 * arrives; only the contract behind the button changes, which is the point.
 * The switch at the bottom stays in step with Baret's strip.
 */

const { panel, attack } = launchpad.site;

export function ContributeCard({
  mode,
  onMode,
  amount,
  onAmount,
  error,
  onContribute,
  sign = null,
}: {
  mode: DemoMode;
  onMode: (mode: DemoMode) => void;
  amount: string;
  onAmount: (value: string) => void;
  error: string | null;
  /** False when the amount is refused, so the card can move focus to it. */
  onContribute: () => boolean;
  /** "Sign with your wallet", shown under the main button. */
  sign?: ReactNode;
}): JSX.Element {
  const danger = mode === "danger";
  const value = parseAmount(amount);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // A refused amount moves focus to the input, which reads out its error.
        if (!onContribute()) event.currentTarget.querySelector("input")?.focus();
      }}
      className="grid gap-5 border border-[color:var(--rule-strong)] bg-[color:var(--surface)] p-6 md:p-8"
    >
      <h2 className={`${T.h3} text-[color:var(--fg)]`}>{panel.title}</h2>

      <AmountField
        label={panel.input}
        unit={launchpadUnits.pay}
        value={amount}
        onChange={onAmount}
        error={error}
      />

      <dl className="grid border-t border-[color:var(--rule)]">
        <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] py-3">
          <dt className={T.small}>{panel.receive}</dt>
          <dd className="text-right font-display text-2xl font-extrabold tabular-nums text-[color:var(--fg)]">
            {tokensFor(value ?? 0)}{" "}
            <span className="text-base font-bold">{launchpadUnits.receive}</span>
          </dd>
        </div>
        {panel.rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] py-3"
          >
            <dt className={T.small}>{row.label}</dt>
            <dd className={`${T.num} text-right text-sm text-[color:var(--fg)]`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {/* The "Raised" row as a bar; the row above already says it in words. */}
      <div aria-hidden="true" className="-mt-3 h-1.5 bg-[color:var(--rule)]">
        <Fill
          axis="x"
          size={`${RAISED * 100}%`}
          className="h-full bg-[color:var(--accent-mark)] forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none"
        />
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full">
        {panel.cta}
      </Button>
      {sign}
      <p className={T.small}>{panel.note}</p>

      <AttackSwitch
        label={attack.switch.label}
        description={danger ? attack.switch.on : attack.switch.off}
        on={danger}
        onToggle={(on) => onMode(on ? "danger" : "safe")}
      />
    </form>
  );
}
