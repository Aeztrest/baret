import { claimhub } from "@baret/content";
import { Button } from "@baret/ui";
import type { DemoMode } from "@baret/web-ui/lib/check-types";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, type ReactNode, useId, useRef } from "react";
import { AttackSwitch } from "../kit/AttackSwitch.js";

/**
 * The allocation box, ClaimHub's focal point, in two steps. First the
 * eligibility check: a wallet address, or none for the sample wallet.
 * Then the allocation rows and the claim button. The check is the page's own
 * theatre (every wallet is eligible); what the claim button asks for is the
 * whole scenario. The switch at the bottom stays in step with Baret's strip.
 */

const { hero, panel, attack } = claimhub.site;

export function ClaimCard({
  mode,
  onMode,
  address,
  onAddress,
  error,
  checked,
  onCheck,
  onClaim,
  hint = panel.hint,
  sign = null,
}: {
  mode: DemoMode;
  onMode: (mode: DemoMode) => void;
  address: string;
  onAddress: (value: string) => void;
  error: string | null;
  /** True once a wallet has been checked: the allocation and the claim show. */
  checked: boolean;
  /** False when the address is refused, so the card can move focus to it. */
  onCheck: () => boolean;
  onClaim: () => void;
  /** Under the field: which wallet an empty field checks. */
  hint?: string;
  /** "Sign with your wallet", shown under the claim button once a wallet was checked. */
  sign?: ReactNode;
}): JSX.Element {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const danger = mode === "danger";

  return (
    <div className="grid gap-5 border border-[color:var(--rule-strong)] bg-[color:var(--surface)] p-6 md:p-8">
      <h2 className={`${T.h3} text-[color:var(--fg)]`}>{panel.title}</h2>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // A refused address moves focus to the input, which reads out its error.
          if (!onCheck()) inputRef.current?.focus();
        }}
        className="grid gap-3"
      >
        <div className="grid gap-2">
          <label htmlFor={inputId} className={T.label}>
            {panel.label}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={address}
            onChange={(event) => onAddress(event.target.value)}
            placeholder={panel.input}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            className="w-full border border-[color:var(--control-edge)] bg-[color:var(--ground)] px-4 py-3 font-mono text-sm text-[color:var(--fg)] placeholder:font-sans placeholder:text-base placeholder:text-[color:var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-[color:var(--focus)]"
          />
          <p id={hintId} className={T.small}>
            {hint}
          </p>
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
        <Button
          type="submit"
          variant={checked ? "ghost" : "primary"}
          size={checked ? "md" : "lg"}
          className="w-full"
        >
          {hero.cta}
        </Button>
      </form>

      {/* The allocation rows are announced once the check has run. */}
      <div aria-live="polite">
        {checked ? (
          <dl className="grid border-t border-[color:var(--rule)]">
            {panel.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 border-b border-[color:var(--rule)] py-3"
              >
                <dt className={T.small}>{row.label}</dt>
                <dd className="text-right text-sm text-[color:var(--fg)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {checked ? (
        <>
          <Button type="button" variant="primary" size="lg" className="w-full" onClick={onClaim}>
            {panel.cta}
          </Button>
          {sign}
          <p className={T.small}>{panel.note}</p>
        </>
      ) : null}

      <AttackSwitch
        label={attack.switch.label}
        description={danger ? attack.switch.on : attack.switch.off}
        on={danger}
        onToggle={(on) => onMode(on ? "danger" : "safe")}
      />
    </div>
  );
}
