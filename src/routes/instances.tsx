import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePersona } from "@/components/portal-shell";
import { EmptySubscription, Freshness, PageHeading, StatusText } from "@/components/portal-shared";
import { type Instance, type Persona } from "@/lib/portal-data";
import { date, fmt, portalHead, timestamp } from "@/lib/portal-format";
import { defaultInstanceFilter, filterInstances, paginateInstances, type InstanceFilter } from "@/lib/portal-views";

const instanceSearch = z.object({
  subscription: z.string().optional().catch(undefined),
  license: z.string().optional().catch(undefined),
  status: z.enum(["all", "incomplete", "reported", "zero", "pending", "error"]).optional().catch(undefined),
  environment: z.enum(["all", "Production", "Non-production"]).optional().catch(undefined),
  query: z.string().optional().catch(undefined),
  sort: z.enum(["usage", "name", "report"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  instance: z.string().optional().catch(undefined),
});
type InstanceSearch = z.infer<typeof instanceSearch>;

export const Route = createFileRoute("/instances")({
  // Static hosts cannot render every query-string variant ahead of time.
  // Read URL filters in the browser before rendering this screen on Pages.
  ssr: import.meta.env.BASE_URL === "/",
  validateSearch: instanceSearch,
  head: () => portalHead("Instances", "Reported execution usage, license links and reporting completeness across n8n self-hosted instances."),
  component: Instances,
});

function Instances() {
  const persona = usePersona();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const subscription = persona.subscriptions.some((s) => s.id === search.subscription) ? search.subscription ?? "all" : "all";
  const license = persona.instances.some((i) => i.license === search.license && (subscription === "all" || i.subscriptionId === subscription)) ? search.license ?? "all" : "all";
  const filter: InstanceFilter = { ...defaultInstanceFilter, ...search, subscription, license,
    status: search.status ?? "all", environment: search.environment ?? "all", query: search.query ?? "", sort: search.sort ?? "usage" };
  const allRows = filterInstances(persona, filter);
  const pagination = paginateInstances(allRows, search.page ?? 1);
  const selected = persona.instances.find((i) => i.id === search.instance);
  const licenses = [...new Set(persona.instances.filter((i) => subscription === "all" || i.subscriptionId === subscription).map((i) => i.license))];
  const update = (changes: Partial<InstanceSearch>) => void navigate({ search: { ...search, ...changes, page: undefined, instance: undefined }, replace: true });
  const activeFilter = subscription !== "all" || license !== "all" || filter.status !== "all" || filter.environment !== "all" || !!filter.query;
  const selectedSubscription = persona.subscriptions.find((s) => s.id === subscription);

  return <>
    <PageHeading title="Instances" />
    {!persona.instances.length ? <EmptySubscription persona={persona} /> : <>
      <Freshness persona={persona} />
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <div className="relative w-full sm:max-w-72"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search instances" placeholder="Search instance or license" value={filter.query} onChange={(e) => update({ query: e.target.value || undefined })} className="pl-9" /></div>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Report coverage">
          <Button size="sm" variant={filter.status === "all" ? "secondary" : "ghost"} aria-pressed={filter.status === "all"} onClick={() => update({ status: undefined })}>All</Button>
          <Button size="sm" variant={filter.status === "incomplete" ? "secondary" : "ghost"} aria-pressed={filter.status === "incomplete"} onClick={() => update({ status: "incomplete" })}>Missing or outdated</Button>
        </div>
      </div>
      <details className="my-4"><summary className="w-fit cursor-pointer text-xs text-muted-foreground hover:text-foreground">Filters{[subscription !== "all", license !== "all", filter.status !== "all", filter.environment !== "all"].filter(Boolean).length > 0 ? ` · ${[subscription !== "all", license !== "all", filter.status !== "all", filter.environment !== "all"].filter(Boolean).length} active` : ""}</summary><div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <FilterSelect label="Subscription" value={subscription} options={[{ value: "all", label: "All subscriptions" }, ...persona.subscriptions.map((s) => ({ value: s.id, label: s.name }))]} onChange={(value) => update({ subscription: value === "all" ? undefined : value, license: undefined })} />
        <FilterSelect label="License" value={license} options={[{ value: "all", label: "All licenses" }, ...licenses.map((id) => ({ value: id, label: id }))]} onChange={(value) => update({ license: value === "all" ? undefined : value })} />
        <FilterSelect label="Environment" value={filter.environment} options={[{ value: "all", label: "All environments" }, { value: "Production", label: "Production" }, { value: "Non-production", label: "Non-production" }]} onChange={(value) => { if (value === "all" || value === "Production" || value === "Non-production") update({ environment: value === "all" ? undefined : value }); }} />
        <FilterSelect label="Report status" value={filter.status} options={[{ value: "all", label: "All statuses" }, { value: "incomplete", label: "Missing or outdated" }, { value: "reported", label: "Reported" }, { value: "zero", label: "Confirmed zero" }, { value: "pending", label: "Waiting for next report" }, { value: "error", label: "Reporting error" }]} onChange={(value) => { const parsed = instanceSearch.shape.status.safeParse(value); if (parsed.success) update({ status: parsed.data === "all" ? undefined : parsed.data }); }} />
        <FilterSelect label="Sort by" value={filter.sort} options={[{ value: "usage", label: "Executions: high to low" }, { value: "name", label: "Instance name" }, { value: "report", label: "Most recent report" }]} onChange={(value) => { if (value === "usage" || value === "name" || value === "report") update({ sort: value }); }} />
      </div></details>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{allRows.length} of {persona.instances.length} instances{selectedSubscription ? ` · ${selectedSubscription.name}` : ""}</span>
        {activeFilter && <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => void navigate({ search: {}, replace: true })}>Clear filters <X /></Button>}
      </div>
      {selected && <InstanceDetail instance={selected} persona={persona} onClose={() => void navigate({ search: { ...search, instance: undefined }, replace: true })} />}
      <div className="overflow-x-auto border-y border-border"><table className="w-full min-w-[600px] text-left text-xs">
        <thead><tr className="border-b border-border bg-muted/40 text-muted-foreground"><th className="px-3 py-3 font-medium">Instance</th><th className="px-3 py-3 text-right font-medium">Executions</th><th className="px-3 py-3 font-medium">Reporting</th><th className="px-3 py-3 font-medium">Last report · UTC</th></tr></thead>
        <tbody>{pagination.rows.map((i) => {
          const s = persona.subscriptions.find((sub) => sub.id === i.subscriptionId);
          return <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/30">
            <td className="px-3 py-3"><Button variant="link" size="sm" className="h-auto p-0 font-mono text-xs" onClick={() => void navigate({ search: { ...search, instance: i.id }, replace: true })}>{i.name}</Button>{!selectedSubscription && <div className="mt-1 text-muted-foreground">{s?.name}</div>}</td>
            <td className="px-3 py-3 text-right tabular-nums">{i.executions === null ? <span className="text-muted-foreground">— no data</span> : fmt(i.executions)}{i.status === "pending" && <div className="mt-1 text-muted-foreground">Last known value</div>}</td>
            <td className="max-w-48 px-3 py-3"><StatusText instance={i} compact /></td>
            <td className="px-3 py-3 text-muted-foreground">{i.lastReport ? <>{date(i.lastReport)}<br />{new Date(i.lastReport).toISOString().slice(11, 16)}</> : "Never reported"}</td>
          </tr>;
        })}
        {!allRows.length && <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">No instances match these filters.</td></tr>}
        </tbody>
      </table></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{allRows.length ? `${(pagination.page - 1) * 20 + 1}–${Math.min(pagination.page * 20, allRows.length)} of ${allRows.length}` : "0 results"}</span>{pagination.pages > 1 && <div className="flex items-center gap-3"><Button variant="outline" size="icon" className="size-8" title="Previous page" aria-label="Previous page" disabled={pagination.page === 1} onClick={() => void navigate({ search: { ...search, page: pagination.page - 1, instance: undefined }, replace: true })}><ChevronLeft /></Button><span>Page {pagination.page} of {pagination.pages}</span><Button variant="outline" size="icon" className="size-8" title="Next page" aria-label="Next page" disabled={pagination.page === pagination.pages} onClick={() => void navigate({ search: { ...search, page: pagination.page + 1, instance: undefined }, replace: true })}><ChevronRight /></Button></div>}</div>
    </>}
  </>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="min-w-0"><span className="mb-1 block text-xs text-muted-foreground">{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full text-xs"><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function InstanceDetail({ instance, persona, onClose }: { instance: Instance; persona: Persona; onClose: () => void }) {
  const subscription = persona.subscriptions.find((s) => s.id === instance.subscriptionId);
  if (!subscription) return null;
  return <section aria-labelledby="instance-detail-title" className="mb-5 border-y-2 border-border py-5">
    <div className="flex items-start justify-between gap-2"><h2 id="instance-detail-title" className="break-all font-mono font-semibold">{instance.name}</h2><Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onClose} aria-label="Close instance details" title="Close instance details"><X /></Button></div>
    <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="text-muted-foreground">Subscription</dt><dd className="mt-1"><Button variant="link" asChild size="sm" className="h-auto whitespace-normal p-0 text-xs"><Link to="/subscriptions" search={{ subscription: subscription.id }}>{subscription.name}<ArrowRight /></Link></Button></dd></div>
      <div><dt className="text-muted-foreground">Contract period</dt><dd className="mt-1">{date(subscription.start)} – {date(subscription.end)}</dd></div>
      <div><dt className="text-muted-foreground">License reference</dt><dd className="mt-1 font-mono">{instance.license}</dd></div>
      <div><dt className="text-muted-foreground">Environment</dt><dd className="mt-1">{instance.env}</dd></div>
      <div><dt className="text-muted-foreground">Executions · contract period</dt><dd className="mt-1 font-semibold tabular-nums">{instance.executions === null ? "— no usable data" : fmt(instance.executions)}{instance.status === "pending" && " (last known value)"}</dd></div>
      <div><dt className="text-muted-foreground">Last received report</dt><dd className="mt-1">{instance.lastReport ? timestamp(instance.lastReport) : "Never reported"}</dd></div>
    </dl>
    <div className="mt-4 text-xs"><StatusText instance={instance} /></div>
    {(instance.status === "pending" || instance.status === "error") && <Button variant="link" asChild size="sm" className="mt-3 h-auto p-0 text-xs"><Link to="/contact" search={{ topic: "reporting", instance: instance.id }}>Contact n8n about this report <ArrowRight /></Link></Button>}
  </section>;
}