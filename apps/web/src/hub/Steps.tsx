import { hub } from "@baret/content";
import { Reveal } from "@baret/web-ui/components/Reveal";
import { Section, titleIdOf } from "@baret/web-ui/components/Section";
import { SectionHeader } from "@baret/web-ui/components/SectionHeader";
import { Segment } from "@baret/web-ui/components/Segment";
import { T } from "@baret/web-ui/lib/type";
import { fill } from "@baret/web-ui/lib/util";
import { type JSX, useId, useState } from "react";
import { HUB_ART } from "../shared/assets.js";
import { STRIP_FRAME, stripShift } from "./hub.js";

/**
 * How it works, one step at a time. A radio group picks the step. Under it
 * the picked step's drawing (cut from the strip, h-05) fills a large stage
 * and crossfades to the next one when the pick changes (300 ms, instant
 * under reduced motion). Beside it sit the step's counter, title and body,
 * then the four drawings as small thumbnails in step order, the picked one
 * framed and at full strength. One status region reads the title. Nothing
 * advances on its own.
 *
 * Live test 2026-10-14: four equal drawings side by side with a thin frame
 * hid which step was picked; the large stage makes the change obvious.
 */

const ID = "how-it-works";
const { steps } = hub;

/** One drawing cut from the strip: a window the size of one panel. */
function StepPanel({ index, className }: { index: number; className: string }): JSX.Element {
  return (
    <div
      className={`relative w-full overflow-hidden dark:brightness-[0.78] dark:contrast-[1.05] ${className}`}
      style={{ aspectRatio: STRIP_FRAME.ratio, backgroundColor: HUB_ART.steps.ground }}
    >
      <img
        src={HUB_ART.steps.src}
        width={HUB_ART.steps.width}
        height={HUB_ART.steps.height}
        alt=""
        decoding="async"
        loading="lazy"
        className="absolute left-0 h-auto max-w-none"
        style={{
          width: STRIP_FRAME.width,
          top: STRIP_FRAME.top,
          transform: `translateX(${stripShift(index)})`,
        }}
      />
    </div>
  );
}

const FADE = "transition-[opacity,transform] duration-300 motion-reduce:transition-none";

export function Steps(): JSX.Element {
  const name = useId();
  const [step, setStep] = useState(0);
  const [said, setSaid] = useState("");
  const current = steps.items[step] ?? steps.items[0];

  const pick = (value: string): void => {
    const next = Number(value);
    setStep(next);
    setSaid(steps.items[next]?.title ?? "");
  };

  return (
    <Section id={ID} ground="ground">
      <SectionHeader titleId={titleIdOf(ID)} title={steps.title} layout="stack" />
      <Reveal className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center lg:gap-x-12">
        <fieldset className="md:col-span-12">
          <legend className="sr-only">{steps.legend}</legend>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {steps.items.map((item, i) => (
              <Segment
                key={item.short}
                name={name}
                value={String(i)}
                checked={i === step}
                label={item.short}
                onSelect={pick}
              />
            ))}
          </div>
        </fieldset>

        {/* The stage: every drawing in one cell, only the picked one shown. */}
        <div
          aria-hidden="true"
          className="mx-auto grid w-full max-w-[360px] border border-[color:var(--fg)] md:col-span-5 md:max-w-none"
        >
          {steps.items.map((item, i) => (
            <StepPanel
              key={item.short}
              index={i}
              className={`[grid-area:1/1] ${FADE} ${
                i === step ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
              }`}
            />
          ))}
        </div>

        <div className="grid gap-4 md:col-span-7">
          <p className={T.label}>
            {fill(steps.counter, { n: String(step + 1), total: String(steps.items.length) })}
          </p>
          <h3 className={`${T.h3Large} text-[color:var(--fg)]`}>{current?.title}</h3>
          <p className={`${T.lead} max-w-[48ch]`}>{current?.body}</p>

          <ol aria-hidden="true" className="mt-2 grid max-w-[360px] grid-cols-4 gap-2">
            {steps.items.map((item, i) => (
              <li
                key={item.short}
                className={`border-2 ${FADE} ${
                  i === step
                    ? "border-[color:var(--accent)] opacity-100"
                    : "border-transparent opacity-40"
                }`}
              >
                <StepPanel index={i} className="" />
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
      <p role="status" className="sr-only">
        {said}
      </p>
    </Section>
  );
}
