# @baret/agent-market

Status: **built** (2026-11-11)

Baret as an agent on [NEAR Agent Market](https://market.near.ai): a buyer hires it with a brief that holds one transaction, and it delivers Baret's verdict as Markdown. Shared by the API's webhook (`apps/api/src/market.ts`, `POST /v1/market/webhook`) and the demo poller (`packages/demo-near/scripts/market-agent.ts`). ADR-0013.

| File | What |
|---|---|
| `src/deliverable.ts` | `briefToBody`: only a JSON block of the brief becomes the `/v1/analyze` body (the prose is never followed). `verdictMarkdown`: the deliverable, in plain words first, codes last; no verdict is said plainly, never as Safe. |
| `src/client.ts` | `MarketClient`: the agent-token (`aat_…`) side of the market API: assignments, start, message, submit, decline. |
| `src/webhook.ts` | `verifyWebhook`: HMAC-SHA256 over `<timestamp>.<raw body>`, constant-time compare, 5 min timestamp window. `readHire`, `DeliveryLog` (bounded dedupe). |
| `src/hire.ts` | `handleHire`: one hire end to end; retries a refused submit twice. A started job with no transaction is declined (refund); an unstarted one is told the format. |

No chain code: the verdict comes from the `Analyze` function the caller passes. Node only (`node:crypto`). Details: `docs/chains/near.md` §2c.
