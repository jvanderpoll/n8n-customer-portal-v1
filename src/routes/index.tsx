import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { UsageWorkspace } from "@/components/portal-workspace";
import { portalHead } from "@/lib/portal-format";
export const Route = createFileRoute("/")({
  ssr: import.meta.env.BASE_URL === "/",
  validateSearch: z.object({ subscription: z.string().optional().catch(undefined), license: z.string().optional().catch(undefined) }),
  head: () => portalHead("Usage", "Your agreement, billable usage and the instances contributing to it."),
  component: Usage,
});
function Usage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <UsageWorkspace subscriptionId={search.subscription} licenseId={search.license} onSubscriptionChange={(id) => void navigate({ search: { subscription: id } })} />;
}
