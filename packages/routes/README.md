# @baret/routes

One shape for a route, one way to build a link, and the checks that keep a registry honest (no duplicate paths, no link in the copy that points nowhere). Data and functions only: no React, no router. Consumed as TypeScript source, never built.

Used by `apps/web` (its registry is `apps/web/src/routes.ts`) and, when they are ported, the extension's options page and a web wallet. Ported unchanged from Baret-Metropolis `packages/routes`. Design: `docs/architecture/frontend.md`.
