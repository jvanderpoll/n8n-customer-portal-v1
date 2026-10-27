import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ChevronDown } from "lucide-react";
import { usePersona } from "@/components/portal-shell";
import { EmptySubscription } from "@/components/portal-shared";
import { InstanceContribution, WorkspaceTitle } from "@/components/portal-workspace";
import { CreateInstance, RemovedInstances } from "@/components/portal-management";
import { activeInstances } from "@/lib/portal-management";
import { portalHead } from "@/lib/portal-format";

export const Route = createFileRoute("/instances")({
  ssr: import.meta.env.BASE_URL === "/",
  validateSearch: z.object({ subscription: z.string().optional().catch(undefined), license: z.string().optional().catch(undefined), query: z.string().optional().catch(undefined), status: z.enum(["incomplete"]).optional().catch(undefined) }),
  head: () => portalHead("Instances", "Your instances, their licenses and reporting status."),
  component: Instances,
});
function Instances() {
  const persona = usePersona();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const selected = persona.subscriptions.some((s) => s.id === search.subscription) ? search.subscription : "all";
  return <><WorkspaceTitle title="Instances" trailing={<div className="page-actions"><span className="muted-text">{activeInstances(persona).length} instances</span><CreateInstance subscriptionId={selected === "all" ? undefined : selected} /></div>} />
    {!persona.subscriptions.length ? <EmptySubscription persona={persona} /> : <>
      <div className="agreement-context"><div><label className="eyebrow" htmlFor="inventory-agreement">Agreement</label><div className="agreement-picker"><select id="inventory-agreement" aria-label="Filter by agreement" value={selected} onChange={(e) => void navigate({ search: { subscription: e.target.value === "all" ? undefined : e.target.value }, replace: true })}><option value="all">All agreements</option>{persona.subscriptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={14} /></div></div></div>
      <div className="agreement-list">{persona.subscriptions.filter((s) => selected === "all" || selected === s.id).map((s) => <InstanceContribution key={`${persona.id}-${s.id}-${search.license ?? "all"}-${search.status ?? "all"}-${search.query ?? ""}`} persona={persona} subscription={s} initialQuery={search.query} initialLicense={search.license} initialIncomplete={search.status === "incomplete"} inventory />)}</div>
      <RemovedInstances />
    </>}
  </>;
}
