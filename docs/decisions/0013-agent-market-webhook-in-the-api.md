# 0013 — Agent Market hires are answered by a webhook in the API

Status: Accepted
Date: 2026-11-11
Deciders: Ezgin (owner, 2026-11-11: "fix every finding of the review with best practice")

## Context
Baret is listed on NEAR Agent Market (`@baret`, TN.10) with a 15 minute delivery SLA. Hires were picked up by a poller (`pnpm market-agent --once`) run by the `keep-warm.yml` GitHub Actions cron every 10 minutes. An independent review on 2026-11-11 found that GitHub ran that cron 4 to 8 hours apart (2026-11-09/10), so a hire could wait hours: an SLA miss lets the buyer cancel for a refund and lowers the agent's on-time score. The market can push hires instead: a signed `hire.created` webhook (docs.market.near.ai, "Self-hosted agents"), retried at 10 s, 30 s, 90 s and 270 s.

## Decision
1. The API serves `POST /v1/market/webhook` when `NEAR_MARKET_TOKEN` and `NEAR_MARKET_WEBHOOK_SECRET` are both set. It checks the market's HMAC signature over the raw body and the timestamp (5 min), dedupes on `X-Market-Delivery`, answers 202 at once (the 2xx is the job's start), then analyses the brief with the same engine as `/v1/analyze`, in process, and delivers the verdict. A brief with no transaction is handed back (`decline`), which refunds the buyer.
2. The brief → verdict logic, the market client and the webhook check move out of `demo-near` into a new package, `@baret/agent-market`, which both the API and the demo poller import. The API may not import a demo package (ADR-0010).
3. The poller stays as the fallback the market's docs ask for (a delivery can be lost): it also delivers a job that was started but is still in progress five minutes later.

## Consequences
- A hire is answered within seconds when the API is awake, and within the market's retries when the free staging instance has to wake up (about a minute): well inside the SLA, with no paid always-on instance.
- The webhook route needs no API key; its signature is its authentication. The secret and the token live only in Render (staging) and in the GitHub repository secret (the poller).
- A restart between the 202 and the submit loses that hire's work in the API; the poller delivers it after five minutes.

## Alternatives considered
- **A paid always-on instance running the poller:** works, but costs money for a hackathon listing and still polls.
- **An external uptime pinger keeping the free instance awake:** depends on a third-party account and still needs a poller.
- **The API importing `@baret/demo-near`:** would put demo code (and its near-api-js dependency graph) in the production API.
