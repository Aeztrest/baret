import { webUiFonts } from "@baret/web-ui/vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin, runnerImport } from "vite";

/**
 * Vite 8 runs on Rolldown, so the options are `oxc` and `rolldownOptions`
 * rather than `esbuild` and `rollupOptions`.
 *
 * React Compiler goes through Babel rather than the plugin's native `compiler`
 * flag. The native path is faster but is still marked experimental, and this
 * is the exact compiler the React team documents. Revisit when the flag loses
 * the experimental label.
 *
 * The static head (IMPROVE G1: title, description, og:*, twitter:card and the
 * LCP preload for link-preview bots) and the per-route heads, sitemap and
 * robots line (G4, G5) come from `baretHead()` in scripts/head.mjs. That file
 * reads @baret/content and assets.ts, which are TypeScript with `.js`
 * specifiers that Node's native loader (used for this config) cannot resolve,
 * so it goes through Vite's module runner instead of a static import.
 *
 * BARET_SITE_URL is read inside that plugin with loadEnv, not by widening
 * `envPrefix`: a `BARET_` prefix would expose every BARET_* variable to
 * client code, and the client never needs the site URL.
 */
async function baretHead(root: string): Promise<Plugin> {
  const { module } = await runnerImport<{ baretHead: () => Plugin }>("./scripts/head.mjs", {
    root,
    configFile: false,
  });
  return module.baretHead();
}

export default defineConfig({
  plugins: [
    // Vite awaits a promised plugin, so the config itself stays synchronous.
    baretHead(import.meta.dirname),
    // The self-hosted faces at /fonts, shared with the wallet (packages/web-ui).
    webUiFonts(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],

  resolve: {
    // Native replacement for vite-tsconfig-paths, new in Vite 8.
    tsconfigPaths: true,
  },

  server: {
    port: 5173,
    proxy: {
      // The analysis server during development. apps/api, `pnpm --filter @baret/api dev`.
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },

  build: {
    target: "baseline-widely-available",
    // Read by scripts/route-heads.mjs to preload each route's own chunks,
    // then deleted from dist.
    manifest: true,
    // A security product does not publish its source (E4). "hidden" still
    // wrote every .map into dist, where anyone could fetch it by URL, so maps
    // are off by default. BARET_SOURCEMAPS=1 turns them back on for a build
    // whose next step uploads them to an error tracker and deletes them; no
    // such tracker is wired yet.
    sourcemap: process.env.BARET_SOURCEMAPS === "1" ? "hidden" : false,
    rolldownOptions: {
      onLog(level, log, handler) {
        // routes.ts keeps a lazy `load` for "/" because the registry contract,
        // `warm` and the route test need one, while router.tsx renders the
        // landing statically (E2). A static import in routes.ts instead would
        // close an import cycle (HomePage -> cardMedia -> routes) that throws at
        // module evaluation, so this one known case is filtered by name.
        if (log.code === "INEFFECTIVE_DYNAMIC_IMPORT" && log.message.includes("pages/HomePage")) {
          return;
        }
        handler(level, log);
      },
      output: {
        // The six demo sites are heavy and rarely visited together.
        codeSplitting: {
          groups: [{ name: "react", test: /node_modules[\\/](react|react-dom|react-router)[\\/]/ }],
        },
      },
    },
  },
});
