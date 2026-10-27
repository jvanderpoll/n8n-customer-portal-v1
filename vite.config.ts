// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const pagesBuild = process.env["GITHUB_PAGES"] === "true";

export default defineConfig({
  vite: {
    // Dual-stack bind (same as the Lovable default). Do not start with
    // `--host 0.0.0.0`: that is IPv4-only, so ::1 and Cursor tunnels that
    // reconnect after a Ctrl-C restart fail with ECONNREFUSED / -102.
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
    },
    ...(pagesBuild ? { base: "/n8n-customer-portal-v1/" } : {}),
  },
  ...(pagesBuild ? { nitro: false } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(pagesBuild ? {
      prerender: { enabled: true, crawlLinks: false, failOnError: true },
    } : {}),
  },
});
