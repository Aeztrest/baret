# @baret/web-ui

The web-only signature layer for `apps/web` (and a future web wallet): the type scale, the layout frame, motion and reveals, smooth scroll, the eyelet cursor, the self-hosted fonts and the blocks that lay out one check's result (`CheckBlocks`). Consumed as TypeScript source, never built.

- `./components/*`, `./lib/*`, `./styles/*`: imported by path, for example `@baret/web-ui/components/CheckBlocks`.
- `./vite`: a Vite plugin (`webUiFonts()`) that serves `fonts/` at `/fonts` in dev and writes them to `dist/fonts` in a build.
- Words come from `@baret/content` (`shared/check`, `shared/findings`, `common`), tokens and primitives from `@baret/ui`. No chain library, no chain names.
- `lib/check.ts` runs a check fail-closed: an error or a timeout resolves as Blocked.
- `lib/explain.ts` is the client of `/v1/explain`; the route is not ported yet (TASKS.md T2.7), and until it answers the block renders nothing.

Ported from Baret-Metropolis `packages/web-ui`. Design: `docs/architecture/frontend.md`.
