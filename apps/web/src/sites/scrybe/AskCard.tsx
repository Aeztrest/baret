import { scrybe } from "@baret/content";
import { Button, truncateAddress } from "@baret/ui";
import { Segment } from "@baret/web-ui/components/Segment";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, type ReactNode, useId, useRef } from "react";
import { AttackSwitch } from "../kit/AttackSwitch.js";
import { CAPS, type Cap, SAMPLE, usdc } from "./sample.js";

/**
 * Scrybe's question box, the site's focal point. Honest: one question, its
 * price, who gets paid, and "Pay and ask". With the agent loop on, the
 * question gives way to the hourly cap the visitor picks (the page asks for
 * a low one, so the stop comes after a few payments), and the button starts
 * the agent. The switch at the bottom stays in step with Baret's strip.
 */

const { panel, attack } = scrybe.site;
const { watch } = scrybe.analysis;

const FIELD =
  "w-full resize-y border border-[color:var(--control-edge)] bg-[color:var(--ground)] px-4 py-3 text-lg text-[color:var(--fg)] placeholder:text-[color:var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-[color:var(--focus)]";

export function AskCard({
  mode,
  onMode,
  question,
  onQuestion,
  cap,
  onCap,
  error,
  onAsk,
  merchant,
  pay,
}: {
  mode: DemoMode;
  onMode: (mode: DemoMode) => void;
  question: string;
  onQuestion: (value: string) => void;
  cap: Cap;
  onCap: (cap: Cap) => void;
  error: string | null;
  /** False when the question is missing. */
  onAsk: () => boolean;
  /** Who gets paid: the sample's merchant, or the real one when a payment can be made. */
  merchant: string;
  /** The real payment (PayBlock), under the honest version's button. */
  pay: ReactNode;
}): JSX.Element {
  const titleId = useId();
  const errorId = useId();
  const capName = useId();
  const capHintId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const danger = mode === "danger";
  const values = { amount: usdc(SAMPLE.price), merchant: truncateAddress(merchant) };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // A failed ask moves focus to the question, which reads out its error.
        if (!onAsk()) fieldRef.current?.focus();
      }}
      className="grid gap-5 border border-[color:var(--rule-strong)] bg-[color:var(--surface)] p-6 md:p-8"
    >
      <h2 id={titleId} className={`${T.h3} text-[color:var(--fg)]`}>
        {panel.title}
      </h2>

      {danger ? (
        <fieldset className="grid gap-3" aria-describedby={capHintId}>
          <legend className={T.label}>{attack.cap}</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CAPS.map((value) => (
              <Segment
                key={String(value)}
                name={capName}
                value={String(value)}
                checked={cap === value}
                label={fill(scrybe.amount, { amount: usdc(value) })}
                onSelect={(next) => {
                  const picked = CAPS.find((c) => String(c) === next);
                  if (picked !== undefined) onCap(picked);
                }}
              />
            ))}
          </div>
          <p id={capHintId} className={T.small}>
            {watch.body}
          </p>
        </fieldset>
      ) : (
        <div className="grid gap-2">
          <textarea
            ref={fieldRef}
            aria-labelledby={titleId}
            rows={3}
            value={question}
            placeholder={panel.input}
            onChange={(event) => onQuestion(event.target.value)}
            aria-invalid={error ? true : undefined}
            {...(error ? { "aria-describedby": errorId } : {})}
            className={FIELD}
          />
          {/* Always mounted, so the error is announced when it appears. */}
          <p
            id={errorId}
            aria-live="polite"
            className="text-sm font-medium text-[color:var(--blocked)] empty:hidden"
          >
            {error}
          </p>
        </div>
      )}

      <dl className="grid border-t border-[color:var(--rule)]">
        {panel.rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] py-3"
          >
            <dt className={T.small}>{row.label}</dt>
            <dd className="text-right text-sm text-[color:var(--fg)]">{fill(row.value, values)}</dd>
          </div>
        ))}
      </dl>

      <Button type="submit" variant="primary" size="lg" className="w-full">
        {danger ? attack.cta : panel.cta}
      </Button>
      <p className={T.small}>{danger ? attack.note : panel.note}</p>

      {danger ? null : pay}

      <AttackSwitch
        label={attack.switch.label}
        description={danger ? attack.switch.on : attack.switch.off}
        on={danger}
        onToggle={(on) => onMode(on ? "danger" : "safe")}
      />
    </form>
  );
}
