import { pixeldrop } from "@baret/content";
import { Button } from "@baret/ui";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, type ReactNode, useId, useRef } from "react";
import { AttackSwitch } from "../kit/AttackSwitch.js";
import { Fill } from "../kit/site/Page.js";

/**
 * The mint box, PixelDrop's focal point: how many pieces, the price, the
 * per-wallet limit, how much of the drop is gone, and the one button. In the
 * attack version the box looks the same; only what the button asks for
 * changes, which is the point. The switch at the bottom stays in step with
 * Baret's strip.
 */

const { panel, attack } = pixeldrop.site;

/** How much of the drop is minted, from the page's own figure (3,847 of 5,000). */
const MINTED = 3847 / 5000;

export function MintCard({
  mode,
  onMode,
  quantity,
  onQuantity,
  error,
  onMint,
  sign = null,
}: {
  mode: DemoMode;
  onMode: (mode: DemoMode) => void;
  quantity: string;
  onQuantity: (value: string) => void;
  error: string | null;
  /** False when the quantity is refused, so the card can move focus to it. */
  onMint: () => boolean;
  /** "Sign with your wallet", shown under the main button. */
  sign?: ReactNode;
}): JSX.Element {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const danger = mode === "danger";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // A refused quantity moves focus to the input, which reads out its error.
        if (!onMint()) inputRef.current?.focus();
      }}
      className="grid gap-5 border border-[color:var(--rule-strong)] bg-[color:var(--surface)] p-6 md:p-8"
    >
      <h2 className={`${T.h3} text-[color:var(--fg)]`}>{panel.title}</h2>

      <div className="grid gap-2">
        <label htmlFor={inputId} className={T.label}>
          {panel.input}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          value={quantity}
          onChange={(event) => onQuantity(event.target.value)}
          aria-invalid={error ? true : undefined}
          {...(error ? { "aria-describedby": errorId } : {})}
          className="w-full border border-[color:var(--control-edge)] bg-[color:var(--ground)] px-4 py-4 font-display text-3xl font-extrabold tabular-nums text-[color:var(--fg)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-[color:var(--focus)]"
        />
        {/* Mounted from the start, so the error is spoken when it appears; sr-only takes no grid row. */}
        <p aria-live="assertive" className="sr-only">
          {error ?? ""}
        </p>
        {error ? (
          <p id={errorId} className="text-sm font-medium text-[color:var(--blocked)]">
            {error}
          </p>
        ) : null}
      </div>

      <dl className="grid border-t border-[color:var(--rule)]">
        {panel.rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] py-3"
          >
            <dt className={T.small}>{row.label}</dt>
            <dd className={`${T.num} text-sm text-[color:var(--fg)]`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {/* The "Minted" row as a bar; the row above already says it in words. */}
      <div aria-hidden="true" className="-mt-3 h-1.5 bg-[color:var(--rule)]">
        <Fill
          axis="x"
          size={`${MINTED * 100}%`}
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
