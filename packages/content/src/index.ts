/**
 * @baret/content
 *
 * Every user-facing string in Baret. No markup, no styling, no logic. Today: the shared
 * strings (findings, rules, check results, common words, explain) and the web app's pages
 * (web/: landing, showcase). The other web pages, the wallet's and the extension's come with those screens (TASKS.md T2.3, T2.4).
 */
export type { FindingCode } from "@baret/core";
export type { CheckContent } from "./shared/check.content.js";
export { check } from "./shared/check.content.js";
export type { Common } from "./shared/common.content.js";
export { common } from "./shared/common.content.js";
export type { ExplainContent } from "./shared/explain.content.js";
export { explain } from "./shared/explain.content.js";
export type { FindingsContent } from "./shared/findings.content.js";
export { findings } from "./shared/findings.content.js";
export type { PolicyContent } from "./shared/policy.content.js";
export { policy } from "./shared/policy.content.js";
export type { DemoFrameContent } from "./web/demo.content.js";
export { demoFrame } from "./web/demo.content.js";
export type { HomeContent } from "./web/home.content.js";
export { home } from "./web/home.content.js";
export type { HubContent } from "./web/hub.content.js";
export { hub } from "./web/hub.content.js";
export type { AnalysisPanelContent } from "./web/panel.content.js";
export { analysisPanel } from "./web/panel.content.js";
export type * from "./web/types.js";
