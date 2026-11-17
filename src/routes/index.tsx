import { createFileRoute, Navigate } from "@tanstack/react-router";
import { RequestSubscription } from "@/components/portal-management";
import { usePersona, usePrototypeMode, useSubscriptionScope } from "@/components/portal-shell";
import { LastUpdate, OverviewDashboard, WorkspaceTitle } from "@/components/portal-workspace";
import { portalHead } from "@/lib/portal-format";

export const Route = createFileRoute("/")({
  head: () => portalHead("Overview", "Usage, renewal and last update for your active n8n subscriptions."),
  component: Overview,
});

function Overview() {
  const persona = usePersona();
  const mode = usePrototypeMode();
  const scope = useSubscriptionScope();
  if (mode === "new") {
    if (scope === "single") {
      const only = persona.subscriptions[0];
      if (only) {
        return <Navigate to="/subscriptions" search={{ subscription: only.id, license: undefined, section: undefined }} replace />;
      }
    }
    return <Navigate to="/subscriptions" search={{ subscription: undefined, license: undefined, section: undefined }} replace />;
  }
  return (
    <>
      <WorkspaceTitle title="Overview" trailing={<LastUpdate persona={persona} />} />
      <OverviewDashboard emptyAction={<RequestSubscription />} />
    </>
  );
}
