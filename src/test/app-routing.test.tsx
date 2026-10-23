import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it.each(["/subscriptions", "/instances", "/users", "/contact"])("matches the portal screen at %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(path);
  });
});

// Pages hosts the same routes below the repository name, including shared links.
describe("GitHub Pages routing", () => {
  it.each(["/", "/subscriptions", "/instances", "/users", "/contact"])("matches %s below the Pages base path", async (path) => {
    const router = createRouter({
      routeTree,
      basepath: "/n8n-customer-portal-v1/",
      history: createMemoryHistory({ initialEntries: [`/n8n-customer-portal-v1${path}`] }),
      context: { queryClient: new QueryClient() },
    });
    await router.load();
    expect(router.state.matches.at(-1)?.routeId).toBe(path);
  });
});
