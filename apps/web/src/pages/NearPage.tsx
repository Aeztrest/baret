import { getChain } from "@baret/chains";
import { common, findings, near } from "@baret/content";
import type { Verdict } from "@baret/core";
import {
  demoAccounts,
  demoAnalyzeBody,
  explorerAccount,
  formatNear,
  readVault,
  type ScenarioName,
  type VaultState,
} from "@baret/demo-near";
import { Tag } from "@baret/ui/primitives/Tag";
import { Verdict as VerdictBlock, type VerdictKind } from "@baret/ui/primitives/Verdict";
import { LinkButton } from "@baret/web-ui/components/LinkButton";
import { Section, titleIdOf } from "@baret/web-ui/components/Section";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, useCallback, useEffect, useState } from "react";
import { ClosingBand } from "../shared/ClosingBand.js";
import { PageHero } from "../shared/PageHero.js";
import { ANALYZE_URL } from "../sites/kit/live.js";

/**
 * /near, the NEAR agent demo panel (TASKS.md TN.9). Four blocks: the claim, the two
 * lines of defence, the vault read live from NEAR testnet, the agent's four requests
 * checked live by Baret, and the recorded runs. Every word comes from near.content.ts;
 * every account id from the registry (@baret/chains through @baret/demo-near).
 *
 * Fail-closed in the UI too: a vault that cannot be read shows no numbers, and a
 * request Baret does not answer shows as "the agent would not sign".
 */

const ACCOUNTS = demoAccounts();
const CARD = "border border-[color:var(--rule)] bg-[color:var(--surface,transparent)] p-5";

function Flow(): JSX.Element {
  const steps = [
    { label: near.vault.labels.agent, value: ACCOUNTS.agent },
    { label: "Baret", value: "POST /v1/analyze" },
    { label: near.vault.labels.account, value: ACCOUNTS.vault },
    { label: near.vault.labels.receivers, value: ACCOUNTS.shop },
  ];
  return (
    <ol className="grid gap-3">
      {steps.map((s, i) => (
        <li key={s.label} className={`${CARD} flex items-baseline gap-4`}>
          <span className={`${T.label} ${T.num}`} data-numeric="">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="grid min-w-0 gap-1">
            <span className={T.label}>{s.label}</span>
            <span className="truncate font-mono text-sm text-[color:var(--fg)]">{s.value}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Heading({ id, title, body }: { id: string; title: string; body?: string }): JSX.Element {
  return (
    <div className="mb-8 max-w-[60ch]">
      <h2 id={titleIdOf(id)} className={`${T.h2} text-[color:var(--fg)]`}>
        {title}
      </h2>
      {body ? <p className={`${T.lead} mt-4`}>{body}</p> : null}
    </div>
  );
}

function Layers(): JSX.Element {
  return (
    <Section id="layers">
      <Heading id="layers" title={near.layers.title} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {near.layers.items.map((item) => (
          <article key={item.title} className={CARD}>
            <p className={T.label}>{item.label}</p>
            <h3 className={`${T.h3} mt-2 text-[color:var(--fg)]`}>{item.title}</h3>
            <p className={`${T.body} mt-3`}>{item.body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: JSX.Element | string }): JSX.Element {
  return (
    <div className="grid gap-1 border-t border-[color:var(--rule)] py-3 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className={T.label}>{label}</dt>
      <dd className="min-w-0 break-words text-[color:var(--fg)]">{children}</dd>
    </div>
  );
}

function AccountLink({ id }: { id: string }): JSX.Element {
  return (
    <a
      href={explorerAccount(id)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-sm underline underline-offset-4"
    >
      {id}
    </a>
  );
}

function amount(yocto: bigint): string {
  return `${formatNear(yocto)} ${near.vault.unit}`;
}

function VaultPanel(): JSX.Element {
  const { vault: copy } = near;
  const [state, setState] = useState<VaultState | "loading" | "failed">("loading");
  const load = useCallback(() => {
    setState("loading");
    readVault(ACCOUNTS.vault).then(setState, () => setState("failed"));
  }, []);
  useEffect(load, [load]);

  const native =
    typeof state === "object" ? state.limits.find((l) => l.asset === "native") : undefined;
  return (
    <Section id="vault" ground="deep">
      <Heading id="vault" title={copy.title} body={copy.body} />
      <div className={CARD} aria-live="polite" aria-busy={state === "loading"}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Tag tone="neutral" size="sm">
            NEAR testnet
          </Tag>
          {typeof state === "object" ? (
            <Tag tone={state.paused ? "blocked" : "safe"} size="sm">
              {state.paused ? copy.paused : copy.active}
            </Tag>
          ) : null}
        </div>
        {state === "loading" ? <p className={T.body}>{copy.loading}</p> : null}
        {state === "failed" ? (
          <div className="grid gap-3">
            <p className={T.body}>{copy.failed}</p>
            <button type="button" onClick={load} className="justify-self-start underline">
              {copy.retry}
            </button>
          </div>
        ) : null}
        {typeof state === "object" ? (
          <dl>
            <Row label={copy.labels.account}>
              <AccountLink id={ACCOUNTS.vault} />
            </Row>
            <Row label={copy.labels.owner}>
              <AccountLink id={state.owner} />
            </Row>
            <Row label={copy.labels.agent}>
              <span className="grid gap-1">
                {state.agents.map((a) => (
                  <AccountLink key={a} id={a} />
                ))}
              </span>
            </Row>
            <Row label={copy.labels.receivers}>
              <span className="grid gap-1">
                {state.receivers.map((r) => (
                  <AccountLink key={r} id={r} />
                ))}
              </span>
            </Row>
            {native ? (
              <>
                <Row label={copy.labels.perTransfer}>{amount(native.perTransfer)}</Row>
                <Row label={copy.labels.perDay}>{amount(native.perDay)}</Row>
              </>
            ) : null}
            <Row label={copy.labels.spent}>{amount(state.spentToday)}</Row>
            <Row label={copy.labels.next}>{amount(state.nextTransferMax)}</Row>
            <Row label={copy.labels.balance}>{amount(state.balance)}</Row>
            <Row label={copy.labels.version}>{state.version ?? "0.1.0"}</Row>
            <Row label={copy.labels.keys}>
              {state.accessKeys === 0 ? copy.locked : `${state.accessKeys}. ${copy.unlocked}`}
            </Row>
            <Row label={copy.labels.block}>{state.block.toLocaleString("en-US")}</Row>
          </dl>
        ) : null}
      </div>
    </Section>
  );
}

type Answer = Verdict | "asking" | "failed";

async function ask(name: ScenarioName): Promise<Verdict> {
  const res = await fetch(ANALYZE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(demoAnalyzeBody(name)),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const { verdictSchema } = await import("@baret/core");
  return verdictSchema.parse(await res.json());
}

function titleOf(code: string): string {
  return (findings as Record<string, { title: string } | undefined>)[code]?.title ?? code;
}

function RequestCard({ item }: { item: (typeof near.requests.items)[number] }): JSX.Element {
  const { requests: copy } = near;
  const [answer, setAnswer] = useState<Answer | null>(null);
  const run = () => {
    setAnswer("asking");
    ask(item.id).then(setAnswer, () => setAnswer("failed"));
  };
  const verdict = typeof answer === "object" && answer !== null ? answer : null;
  const kind: VerdictKind | null = verdict
    ? verdict.decision
    : answer === "failed"
      ? "unreachable"
      : null;
  return (
    <article className={`${CARD} grid content-start gap-3`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={`${T.h3} text-[color:var(--fg)]`}>{item.title}</h3>
        <Tag tone={item.expected} size="sm">
          {`${copy.expected}: ${common.verdicts[item.expected].short}`}
        </Tag>
      </div>
      <p className={T.body}>{item.body}</p>
      <button
        type="button"
        onClick={run}
        disabled={answer === "asking"}
        className="justify-self-start border border-[color:var(--fg)] px-4 py-2 font-mono text-sm uppercase disabled:opacity-60"
      >
        {answer === "asking" ? copy.asking : copy.ask}
      </button>
      {kind ? (
        <VerdictBlock
          kind={kind}
          label={common.verdicts[kind].label}
          body={answer === "failed" ? copy.failed : common.verdicts[kind].line}
        >
          {verdict && verdict.findings.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-sm">
              {verdict.findings.map((f) => {
                const reason = (f.details as { reason?: unknown } | undefined)?.reason;
                return (
                  <li key={f.code}>
                    {titleOf(f.code)}
                    {typeof reason === "string" ? (
                      <span className="font-mono text-[color:var(--fg-muted)]">{` (${copy.reason}: ${reason})`}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </VerdictBlock>
      ) : null}
    </article>
  );
}

function Requests(): JSX.Element {
  return (
    <Section id="requests">
      <Heading id="requests" title={near.requests.title} body={near.requests.body} />
      <div className="grid gap-4 md:grid-cols-2">
        {near.requests.items.map((item) => (
          <RequestCard key={item.id} item={item} />
        ))}
      </div>
    </Section>
  );
}

/** A recorded transaction's explorer page, from its chain's registry entry. */
function txHref(chain: string, hash: string): string | null {
  return getChain(chain)?.explorer.tx.replace("{hash}", hash) ?? null;
}

function Runs(): JSX.Element {
  const { runs } = near;
  return (
    <Section id="runs" ground="deep">
      <Heading id="runs" title={runs.title} body={runs.body} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <thead>
            <tr className={T.label}>
              <th className="py-2 pr-4 font-normal">{runs.head.request}</th>
              <th className="py-2 pr-4 font-normal">{runs.head.baret}</th>
              <th className="py-2 font-normal">{runs.head.chain}</th>
            </tr>
          </thead>
          <tbody>
            {runs.rows.map((r) => (
              <tr key={r.title} className="border-t border-[color:var(--rule)] align-top">
                <td className="py-3 pr-4 text-[color:var(--fg)]">{r.title}</td>
                <td className="py-3 pr-4">{r.baret}</td>
                <td className="py-3">
                  <span className="block">{r.chain}</span>
                  {r.txs.map((t) => {
                    const href = txHref(t.chain, t.hash);
                    return href ? (
                      <a
                        key={t.hash}
                        className="mr-4 underline underline-offset-4"
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {runs.viewTx.replace("{label}", t.label)}
                      </a>
                    ) : null;
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function Component(): JSX.Element {
  const { hero, cta } = near;
  return (
    <div className="overflow-x-clip">
      <PageHero
        title={hero.title}
        body={hero.body}
        actions={
          <>
            <LinkButton
              href={hero.actions.primary.href}
              label={hero.actions.primary.label}
              variant="primary"
              size="lg"
              icon="arrow-down"
              fullOnPhone
            />
            <LinkButton
              href={hero.actions.secondary.href}
              label={hero.actions.secondary.label}
              variant="ghost"
              size="lg"
              fullOnPhone
            />
          </>
        }
        after={<p className={T.small}>{hero.notice}</p>}
        picture={<Flow />}
      />
      <Layers />
      <VaultPanel />
      <Requests />
      <Runs />
      <ClosingBand
        title={cta.title}
        body={cta.body}
        primary={cta.actions.primary}
        secondary={cta.actions.secondary}
      />
    </div>
  );
}
