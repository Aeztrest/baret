import { findings as findingText } from "@baret/content";

/**
 * TN.10: Baret as an agent on NEAR Agent Market (market.near.ai). A buyer hires it with a
 * brief that holds a transaction; it answers with Baret's verdict as Markdown.
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
  }[];
  error?: { code?: string; message?: string };
}

/** The finding's title from @baret/content, its placeholders filled; empty if unknown. */
export function findingTitle(code: string, values: Record<string, string> = {}): string {
  const entry = (findingText as Record<string, { title?: string }>)[code];
  if (!entry?.title) return "";
  return entry.title.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `{${k}}`);
}

/** The deliverable: Baret's verdict in Markdown. No verdict is said plainly, never as Safe. */
export function verdictMarkdown(body: AnalyzeBody, v: Verdict | null): string {
  const lines = [
    `# Baret verdict`,
    "",
    `Chain: \`${body.chain}\` · policy: ${body.policyTemplate}`,
    "",
  ];
  if (!v?.decision) {
    lines.push(
      `**No verdict** (${v?.error?.code ?? "Baret did not answer"}). Treat the transaction as not checked: do not sign it on this answer.`,
    );
    return lines.join("\n");
  }
  lines.push(`**${v.decision.toUpperCase()}**`, "");
  const findings = v.findings ?? [];
  if (findings.length === 0) lines.push("No findings.");
  for (const f of findings) {
    const text = findingTitle(f.code, f.values);
    lines.push(
      `- \`${f.code}\`${f.severity ? ` (${f.severity})` : ""}${f.blocking ? " — blocks" : ""}${text ? `: ${text}` : ""}`,
    );
  }
  lines.push(
    "",
    "Baret reads the chain's state now and applies the policy above; it does not sign or send anything. https://github.com/Aeztrest/baret",
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

/** What a brief without a request is told, before any work starts. */
export const BRIEF_HELP = [
  "I check one transaction before it is signed. Put it in the brief as a JSON block:",
  "",
  "```json",
  '{ "chain": "near:mainnet", "request": { "kind": "transaction", "tx": { "signerId": "you.near", "receiverId": "wrap.near", "actions": [] } } }',
  "```",
  "",
  "A bare NEAR transaction ({signerId, receiverId, actions}) works too. Chains: near:mainnet, near:testnet and the EVM chains Baret lists. I have not started the job, so you can cancel it for a full refund.",
].join("\n");
