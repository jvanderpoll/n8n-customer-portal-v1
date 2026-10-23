import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/portal-shell";
import { EmptySubscription, Freshness, PageHeading, Requirements, SubscriptionUsage } from "@/components/portal-shared";
import { date, fmt, portalHead } from "@/lib/portal-format";
import { licensesFor } from "@/lib/portal-views";

export const Route = createFileRoute("/subscriptions")({
  // Static hosts cannot render every query-string variant ahead of time.
  // Read URL filters in the browser before rendering this screen on Pages.
  ssr: import.meta.env.BASE_URL === "/",
  validateSearch: z.object({ subscription: z.string().optional().catch(undefined) }),
  head: () => portalHead("Subscriptions & licenses", "Active Enterprise subscriptions, contract-period execution allowances and linked n8n licenses."),
  component: Subscriptions,
});

function Subscriptions() {
  const persona = usePersona();
  const search = Route.useSearch();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const selected = persona.subscriptions.find((s) => s.id === search.subscription);
  const subscriptions = selected ? [selected] : persona.subscriptions;
  return <>
    <PageHeading title="Subscriptions & licenses" description="Active subscriptions and the licenses sharing each execution allowance." />
    {!persona.subscriptions.length ? <EmptySubscription persona={persona} /> : <>
      <Freshness persona={persona} /><Requirements persona={persona} />
      {selected && <Button variant="link" size="sm" asChild className="mb-4 h-auto p-0"><Link to="/subscriptions" search={{}}>All subscriptions</Link></Button>}
      {subscriptions.map((s) => {
        const licenses = licensesFor(persona, s.id);
        const open = !collapsed.includes(s.id);
        return <section key={s.id} className="mb-8 border-t border-border pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{s.name}</h2><p className="mt-1 text-xs text-muted-foreground">Self-hosted Enterprise · Execution-based · Active</p></div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs"><dt className="text-muted-foreground">Contract period</dt><dd>{date(s.start)} – {date(s.end)}</dd><dt className="text-muted-foreground">Renewal date</dt><dd>{date(s.renewal)}</dd></dl>
          </div>
          <SubscriptionUsage subscription={s} persona={persona} />
          <div className="mt-5 flex items-center justify-between gap-2 border-b border-border pb-2">
            <Button variant="ghost" size="sm" className="h-7 px-0" aria-expanded={open} onClick={() => setCollapsed(open ? [...collapsed, s.id] : collapsed.filter((id) => id !== s.id))}>{open ? <ChevronUp /> : <ChevronDown />}Linked licenses ({licenses.length})</Button>
            <Button variant="link" size="sm" asChild className="h-auto whitespace-normal p-0 text-xs"><Link to="/instances" search={{ subscription: s.id }}>All linked instances <ArrowRight /></Link></Button>
          </div>
          {open && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-3 pr-3 font-medium">License reference</th><th className="px-3 py-3 font-medium">Environment</th><th className="px-3 py-3 font-medium">Instances</th><th className="px-3 py-3 text-right font-medium">Executions · contract period</th><th className="py-3 pl-3 font-medium">Coverage</th></tr></thead>
            <tbody>{licenses.map((license) => <tr key={license.id} className="border-b border-border"><td className="py-3 pr-3"><Button variant="link" size="sm" asChild className="h-auto p-0 font-mono text-xs"><Link to="/instances" search={{ subscription: s.id, license: license.id }}>{license.id}<ArrowRight /></Link></Button></td><td className="px-3 py-3">{license.environment}</td><td className="px-3 py-3 tabular-nums">{license.instances.length}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(license.summary.used)}{license.summary.incomplete.length > 0 && <span className="block text-muted-foreground">May be incomplete</span>}</td><td className="py-3 pl-3">{license.summary.reportedCount} of {license.instances.length} current</td></tr>)}</tbody>
          </table></div>}
        </section>;
      })}
    </>}
  </>;
}