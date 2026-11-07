import {
  SectionHeader as Header,
  type SectionHeaderProps as HeaderProps,
} from "@baret/web-ui/components/SectionHeader";
import type { JSX } from "react";
import { type SectionKey, titleId } from "./ids.js";

export { splitLead, TwoToneText } from "@baret/web-ui/components/SectionHeader";

export interface SectionHeaderProps extends Omit<HeaderProps, "titleId"> {
  /** The h2 id is titleId(key). */
  sectionKey: SectionKey;
}

/**
 * The landing's section heading: the shared SectionHeader with its id taken
 * from the landing anchors (ids.ts), so every landing section keeps its key.
 */
export function SectionHeader({ sectionKey, ...rest }: SectionHeaderProps): JSX.Element {
  return <Header titleId={titleId(sectionKey)} {...rest} />;
}
