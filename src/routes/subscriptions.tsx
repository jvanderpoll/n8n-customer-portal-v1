import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { usePersona } from "@/components/portal-shell";
import { Crumb, InstanceList, LastUpdate, LicenseTable, PastPeriods, SubscriptionCard, UsagePanel, WorkspaceTitle } from "@/components/portal-workspace";
import { fmt, portalHead } from "@/lib/portal-format";
import { RequestLicenses, LicenseActions, OrderRequests } from "@/components/portal-management";
import { licensesFor, runningFirst } from "@/lib/portal-views";
import type { Subscription } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/subscriptions")({
  // Static hosts cannot render every query-string variant ahead of time.
  ssr: import.meta.env.BASE_URL === "/",
  validateSearch: z.object({ subscription: z.string().optional().catch(undefined), license: z.string().optional().catch(undefined) }),
  head: () => portalHead("Subscriptions", "Your subscriptions, their quota, period and licenses."),
  component: Subscriptions,
});

function Subscriptions() {
  const persona = usePersona();
  const search = Route.useSearch();
  const [tab, setTab] = useState<"running" | "expired">("running");
  const sub = persona.subscriptions.find((s) => s.id === search.subscription);
  if (sub) {
    const license = persona.licenses.find((l) => l.id === search.license && l.subscriptionId === sub.id);
    return license ? <LicenseDetail subscription={sub} licenseId={license.id} /> : <SubscriptionDetail subscription={sub} />;
  }
  const { running, expired } = runningFirst(persona);
  const list = tab === "running" ? running : expired;
  return <>
    <WorkspaceTitle title="Subscriptions" trailing={<div className="page-actions"><LastUpdate persona={persona} /><RequestLicenses /></div>} />
    <div className="subscription-tabs" role="tablist" aria-label="Subscription status">
      <button type="button" role="tab" aria-selected={tab === "running"} className={cn("subscription-tab", tab === "running" && "is-active")} onClick={() => setTab("running")}>
        Running ({running.length})
      </button>
      <button type="button" role="tab" aria-selected={tab === "expired"} className={cn("subscription-tab", tab === "expired" && "is-active")} onClick={() => setTab("expired")}>
        Expired ({expired.length})
      </button>
    </div>
    <div className="agreement-list">
      {list.map((s) => <SubscriptionCard key={s.id} subscription={s} linked />)}
      {!list.length && <p className="panel-empty">{tab === "running" ? "No running subscriptions." : "No expired subscriptions."}</p>}
    </div>
    <OrderRequests />
  </>;
}

function SubscriptionDetail({ subscription: sub }: { subscription: Subscription }) {
  const persona = usePersona();
  const [section, setSection] = useState<"usage" | "periods" | "licenses">("usage");
  return <>
    <WorkspaceTitle title={sub.name} crumbs={<Crumb><Link to="/subscriptions">Subscriptions</Link></Crumb>} trailing={<LastUpdate persona={persona} />} />
    <div className="subscription-tabs" role="tablist" aria-label="Subscription sections">
      <button type="button" role="tab" aria-selected={section === "usage"} className={cn("subscription-tab", section === "usage" && "is-active")} onClick={() => setSection("usage")}>
        Usage
      </button>
      <button type="button" role="tab" aria-selected={section === "periods"} className={cn("subscription-tab", section === "periods" && "is-active")} onClick={() => setSection("periods")}>
        Past periods
      </button>
      <button type="button" role="tab" aria-selected={section === "licenses"} className={cn("subscription-tab", section === "licenses" && "is-active")} onClick={() => setSection("licenses")}>
        Licenses
      </button>
    </div>
    <div className="agreement-list">
      {section === "usage" && (
        <>
          <SubscriptionCard subscription={sub} />
          <UsagePanel subscription={sub} />
        </>
      )}
      {section === "periods" && <PastPeriods subscription={sub} />}
      {section === "licenses" && <LicenseTable subscription={sub} />}
    </div>
  </>;
}

function LicenseDetail({ subscription: sub, licenseId }: { subscription: Subscription; licenseId: string }) {
  const persona = usePersona();
  const license = licensesFor(persona, sub.id).find((l) => l.id === licenseId)!;
  return <>
    <WorkspaceTitle title={license.label} crumbs={<><Crumb><Link to="/subscriptions">Subscriptions</Link></Crumb><Crumb><Link to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link></Crumb></>} trailing={<LicenseActions license={license} />} />
    <div className="agreement-list">
    <section className="workspace-panel">
      <dl className="subscription-facts detail-facts">
        <div><dt>License reference</dt><dd className="mono-text">{license.id}</dd></div>
        <div><dt>Subscription</dt><dd><Link className="text-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link></dd></div>
        <div><dt>Environment</dt><dd>{license.environment}</dd></div>
        <div><dt>Status</dt><dd>{license.status}</dd></div>
        <div><dt>Executions</dt><dd>{license.executions === null ? "—" : fmt(license.executions)}</dd></div>
        <div><dt>Instances reporting</dt><dd>{license.reportingCount}</dd></div>
      </dl>
      <p className="contract-note">This license has no quota of its own. Its executions count toward the {sub.name} quota.</p>
    </section>
    <section className="workspace-panel"><div className="panel-heading"><h2>Covered instances ({license.instances.length})</h2></div><InstanceList instances={license.instances} /></section>
    </div>
  </>;
}
