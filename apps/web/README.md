# apps/web

Baret's public site (Vite, React 19, React Router data mode, Tailwind v4, React Compiler). Deployed on Vercel; every route is prerendered at build time and hydrated in the browser.

Ported from the Metropolis showcase app, page by page (TASKS.md T2.4). Today: the landing (`/`), the showcase hub (`/showcase`) and the not-found page. The demo sites, `/agents`, `/docs`, `/partners` and `/install` follow; until then the links to them are listed in `PENDING_PATHS` (`src/routes.ts`) and answer with the not-found page.

```sh
pnpm --filter @baret/web dev      # http://localhost:5173, /api proxied to apps/api on :8080
pnpm --filter @baret/web build    # tsc, vite build, then scripts/prerender.mjs
```

- Words: `@baret/content` (`web/home.content.ts`, `shared/*`). Paths: the registry in `src/routes.ts`; nothing else writes a path.
- `scripts/head.mjs` and `scripts/route-heads.mjs` write each route's static head, `404.html`, the sitemap and the robots line. Set `BARET_SITE_URL` for a deploy (Vercel uses its production domain when it is unset).
- `middleware.ts` (Vercel Routing Middleware) marks `/api/*` requests with `BARET_EDGE_SECRET` and the visitor's address, so the API can rate-limit per visitor (`apps/api/src/client.ts`).
- `vercel.json`: install and build from the monorepo root, `/api/*` rewrite to the staging API, security headers, cache rules.

Docs: `docs/architecture/frontend.md`, `docs/operations/deployment.md`.
