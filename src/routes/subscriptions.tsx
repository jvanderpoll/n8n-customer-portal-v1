import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowUpRight, Check, KeyRound } from "lucide-react";
import { usePersona } from "@/components/portal-shell";
import { EmptySubscription } from "@/components/portal-shared";
import { WorkspaceTitle } from "@/components/portal-workspace";
import { date, fmt, portalHead } from "@/lib/portal-format";
import { licensesFor } from "@/lib/portal-views";
export const Route = createFileRoute("/subscriptions")({
  ssr: import.meta.env.BASE_URL === "/",
  validateSearch: z.object({ subscription: z.string().optional().catch(undefined) }),
  head: () => portalHead("Subscriptions", "Your agreements, included allowances and licenses."),
  component: Subscriptions,
});
function Subscriptions() {
 const persona = usePersona();
 const search = Route.useSearch();
 return <><WorkspaceTitle title="Subscriptions" trailing={<span className="muted-text">{persona.subscriptions.length} agreements</span>} />
 {!persona.subscriptions.length ? <EmptySubscription persona={persona} /> : <>
 <p className="page-intro">What your account includes, and the licenses that connect it to your instances.</p>
 <div className="agreement-list">{persona.subscriptions.map((s) => {
  const licenses = licensesFor(persona, s.id);
  const instances = persona.instances.filter((i) => i.subscriptionId === s.id);
  return <section className="workspace-panel agreement-card" key={s.id}>
   <div className="panel-heading"><div className="agreement-heading"><span className="agreement-symbol"><KeyRound size={19} /></span><div><h2>{s.name}</h2><span className="supporting">{s.plan ?? "Self-hosted Enterprise"}</span></div></div><span className="status-badge"><Check size={12} />{s.status ?? "Active"}</span></div>
   <div className="agreement-facts"><div><span>Included allowance</span><strong>{s.quota === null ? "Unavailable" : s.quota <= 0 ? "Unlimited" : fmt(s.quota)} {s.quota !== null && s.quota > 0 ? s.metric === "instances" ? "instances" : "billable executions" : ""}</strong></div><div><span>Contract period</span><strong>{date(s.start)} — {date(s.end)}</strong></div><div><span>Next renewal</span><strong>{date(s.renewal)}</strong></div></div>
   <div className="agreement-actions"><span>{licenses.length} {licenses.length === 1 ? "license" : "licenses"} <i>·</i> {instances.length} instances</span><Link to="/" search={{ subscription: s.id }} className="quiet-link">Explore usage <ArrowUpRight size={14} /></Link></div>
   <details className="license-disclosure" open={search.subscription === s.id}><summary>Licenses <span>{licenses.length}</span></summary><div className="table-scroll"><table className="data-table"><thead><tr><th>License</th><th>Reference</th><th>Status</th><th className="numeric">Instances</th><th /></tr></thead><tbody>{licenses.map((l) => <tr key={l.id}><td><strong>{l.label}</strong><small className="cell-caption">{l.environment}</small></td><td className="mono-text">{l.id}</td><td><span className="status-badge">{l.status}</span></td><td className="numeric">{l.instances.length}<small className="cell-caption">{l.instances.length ? "" : "Not activated"}</small></td><td><Link to="/" search={{ subscription: s.id, license: l.id }} className="quiet-link" aria-label={`View usage for ${l.label}`}>View usage <ArrowUpRight size={13} /></Link></td></tr>)}</tbody></table></div></details>
   {s.metric === "instances" && <div className="contract-note">Instance-based agreement · {s.quota !== null ? `${s.quota} instances included` : "Allowance unavailable"}</div>}
  </section>;
 })}</div></>}
 </>;
}
