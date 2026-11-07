import { hub } from "@baret/content";

/**
 * The demo sites in the order the hub lists them. The cards live in
 * web/hub.content.ts, so a copy change reaches the hub, the landing and the
 * site itself at once.
 */
export const SCENARIOS = hub.sites;

export type Scenario = (typeof SCENARIOS)[number];
