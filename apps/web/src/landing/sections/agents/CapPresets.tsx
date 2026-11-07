import { home } from "@baret/content";
import { Tag } from "@baret/ui/primitives/Tag";
import { Segment } from "@baret/web-ui/components/Segment";
import { T } from "@baret/web-ui/lib/type";
import { type JSX, useId, useState } from "react";
import { amount, announceCap, capProgress, capRun, capSentence, sampleLine } from "./capRun.js";

const { agents } = home;
const { demo } = agents;

/**
 * Daily-cap presets (IMPROVE H3), inside the budget row: a deterministic
 * sample run against four caps. Presets, not a slider: exact on touch and
 * 44 px targets with native radios. The result is one sentence, plus the
 * "Blocked at the cap" tag when the run is stopped. No meter, no count-up,
 * no timer: the numbers change in place (tabular figures) and the tag hang
 * is the only motion. A capped run leads with how far it got ("10 of 20
 * paid.") so the reader does not have to do the sum. The tag slot and the
 * sentence slot (sized to the longest real string per breakpoint) keep their
 * height, so fits and capped never shift the page.
 */
export function CapPresets(): JSX.Element {
  const name = useId();
  const [cap, setCap] = useState<number>(demo.initial);
  const [said, setSaid] = useState("");
  const capped = capRun(demo.price, demo.run, cap).kind === "capped";
  const progress = capProgress(cap);

  const pick = (value: string) => {
    const next = Number(value);
    setCap(next);
    setSaid(announceCap(next));
  };

  return (
    <div data-demo="cap-presets" className="mt-5">
      <p className={T.small}>{sampleLine()}</p>
      <fieldset className="mt-4">
        <legend className={T.label}>{demo.legend}</legend>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {demo.presets.map((preset) => (
            <Segment
              key={preset}
              name={name}
              value={String(preset)}
              checked={preset === cap}
              label={amount(preset)}
              onSelect={pick}
              faceClassName={`justify-center whitespace-nowrap px-1 text-center max-[359px]:text-xs ${T.num}`}
            />
          ))}
        </div>
      </fieldset>
      <div data-result={capped ? "capped" : "fits"} className="mt-4">
        <div className="h-7">
          {capped ? (
            <Tag key={cap} tone="blocked" hang>
              {demo.capped}
            </Tag>
          ) : null}
        </div>
        <p className={`${T.body} ${T.num} mt-2 min-h-[3lh] lg:min-h-[2lh] text-[color:var(--fg)]`}>
          {progress ? <span className="font-medium">{progress} </span> : null}
          {capSentence(cap)}
        </p>
      </div>
      <p className={`${T.small} mt-2`}>{demo.previewLabel}</p>
      <p role="status" className="sr-only">
        {said}
      </p>
    </div>
  );
}
