import { check, common, findings } from "@baret/content";
import { ChangeRow, VerdictTag } from "@baret/ui";
import type { JSX, ReactNode } from "react";
import type { CheckApproval, CheckChange, CheckFinding, Verdict } from "../lib/check-types.js";
import { T } from "../lib/type.js";
import { fill } from "../lib/util.js";

/**
 * The building blocks of the Baret panel. Every label comes from
 * shared/check, shared/findings and common.verdicts, so every demo dApp and
 * the wallet read the same and a copy change reaches all of them.
 */

const { panel } = check;

/** A titled group inside the panel: a hairline, a mono label, the content. */
export function PanelBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="grid gap-3 border-t border-[color:var(--rule)] pt-5">
      <h3 className={T.label}>{title}</h3>
      {children}
    </section>
  );
}

/**
 * An expected verdict as the panel shows it. "capped" (Scrybe's agent loop:
 * the payment that would cross a cap is stopped) is Blocked, with its own
 * word from shared/check ("Blocked at the cap").
 */
export type ExpectedKind = Verdict | "capped";

/** The verdict a "capped" expectation is checked against. */
export function asVerdict(expected: ExpectedKind): Verdict {
  return expected === "capped" ? "blocked" : expected;
}

/** The expected verdict, always framed as expected (never as live). */
export function ExpectedVerdict({
  verdict,
  body,
}: {
  verdict: ExpectedKind;
  body: string;
}): JSX.Element {
  const label = verdict === "capped" ? check.capped : common.verdicts[verdict].label;
  return (
    <PanelBlock title={panel.expected}>
      <div className="flex">
        <VerdictTag kind={asVerdict(verdict)} label={label} />
      </div>
      <p className={T.body}>{body}</p>
      <p className={T.small}>{panel.expectedNote}</p>
    </PanelBlock>
  );
}

/**
 * Baret's own answer, with one line comparing it to the expected verdict.
 * Without `expected` (the check did not finish) the line is left out.
 */
export function LiveVerdict({
  verdict,
  expected,
}: {
  verdict: Verdict;
  expected?: ExpectedKind;
}): JSX.Element {
  return (
    <PanelBlock title={panel.live}>
      <div className="flex">
        <VerdictTag kind={verdict} label={common.verdicts[verdict].label} />
      </div>
      {expected ? (
        <p className={T.small}>{verdict === asVerdict(expected) ? panel.match : panel.mismatch}</p>
      ) : null}
    </PanelBlock>
  );
}

/** What the site asks the wallet to sign, and the call itself in mono. */
export function TheAsk({ asks, call }: { asks: string; call: string }): JSX.Element {
  return (
    <PanelBlock title={panel.asks}>
      <p className={T.body}>{asks}</p>
      <p className={T.label}>{panel.call}</p>
      <code className="block border border-[color:var(--rule)] bg-[color:var(--ground)] px-3 py-2 font-mono text-sm text-[color:var(--fg)]">
        {call}
      </code>
    </PanelBlock>
  );
}

/**
 * True when every {placeholder} in a sentence has a non-empty value. The
 * server leaves a value empty when it does not apply (an approval that
 * spends nothing has no `amount`), and then the sentence is left out.
 */
export function hasValues(template: string, values: Readonly<Record<string, string>>): boolean {
  return [...template.matchAll(/\{(\w+)\}/g)].every(([, key]) => Boolean(key && values[key]));
}

type BodyCopy = {
  body: string;
  bodySelf?: string;
  bodyAsset?: string;
  bodySelfAsset?: string;
  bodyReason?: string;
};

/** Registry reasonCodes `bodyOf()` names instead of the generic body. */
const KNOWN_REGISTRY_REASONS: ReadonlySet<string> = new Set(["SCAMSNIFFER_BLACKLIST"]);

/**
 * The finding's sentence and the values to fill it: `details.side === "self"`
 * picks `bodySelf` over `body`, and `details.asset` (a compliant asset's own
 * policy, not the user's rule) picks the `*Asset` variant. The server sends
 * the asset's address there, so those sentences say "this asset" and the
 * values stay exactly as the server sent them. `details.registry.reasonCode`
 * naming a known source (`KNOWN_REGISTRY_REASONS`) picks `bodyReason`, a
 * complete sentence with nothing interpolated, so an unrecognised code falls
 * back to `body` instead of guessing. A finding with none of these just
 * reads `body`. Shared by every finding list: the web app's `FindingList`,
 * the playground's `Result`, the wallet's `Findings` and the extension's
 * activity log.
 */
export function bodyOf(
  copy: BodyCopy,
  item: Pick<CheckFinding, "values" | "details">,
): { readonly template: string; readonly values: Readonly<Record<string, string>> } {
  const self = item.details?.side === "self";
  const hasAsset = typeof item.details?.asset === "string";
  const registry = item.details?.registry;
  const reasonCode =
    registry && typeof registry === "object" && "reasonCode" in registry
      ? (registry as { reasonCode: unknown }).reasonCode
      : undefined;
  const hasKnownReason = typeof reasonCode === "string" && KNOWN_REGISTRY_REASONS.has(reasonCode);
  const template =
    self && hasAsset && copy.bodySelfAsset
      ? copy.bodySelfAsset
      : hasAsset && copy.bodyAsset
        ? copy.bodyAsset
        : self && copy.bodySelf
          ? copy.bodySelf
          : hasKnownReason && copy.bodyReason
            ? copy.bodyReason
            : copy.body;
  return { template, values: item.values };
}

/** Findings rendered from their codes: title, the filled sentence, the fix when it applies. */
export function FindingList({ items }: { items: readonly CheckFinding[] }): JSX.Element {
  return (
    <PanelBlock title={panel.findings}>
      {items.length === 0 ? (
        <p className={T.body}>{panel.noFindings}</p>
      ) : (
        <ul className="grid gap-4">
          {items.map((item, i) => {
            const copy = findings[item.code];
            const { template, values } = bodyOf(copy, item);
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: an answer can repeat a code (both sides of a compliance check), and the list never reorders.
                key={`${item.code}-${i}`}
                className="grid gap-1 border-l-4 border-[color:var(--blocked)] pl-3"
              >
                <p className={`${T.h3} text-[color:var(--fg)]`}>{fill(copy.title, item.values)}</p>
                <p className={T.body}>{fill(template, values)}</p>
                {"fix" in copy && copy.fix && hasValues(copy.fix, item.values) ? (
                  <p className={T.small}>{fill(copy.fix, item.values)}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </PanelBlock>
  );
}

/**
 * "What changes": what leaves, what arrives and what the request allows, in
 * the wallet's own words. An allowance moves nothing yet, so it gets its own
 * row with the spender written out in full.
 */
export function ChangeList({
  rows,
  approvals,
}: {
  rows: readonly CheckChange[];
  approvals: readonly CheckApproval[];
}): JSX.Element {
  return (
    <PanelBlock title={check.changes.title}>
      <div className="grid gap-2">
        {rows.length === 0 && approvals.length === 0 ? (
          <p className={T.body}>{check.changes.none}</p>
        ) : null}
        {/* ChangeRow's own note is a one-word qualifier; a sample's note is a
            sentence, so it goes on its own line where it can wrap. */}
        {rows.map((row) => (
          <div key={`${row.direction}-${row.unit}`}>
            <ChangeRow
              label={row.direction === "out" ? check.changes.out : check.changes.in}
              value={row.value}
              unit={row.unit}
              direction={row.direction}
            />
            {row.note ? <p className="text-sm text-[color:var(--caution)]">{row.note}</p> : null}
          </div>
        ))}
        {approvals.map((item) => (
          <div key={`${item.unit}-${item.spender}`}>
            <ChangeRow
              label={check.changes.allow}
              value={item.unlimited || item.amount === null ? check.changes.unlimited : item.amount}
              unit={item.unit}
            />
            <p className="font-mono text-sm text-[color:var(--fg)]">{item.spender}</p>
          </div>
        ))}
      </div>
      <p className={T.small}>{check.changes.disclaimer}</p>
    </PanelBlock>
  );
}

/** What the page claims about itself, next to what Baret actually checks. */
export function ClaimsList({
  claims,
}: {
  claims: readonly { claim: string; check: string }[];
}): JSX.Element {
  const { title, check: checks, note } = check.claims;
  return (
    <PanelBlock title={title}>
      <ul className="grid gap-4">
        {claims.map((item) => (
          <li key={item.claim} className="grid gap-1">
            <p className={`${T.body} text-[color:var(--fg)]`}>{item.claim}</p>
            <p className={T.small}>
              <span className="font-medium text-[color:var(--fg)]">{checks}: </span>
              {item.check}
            </p>
          </li>
        ))}
      </ul>
      <p className={T.small}>{note}</p>
    </PanelBlock>
  );
}

/** A short titled note: "If this were signed", "Take this with you". */
export function NoteBlock({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <PanelBlock title={title}>
      <p className={T.body}>{body}</p>
    </PanelBlock>
  );
}
