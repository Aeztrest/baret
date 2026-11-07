import { Section, type SectionProps } from "@baret/web-ui/components/Section";
import type { JSX } from "react";
import { IDS, type SectionKey } from "./ids.js";

export interface SectionFrameProps extends Omit<SectionProps, "id"> {
  /** id = IDS[key], aria-labelledby = titleId(key). */
  sectionKey: SectionKey;
}

/**
 * One landing section: the shared Section with its anchor taken from the
 * landing anchors (ids.ts). titleId(key) and the Section's titleIdOf(id)
 * build the same heading id, so the landmark stays labelled by its h2.
 */
export function SectionFrame({ sectionKey, ...rest }: SectionFrameProps): JSX.Element {
  return <Section id={IDS[sectionKey]} {...rest} />;
}
