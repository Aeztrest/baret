/**
 * @baret/agent-market: Baret as an agent on NEAR Agent Market (TN.10, TN.13).
 *
 *   deliverable.ts  a hire's brief → one /v1/analyze body; a verdict → the Markdown delivered
 *   client.ts       the agent-token side of the market API (assignments, start, message,
 *                   submit, decline)
 *   webhook.ts      webhook signature check, the hire in `hire.created`, delivery dedupe
 *   hire.ts         one hire end to end, shared by the API's webhook and the demo poller
 *
 * Node only (webhook.ts uses node:crypto). No chain code: the verdict comes from whatever
 * `Analyze` the caller passes (the API's engine in process, or the API over HTTP).
 */
export { MARKET_API_DEFAULT, MarketClient, MarketError } from "./client.js";
export {
  type AnalyzeBody,
  type AssignmentRow,
  BRIEF_DECLINED,
  BRIEF_HELP,
  briefToBody,
  DECLINE_REASON,
  describeRequest,
  findingTitle,
  formatUnits,
  readAssignments,
  STARTED_MESSAGE,
  type Verdict,
  verdictMarkdown,
} from "./deliverable.js";
export { type Analyze, type HireOutcome, handleHire } from "./hire.js";
export {
  DeliveryLog,
  type Hire,
  readHire,
  verifyWebhook,
  WEBHOOK_TOLERANCE_SECONDS,
  type WebhookHeaders,
} from "./webhook.js";
