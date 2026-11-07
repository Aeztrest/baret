# 0008 — Vercel + Render + GitHub Actions; `main` = staging, `release` = production

Status: Accepted
Date: 2026-11-07
Deciders: Ezgin (owner), 2026-11-07

## Context
All legacy repos used Vercel for web apps, Render for the API and GitHub Actions as the gate (Metropolis D-015). Metropolis deployed `main` straight to its only environment.

## Decision
Same providers. Two environments: `main` → staging (testnets); the `release` branch → production, moved only by the tag-triggered release workflow. Details: `docs/operations/ci-cd.md`, `docs/operations/deployment.md`.

## Consequences
A bad merge reaches staging, not users. Releases are explicit and reversible (move `release` back). Costs two Render services once production exists.

## Alternatives considered
Deploy on tag via deploy hooks (harder to pin a commit on Render); trunk-to-production (no staging).
