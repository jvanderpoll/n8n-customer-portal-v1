import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

const portalScreens = ["/subscriptions", "/instances", "/users"] as const;

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
  it.each(portalScreens)("matches the portal screen at %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(path);
  });
  it("keeps cross-purchase licenses on /subscriptions, not a top-level /licenses route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.routesById["/licenses"]).toBeUndefined();
    expect(router.matchRoutes("/subscriptions").at(-1)?.routeId).toBe("/subscriptions");
  });
  it("keeps /contact as a redirect stub, not a portal screen", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes("/contact").at(-1)?.routeId).toBe("/contact");
    const contactRoute = router.routesById["/contact"];
    expect(contactRoute).toBeDefined();
    expect(typeof contactRoute.options.beforeLoad).toBe("function");
    expect(contactRoute.options.component?.name).toBe("ContactRedirect");
  });
});

// Pages hosts the same routes below the repository name, including shared links.
describe("GitHub Pages routing", () => {
  it.each(["/", ...portalScreens])("matches %s below the Pages base path", async (path) => {
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
