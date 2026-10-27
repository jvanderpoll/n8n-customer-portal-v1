import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { usePersona } from "@/components/portal-shell";
import { LastUpdate, SubscriptionCard, WorkspaceTitle } from "@/components/portal-workspace";
import { portalHead } from "@/lib/portal-format";
import { runningFirst } from "@/lib/portal-views";

export const Route = createFileRoute("/")({
  head: () => portalHead("Overview", "Usage, renewal and last update for your running n8n subscriptions."),
  component: Overview,
});

function Overview() {
  const persona = usePersona();
  const { running, expired } = runningFirst(persona);
  return <>
    <WorkspaceTitle title="Overview" trailing={<LastUpdate persona={persona} />} />
    <div className="agreement-list">{running.map((s) => <SubscriptionCard key={s.id} subscription={s} linked />)}</div>
    {expired.length > 0 && <p className="overview-footnote">{expired.length} expired {expired.length === 1 ? "subscription" : "subscriptions"}. <Link to="/subscriptions" className="text-link quiet-link">All subscriptions <ArrowUpRight size={14} /></Link></p>}
  </>;
}
