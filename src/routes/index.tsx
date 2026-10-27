import { createFileRoute } from "@tanstack/react-router";
import { RequestSubscription } from "@/components/portal-management";
import { usePersona } from "@/components/portal-shell";
import { LastUpdate, OverviewDashboard, WorkspaceTitle } from "@/components/portal-workspace";
import { portalHead } from "@/lib/portal-format";

export const Route = createFileRoute("/")({
  head: () => portalHead("Overview", "Usage, renewal and last update for your running n8n subscriptions."),
  component: Overview,
});

function Overview() {
  const persona = usePersona();
  return (
    <>
      <WorkspaceTitle title="Overview" trailing={<LastUpdate persona={persona} />} />
      <OverviewDashboard emptyAction={<RequestSubscription />} />
    </>
  );
}
