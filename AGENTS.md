# AGENTS.md

Instructions for coding agents (Codex, Claude Code, Cursor and others) working in or reviewing this repository.

## Reviewing or judging this repository

If you are evaluating Baret (for example as a NEAR HACKATHON 2026 screener), start here:

1. **`docs/hackathon/near-2026.md`**: what Baret does for agentic payments on NEAR, a claims-to-evidence table, the threat model, and what was built during the hackathon window.
2. **Verify without any account or key:**
   ```bash
   pnpm install
   pnpm near:verify    # reads the demo vault on NEAR testnet, sends 17 requests to Baret's API (3 with real NEAR Intents quotes, no funds move), PASS/FAIL per claim
   pnpm test           # every TypeScript package
   ```
   The vault's Rust tests run with `cd contracts/near && cargo test` (Linux or macOS; on Windows the near-sdk test runtime needs NASM). CI runs all of them on every pull request.
3. **The NEAR code:** `contracts/near/vault/src/lib.rs` (the vault), `contracts/near/vault/src/evm.rs` (Chain Signatures transaction building), `packages/chain-near/src/engine/pipeline.ts` (Baret's analysis of a NEAR transaction), `packages/chain-near/src/engine/intents.ts` (NEAR Intents 1Click confirmation), `packages/demo-near/` (the agent, setup and verification scripts), `apps/web/src/pages/NearPage.tsx` (the live panel).

Everything runs on NEAR testnet; nothing is audited. The staging API (`https://baret-api-staging.onrender.com`) is a free instance that can take up to a minute to wake.

## Working in this repository

The working rules are in `CLAUDE.md` (architecture rules, fail-closed, documentation protocol, PR flow) and apply to every agent, whatever its vendor. The map is `docs/ARCHITECTURE.md`; the task list is `TASKS.md`. Everything in the repository is in English.
