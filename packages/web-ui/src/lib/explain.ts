import { useEffect, useSyncExternalStore } from "react";
import type { Verdict } from "./check-types.js";

/**
 * The client side of /v1/explain: the model's plain-words reading of a verdict
 * (docs/architecture/api.md, TASKS.md T2.7: the route is not ported yet).
 *
 * Every failure (no key on the server, a slow model, a bad answer) ends as
 * "unavailable", and the block then renders nothing, so the screen reads
 * exactly as it did before the model existed. The answer is checked
 * by hand: web-ui has no zod and no @baret/guard dependency.
 */

export type ExplainLanguage = "en" | "tr" | "zh";

export const EXPLAIN_LANGUAGES: readonly ExplainLanguage[] = ["en", "tr", "zh"];

/** Both apps reach the server at /api: the Vite proxy in dev, a Vercel rewrite in production. */
export const EXPLAIN_URL = "/api/v1/explain";

/** The server gives the model 28 s; past 32 s the block gives up quietly. */
const TIMEOUT_MS = 32_000;

export interface ExplainAnswer {
  decision: Verdict;
  explanation: {
    headline: string;
    summary: string;
    points: string[];
    advice: string;
  };
  language: ExplainLanguage;
  model: { provider: string; name: string };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length >= 1 && v.length <= max;

const isLanguage = (v: unknown): v is ExplainLanguage =>
  EXPLAIN_LANGUAGES.includes(v as ExplainLanguage);

/** The /v1/explain answer, or null for anything that is not exactly it. */
export function parseExplainAnswer(body: unknown): ExplainAnswer | null {
  if (!isObject(body)) return null;
  const { decision, explanation: e, language, model } = body;
  if (decision !== "safe" && decision !== "caution" && decision !== "blocked") return null;
  if (!isLanguage(language) || !isObject(e) || !isObject(model)) return null;
  if (!text(e.headline, 160) || !text(e.summary, 900) || !text(e.advice, 320)) return null;
  const { points } = e;
  if (!Array.isArray(points) || points.length > 8 || !points.every((p) => text(p, 320))) {
    return null;
  }
  if (typeof model.provider !== "string" || typeof model.name !== "string") return null;
  return {
    decision,
    explanation: {
      headline: e.headline,
      summary: e.summary,
      points: [...points],
      advice: e.advice,
    },
    language,
    model: { provider: model.provider, name: model.name },
  };
}

/**
 * One ask to the server: the answer, or a failure with the HTTP status (0 for
 * a network error, an abort or a timeout) and the body's `error` code when
 * the body parses. A 2xx with a bad body is a failure with that status.
 */
export type ExplainResult =
  | { ok: true; answer: ExplainAnswer }
  | { ok: false; status: number; code: string | null };

async function errorCode(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    return isObject(body) && typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

/** Asks the server once. Never throws. */
export async function fetchExplanation(
  requestId: string,
  language: ExplainLanguage,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<ExplainResult> {
  let res: Response;
  try {
    res = await fetchImpl(EXPLAIN_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, language }),
      signal: signal ?? null,
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (!res.ok) return { ok: false, status: res.status, code: await errorCode(res) };
  try {
    const answer = parseExplainAnswer(await res.json());
    if (answer) return { ok: true, answer };
  } catch {
    // A body that is not JSON is a bad body.
  }
  return { ok: false, status: res.status, code: null };
}

/** The reader's language when it is one the model writes, else English. SSR-safe. */
export function defaultLanguage(
  tag: string | undefined = typeof navigator === "undefined" ? undefined : navigator.language,
): ExplainLanguage {
  const t = (tag ?? "").toLowerCase();
  if (t.startsWith("tr")) return "tr";
  if (t.startsWith("zh")) return "zh";
  return "en";
}

export type ExplainState =
  | { status: "loading"; answer: null }
  | { status: "unavailable"; answer: null }
  | { status: "ready"; answer: ExplainAnswer };

/**
 * At most one new ask per requestId and language in this window. Every ask
 * spends the server's shared daily model budget.
 */
export const EXPLAIN_RETRY_MS = 60_000;

/** Real answers per requestId and language; one is never asked for again. */
const cache = new Map<string, ExplainAnswer>();

/**
 * The last failed ask per requestId and language. `final` marks a verdict
 * the server no longer has (404 verdict_unknown), which is never asked again.
 */
const failures = new Map<string, { at: number; final: boolean }>();

const key = (requestId: string, language: ExplainLanguage) => `${requestId}\u0000${language}`;

/**
 * Every mounted block reads the two maps above, so each change is announced:
 * a block that did not make the ask (the same request shown twice, or a
 * block mounted while another one asked) still re-renders with the result.
 */
const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => version;

/** Test hook: forget every answer and every failure. */
export function clearExplainCache(): void {
  cache.clear();
  failures.clear();
  changed();
}

/**
 * What the maps hold for one key. `_version` is the store's version: passing
 * it makes the read depend on it, so a memoizing compiler (the apps build
 * with the React Compiler) reads the maps again after every change.
 */
function settled(
  requestId: string | null,
  language: ExplainLanguage,
  _version: number,
): ExplainState | null {
  if (requestId === null) return { status: "unavailable", answer: null };
  const k = key(requestId, language);
  const answer = cache.get(k);
  if (answer) return { status: "ready", answer };
  return failures.has(k) ? { status: "unavailable", answer: null } : null;
}

/**
 * The model's reading of one verdict in one language. Aborts on a change of
 * request or language and on unmount; a null requestId is unavailable.
 *
 * A failure is not kept for good. While the hook stays on a key that failed,
 * it asks once more when the minute since the last ask is up, and then
 * stops. A key that failed less than a minute ago settles as unavailable at
 * once, with no ask. A 404 verdict_unknown is never asked again.
 */
export function useExplanation(requestId: string | null, language: ExplainLanguage): ExplainState {
  const version = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (requestId === null) return;
    const k = key(requestId, language);
    if (cache.has(k)) return;
    // An abort from a change or unmount sets `cancelled` first, so it records
    // nothing. The timeout aborts too, and that records a failure (status 0).
    let cancelled = false;
    let retried = false;
    let controller: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const last = failures.get(k);
      if (!last || last.final || retried) return;
      retried = true;
      const wait = last.at + EXPLAIN_RETRY_MS - Date.now();
      retry = setTimeout(ask, Math.max(0, wait));
    };

    function ask() {
      const c = new AbortController();
      controller = c;
      timeout = setTimeout(() => c.abort(), TIMEOUT_MS);
      void fetchExplanation(requestId as string, language, c.signal).then((result) => {
        clearTimeout(timeout);
        if (cancelled) return;
        if (result.ok) {
          cache.set(k, result.answer);
          failures.delete(k);
        } else {
          const final = result.status === 404 && result.code === "verdict_unknown";
          failures.set(k, { at: Date.now(), final });
          schedule();
        }
        changed();
      });
    }

    const last = failures.get(k);
    if (!last) ask();
    else if (!last.final && Date.now() - last.at >= EXPLAIN_RETRY_MS) ask();
    else schedule();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearTimeout(retry);
      controller?.abort();
    };
  }, [requestId, language]);

  return settled(requestId, language, version) ?? { status: "loading", answer: null };
}
