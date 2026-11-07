# @baret/content

Every user-facing string in Baret. No markup, no styling, no logic. The engine sends codes and values; the words live here (docs/architecture/engine.md §4).

**Today:** the shared strings, ported from Baret-Metropolis and made chain-neutral (2026-11-07):

| File | What it holds |
|---|---|
| `src/shared/findings.content.ts` | One entry per finding code in `@baret/core` (title, body, why, fix, placeholders). The compiler refuses a missing or unknown code. v1 keys renamed to the unified v2 codes; 11 new entries (x402 amount / network / shape / facilitator, six Stellar codes, one Casper code). |
| `src/shared/policy.content.ts` | One row per GuardPolicy v2 rule (dotted path), the templates and the editor. Family rules carry `families`. Which codes a rule decides is **not** listed here any more: the UI reads `FINDING_SPECS` from `@baret/core`. |
| `src/shared/common.content.ts` | Words any screen needs (verdicts, errors, network kinds). Chain names come from `@baret/chains`. |
| `src/shared/explain.content.ts` | Labels for the explanation view. |

The web app's, the wallet's and the extension's page strings come with those apps (TASKS.md T2.3, T2.4).

Chain-neutral means: no chain, coin or provider named in a shared string unless the code is family-only. Amounts name their asset through `{asset}` (x402 caps now do too); the native coin through `{native}`.

## Conventions

- One file per page, named `<page>.content.ts`.
- Each file exports one const named after the page, plus its inferred type:
  ```ts
  export const home = { ... } as const;
  export type HomeContent = typeof home;
  ```
- `as const` everywhere, so a typo in a key is a build error at the call site.
- Keys describe the slot, not the words: `hero.title`, not `hero.readFirstThenSign`.
- Never put a component, a class name, an icon name or a URL path in here. A `href` is allowed when the link is part of the copy.
- Every screen that can be empty has an `empty`. Every screen that can fail has an `errors`.
- Numbers that appear in copy live here as strings so the writer controls the formatting.

## Writing rules

From `Baret-Metropolis/docs/BRAND.md` (its brand section moves to docs/architecture/frontend.md with T2.1) section 09. The linter enforces the mechanical ones.

- Say what happened. Say what the reader can do. Stop.
- Second person. Active voice. Present tense.
- One idea per sentence. Under 30 words, usually under 15.
- No em dashes, no en dashes, no ellipsis characters, no curly quotes.
- No banned words: revolutionary, seamless, empower, leverage, robust, unlock the power, peace of mind, and the rest of the list in `scripts/lint-copy.mjs`.
- Never say "safe" as a promise. Say what was checked.
- Errors name the rule that fired and the option the reader has.
- Empty states are reassuring and actionable, never apologetic.
- English only. The repo has no Turkish in any file.

## Checks

```bash
pnpm --filter @baret/content typecheck    # tsc --noEmit
pnpm --filter @baret/content lint:copy    # em dashes, banned words, long sentences, Turkish
```

Run both before committing copy.
