import { explain } from "@baret/content";
import { type JSX, type ReactNode, useEffect, useId, useState } from "react";
import type { Verdict } from "../lib/check-types.js";
import {
  defaultLanguage,
  EXPLAIN_LANGUAGES,
  type ExplainLanguage,
  useExplanation,
} from "../lib/explain.js";
import { T } from "../lib/type.js";
import { PanelBlock } from "./CheckBlocks.js";
import { Segment } from "./Segment.js";

/** How long the first wait stays invisible; a fast "no" from the server never shows. */
export const LOADING_DELAY_MS = 600;

/**
 * The model's plain-words reading of a verdict, under Baret's own findings.
 *
 * It renders nothing at all while it has nothing to show (no request id, no
 * key on the server, a failed or slow model), so without the model the screen is
 * exactly what it was before. The byline says the model only words
 * the verdict and cannot change it. An answer for another verdict than the
 * one on screen counts as unavailable (fail-closed). Once one answer has been
 * shown, a failed language keeps the frame and the switch, with a quiet line.
 * A failure is asked again at most once a minute (see useExplanation), so a
 * block that stayed hidden can still appear when the model answers later.
 */
export function PlainWordsBody({
  requestId,
  verdict,
  frame = (body) => body,
}: {
  requestId: string | null;
  /** The verdict on screen; an answer about any other is not shown. */
  verdict?: Verdict;
  /** Wraps the body; called only while there is something to show. */
  frame?: (body: ReactNode) => ReactNode;
}): ReactNode {
  const [language, setLanguage] = useState<ExplainLanguage>(() => defaultLanguage());
  const [shownFor, setShownFor] = useState<string | null>(null);
  const name = useId();
  const state = useExplanation(requestId, language);
  // The first wait shows nothing for a moment: with no key the server says no
  // at once, and the block must not flash in and out under the verdict.
  const [patient, setPatient] = useState(false);
  useEffect(() => {
    setPatient(false);
    if (requestId === null) return;
    const timer = setTimeout(() => setPatient(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [requestId]);
  const answer =
    state.status === "ready" && (verdict === undefined || state.answer.decision === verdict)
      ? state.answer
      : null;
  const failed = state.status !== "loading" && answer === null;
  // Remembers that this request has been worded once, so a later language
  // that fails keeps the switch the reader just used.
  if (answer && shownFor !== requestId) setShownFor(requestId);
  if (failed && (requestId === null || shownFor !== requestId)) return null;
  if (state.status === "loading" && !patient && shownFor !== requestId) return null;

  return frame(
    <div className="grid gap-4">
      <p className={T.small}>{explain.byline}</p>
      <fieldset className="grid gap-3">
        <legend className={T.label}>{explain.languageLabel}</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {EXPLAIN_LANGUAGES.map((code) => (
            <Segment
              key={code}
              name={name}
              value={code}
              checked={language === code}
              label={explain.languages[code]}
              onSelect={(value) => setLanguage(value as ExplainLanguage)}
              faceClassName="justify-center px-2"
            />
          ))}
        </div>
      </fieldset>
      {answer ? (
        <div lang={answer.language} className="grid gap-3">
          <p className="text-pretty text-base font-semibold leading-normal text-[color:var(--fg)]">
            <strong>{answer.explanation.headline}</strong>
          </p>
          <p className={T.body}>{answer.explanation.summary}</p>
          {answer.explanation.points.length > 0 ? (
            <ul className="grid list-disc gap-2 pl-5">
              {answer.explanation.points.map((point) => (
                <li key={point} className={T.body}>
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
          <p className={T.body}>{answer.explanation.advice}</p>
        </div>
      ) : failed ? (
        <p role="status" className={T.small}>
          {explain.unavailable}
        </p>
      ) : (
        // A plain line, no spinner: nothing moves, so reduced motion needs no branch.
        <p role="status" className={T.small}>
          {explain.loading}
        </p>
      )}
    </div>,
  );
}

/**
 * The block in a panel: a titled PanelBlock, or nothing when unavailable.
 * `wrap` goes around the block only when it renders, so an unavailable
 * answer leaves no empty wrapper (and no extra gap) behind.
 */
export function PlainWords({
  requestId,
  verdict,
  wrap = (block) => block,
}: {
  requestId: string | null;
  verdict?: Verdict;
  wrap?: (block: ReactNode) => ReactNode;
}): JSX.Element {
  return (
    <PlainWordsBody
      requestId={requestId}
      {...(verdict ? { verdict } : {})}
      frame={(body) => wrap(<PanelBlock title={explain.title}>{body}</PanelBlock>)}
    />
  );
}
