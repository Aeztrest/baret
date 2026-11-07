import { hub, scrybe } from "@baret/content";
import { VerdictTag } from "@baret/ui";
import { PanelBlock } from "@baret/web-ui/components/CheckBlocks";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import type { JSX } from "react";
import { runOf, SAMPLE, usdc } from "./sample.js";

/**
 * Scrybe's two blocks in Baret's panel. The run: every payment the agent
 * made under the picked cap, the hour's total after each, and the one that
 * was stopped. The bridge: the same caps for your own agent, on /agents.
 */

const { run } = scrybe.analysis;

/** "0.05 USDC": the amount with its unit, from the copy. */
const priced = (units: bigint): string => fill(scrybe.amount, { amount: usdc(units) });

export function Run({ cap }: { cap: bigint }): JSX.Element {
  return (
    <PanelBlock title={run.title}>
      <ol className="grid border-t border-[color:var(--rule)]">
        {runOf(cap).map((payment) => (
          <li
            key={payment.n}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[color:var(--rule)] py-2"
          >
            <span className="text-sm text-[color:var(--fg)]">
              {fill(run.payment, { n: String(payment.n) })}
            </span>
            {payment.paid ? (
              <span className="flex items-baseline gap-4">
                <span className={`${T.num} font-mono text-sm text-[color:var(--fg-muted)]`}>
                  {fill(run.total, { total: priced(payment.total) })}
                </span>
                <span className={T.label}>{run.paid}</span>
              </span>
            ) : (
              <span className="flex items-center gap-4">
                <span className={`${T.num} font-mono text-sm text-[color:var(--fg-muted)]`}>
                  {priced(SAMPLE.price)}
                </span>
                <VerdictTag kind="blocked" label={hub.cardLabels.verdicts.capped} />
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className={T.small}>{run.note}</p>
    </PanelBlock>
  );
}

export function AgentsBridge(): JSX.Element {
  const { cta } = scrybe;
  return (
    <PanelBlock title={cta.title}>
      <p className={T.body}>{cta.body}</p>
      <div className="flex">
        <LinkButton href={cta.action.href} label={cta.action.label} icon="arrow-right" newTab />
      </div>
    </PanelBlock>
  );
}
