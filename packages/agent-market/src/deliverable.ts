import { findings as findingText, simulationReasons } from "@baret/content";

/**
 * The deliverable of Baret's agent on NEAR Agent Market (market.near.ai, TN.10): a buyer
 * hires it with a brief that holds a transaction; it answers with Baret's verdict as Markdown.
 *
 * The brief is read, never obeyed: only a JSON block in it is used, and that block becomes
 * the body of one /v1/analyze call. Anything else in the brief is ignored.
 */

/** The /v1/analyze body a brief asks for, or null when the brief holds no request. */
export interface AnalyzeBody {
  chain: string;
  request: Record<string, unknown>;
  policyTemplate: string;
}

const TEMPLATES = new Set(["strict", "balanced", "permissive"]);

/** Every ```json fenced block, then the whole brief, as candidates. */
function candidates(brief: string): string[] {
  const out: string[] = [];
  for (const m of brief.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)) out.push(m[1] ?? "");
  out.push(brief.trim());
  return out;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Accepts `{chain, request, policyTemplate?}` as /v1/analyze takes it, or a bare NEAR
 * transaction `{signerId, receiverId, actions}` (checked on NEAR mainnet unless `chain`
 * says otherwise).
 */
export function briefToBody(brief: string): AnalyzeBody | null {
  for (const text of candidates(brief)) {
    const v = parse(text);
    if (!isObject(v)) continue;
    const policyTemplate =
      typeof v.policyTemplate === "string" && TEMPLATES.has(v.policyTemplate)
        ? v.policyTemplate
        : "balanced";
    if (typeof v.chain === "string" && isObject(v.request)) {
      return { chain: v.chain, request: v.request, policyTemplate };
    }
    if (
      typeof v.signerId === "string" &&
      typeof v.receiverId === "string" &&
      Array.isArray(v.actions)
    ) {
      const { chain, policyTemplate: _, ...tx } = v;
      return {
        chain: typeof chain === "string" ? chain : "near:mainnet",
        request: { kind: "transaction", tx },
        policyTemplate,
      };
    }
  }
  return null;
}

export interface Verdict {
  decision?: string;
  findings?: {
    code: string;
    severity?: string;
    blocking?: boolean;
    values?: Record<string, string>;
    details?: Record<string, unknown>;
  }[];
  estimatedChanges?: {
    account: string;
    asset?: { symbol?: string; decimals?: number };
    delta: string;
  }[];
  pinnedAt?: { kind?: string; value?: string };
  error?: { code?: string; message?: string };
}

type FindingCopy = { title?: string; body?: string; why?: string; fix?: string };

const fill = (text: string, values: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);

/** The finding's title from @baret/content, its placeholders filled; empty if unknown. */
export function findingTitle(code: string, values: Record<string, string> = {}): string {
  const entry = (findingText as Record<string, FindingCopy>)[code];
  return entry?.title ? fill(entry.title, values) : "";
}

/** Base units as a decimal string: 100000000000000000000000 at 24 decimals is "0.1". */
export function formatUnits(raw: string, decimals: number): string {
  const negative = raw.startsWith("-");
  const digits = (negative ? raw.slice(1) : raw).replace(/^0+/, "") || "0";
  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = decimals > 0 ? padded.slice(-decimals).replace(/0+$/, "") : "";
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

const near = (yocto: unknown): string =>
  typeof yocto === "string" && /^\d+$/.test(yocto) ? `${formatUnits(yocto, 24)} NEAR` : "an amount";

const code = (s: unknown): string => `\`${String(s)}\``;

/**
 * One sentence per action of a readable NEAR transaction: what it asks for, in words. The
 * vault's own methods and token transfers are named; any other call is described by its
 * method. A request that is not a readable NEAR transaction gets no sentences.
 */
export function describeRequest(request: Record<string, unknown>): string[] {
  const tx = request.tx;
  if (request.kind !== "transaction" || !isObject(tx) || !Array.isArray(tx.actions)) return [];
  const s = code(tx.signerId);
  const r = code(tx.receiverId);
  return tx.actions.filter(isObject).map((a): string => {
    const args = isObject(a.args) ? a.args : {};
    switch (a.type) {
      case "Transfer":
        return `${s} sends **${near(a.deposit)}** to ${r}.`;
      case "FunctionCall": {
        if (a.methodName === "execute_transfer" && typeof args.receiver === "string") {
          const what =
            args.asset === "native" || args.asset === undefined
              ? `**${near(args.amount)}**`
              : `${String(args.amount)} base units of ${code(args.asset)}`;
          return `${s} asks the vault ${r} to pay ${what} to ${code(args.receiver)}.`;
        }
        if (a.methodName === "request_evm_signature" && isObject(args.tx)) {
          return `${s} asks the vault ${r} to sign a payment on an EVM chain to ${code(args.tx.to)}.`;
        }
        if (
          (a.methodName === "ft_transfer" || a.methodName === "ft_transfer_call") &&
          typeof args.receiver_id === "string"
        ) {
          return `${s} asks the token contract ${r} to send ${String(args.amount)} base units to ${code(args.receiver_id)}.`;
        }
        const deposit =
          typeof a.deposit === "string" && /^[1-9]\d*$/.test(a.deposit)
            ? `, with **${near(a.deposit)}** attached`
            : "";
        return `${s} calls ${code(a.methodName)} on ${r}${deposit}.`;
      }
      case "AddKey":
        return a.accessKey === "FullAccess"
          ? `${s} adds a full access key to its own account: whoever holds that key controls the account.`
          : `${s} adds a limited key to its own account.`;
      case "DeleteKey":
        return `${s} removes a key from its own account.`;
      case "DeleteAccount":
        return `${s} deletes its account and sends what is left to ${code(a.beneficiaryId)}.`;
      case "Stake":
        return `${s} stakes **${near(a.stake)}**.`;
      case "CreateAccount":
        return `${s} creates the account ${r}.`;
      case "DeployContract":
        return `${s} deploys a contract to ${r}.`;
      default:
        return `${s} sends a ${code(a.type)} action to ${r}.`;
    }
  });
}

/** The first line under the verdict: what the reader should do, before any detail. */
const LEAD: Record<string, string> = {
  blocked: "**Do not sign this.** Baret found a problem that stops it. Nothing was signed or sent.",
  caution:
    "**Look before you sign.** Nothing broke a rule, but a check found something worth a look.",
  safe: "**No problem found.** Baret simulated it and checked it against the rules. This is a check, not a promise.",
};

const FINDINGS_HEADING: Record<string, string> = {
  blocked: "Why it was blocked",
  caution: "What to look at",
  safe: "Notes",
};

/**
 * The deliverable: Baret's verdict in Markdown, for a reader who is not a developer. It
 * says what to do first, then what the transaction tries to do, then why, in plain words
 * from @baret/content (a failed simulation names the refusal, such as the vault's), and
 * leaves the codes to the last line. No verdict is said plainly, never as Safe.
 */
export function verdictMarkdown(body: AnalyzeBody, v: Verdict | null): string {
  if (!v?.decision) {
    return [
      "# Baret: no verdict",
      "",
      `**No verdict** (${v?.error?.code ?? "Baret did not answer"}). Treat the transaction as not checked: do not sign it on this answer.`,
    ].join("\n");
  }
  const decision = v.decision;
  const verdictWord = decision.charAt(0).toUpperCase() + decision.slice(1);
  const lines = [`# Baret verdict: ${verdictWord}`, "", LEAD[decision] ?? LEAD.blocked ?? "", ""];

  const does = describeRequest(body.request);
  const prefix = `${body.chain}:`;
  const moves = (v.estimatedChanges ?? [])
    .filter((c) => /^-?\d+$/.test(c.delta) && c.delta !== "0")
    .map((c) => {
      const account = c.account.startsWith(prefix) ? c.account.slice(prefix.length) : c.account;
      const amount = formatUnits(c.delta.replace(/^-/, ""), c.asset?.decimals ?? 0);
      const asset = c.asset?.symbol ?? "units";
      return `If it went through, ${code(account)} would ${c.delta.startsWith("-") ? "lose" : "receive"} ${amount} ${asset}.`;
    });
  if (does.length > 0 || moves.length > 0) {
    lines.push("## What it tries to do", "");
    for (const d of [...does, ...moves]) lines.push(`- ${d}`);
    lines.push("");
  }

  const findings = v.findings ?? [];
  const codes: string[] = [];
  if (findings.length > 0) {
    lines.push(`## ${FINDINGS_HEADING[decision] ?? "Findings"}`, "");
    for (const f of findings) {
      const copy = (findingText as Record<string, FindingCopy>)[f.code] ?? {};
      const values = f.values ?? {};
      const reasonCode = typeof f.details?.reason === "string" ? f.details.reason : undefined;
      const reason = reasonCode
        ? (simulationReasons as Record<string, { body: string; fix?: string }>)[reasonCode]
        : undefined;
      lines.push(`### ${copy.title ? fill(copy.title, values) : f.code}`, "");
      const text = reason?.body ?? (copy.body ? fill(copy.body, values) : "");
      if (text) lines.push(text, "");
      if (!reason && copy.why) lines.push(`**Why this matters:** ${fill(copy.why, values)}`, "");
      const fix = reason?.fix ?? (copy.fix ? fill(copy.fix, values) : "");
      if (fix) lines.push(`**What to do:** ${fix}`, "");
      codes.push(
        `${code(f.code)} (${[reasonCode, f.severity].filter(Boolean).join(", ") || "no severity"})`,
      );
    }
  } else {
    lines.push("No check found a problem.", "");
  }

  const block =
    v.pinnedAt?.kind === "block" && v.pinnedAt.value ? `, at block ${v.pinnedAt.value}` : "";
  lines.push(
    "---",
    "",
    `Checked on ${code(body.chain)} under the ${body.policyTemplate} policy${block}.${codes.length > 0 ? ` Codes: ${codes.join(", ")}.` : ""} Baret reads the chain; it does not sign or send anything. https://github.com/Aeztrest/baret`,
  );
  return lines.join("\n");
}

/** One hire, as the worker needs it. */
export interface AssignmentRow {
  id: string;
  /** null: a fresh hire; set once anyone declared start. */
  startedAt: string | null;
  brief: string;
}

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * `GET /v1/agents/me/assignments` as rows. The documented shape is
 * `{ assignments: [{ assignment: { assignmentId, startedAt, … }, job: { description } }] }`
 * (docs.market.near.ai, "List your agent"); a flat row (`id`, `startedAt`, `job`) is read
 * too. A row with no id is skipped, and a row whose start state is unknown counts as
 * started, so the worker never starts a job it cannot identify.
 */
export function readAssignments(v: unknown): AssignmentRow[] {
  const list = Array.isArray(v)
    ? v
    : isObject(v) && Array.isArray(v.assignments)
      ? v.assignments
      : [];
  const out: AssignmentRow[] = [];
  for (const row of list) {
    if (!isObject(row)) continue;
    const a = isObject(row.assignment) ? row.assignment : row;
    const id = str(a.assignmentId) ?? str(a.id);
    if (!id) continue;
    const startedAt = a.startedAt === null ? null : (str(a.startedAt) ?? "unknown");
    const job = isObject(row.job) ? row.job : isObject(a.job) ? a.job : {};
    out.push({ id, startedAt, brief: str(job.description) ?? "" });
  }
  return out;
}

/** Sent right after start: buyers expect to hear the job was picked up. */
export const STARTED_MESSAGE =
  "Started. I am checking the transaction in your brief against the chain's current state; the verdict follows in a minute.";

const BRIEF_FORMAT = [
  "I check one transaction before it is signed. Put it in the brief as a JSON block:",
  "",
  "```json",
  '{ "chain": "near:mainnet", "request": { "kind": "transaction", "tx": { "signerId": "you.near", "receiverId": "shop.near", "actions": [{ "type": "Transfer", "deposit": "1000000000000000000000000" }] } } }',
  "```",
  "",
  "A bare NEAR transaction ({signerId, receiverId, actions}) works too. Chains: near:mainnet, near:testnet and the EVM chains Baret lists.",
].join("\n");

/** What a brief without a request is told by the poller, which has not started the job. */
export const BRIEF_HELP = `${BRIEF_FORMAT} I have not started the job, so you can cancel it for a full refund.`;

/**
 * What a brief without a request is told when the hire came by webhook: answering the
 * webhook counts as starting the job, so it is handed back (declined), which refunds the
 * buyer in full.
 */
export const BRIEF_DECLINED = `${BRIEF_FORMAT} I am handing this job back, which refunds you in full; hire me again with the transaction in the brief.`;

/** The reason a declined job carries (the market requires one from an agent). */
export const DECLINE_REASON = "The brief holds no transaction to check.";
