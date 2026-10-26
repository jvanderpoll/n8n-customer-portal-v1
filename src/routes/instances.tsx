import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { usePersona } from "@/components/portal-shell";
import { Crumb, CsvExport, ReportingStatus, WorkspaceTitle } from "@/components/portal-workspace";
import { CreateInstance, InstanceActions, RemovedInstances } from "@/components/portal-management";
import { Button } from "@/components/ui/button";
import { activeInstances } from "@/lib/portal-management";
import { date, fmt, portalHead, timestamp } from "@/lib/portal-format";
import { summarize, type Instance } from "@/lib/portal-data";
import { defaultInstanceFilter, filterInstances, paginateInstances, subscriptionShare } from "@/lib/portal-views";

const sortValues = ["usage", "name", "report"] as const;
const searchSchema = z.object({
  subscription: z.string().optional().catch(undefined),
  license: z.string().optional().catch(undefined),
  status: z.enum(["reporting", "attention"]).optional().catch(undefined),
  query: z.string().optional().catch(undefined),
  page: z.number().int().positive().optional().catch(undefined),
  instance: z.string().optional().catch(undefined),
  sort: z.enum(sortValues).optional().catch(undefined),
});

export const Route = createFileRoute("/instances")({
  // Static hosts cannot render every query-string variant ahead of time.
  ssr: import.meta.env.BASE_URL === "/",
  validateSearch: searchSchema,
  head: () => portalHead("Instances", "Search and filter your n8n instances, their licenses, executions and reporting status."),
  component: Instances,
});

function Instances() {
  const persona = usePersona();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const detail = persona.instances.find((i) => i.id === search.instance);
  if (detail) return <InstanceDetail instance={detail} />;
  const set = (patch: Partial<z.infer<typeof searchSchema>>) => void navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }), replace: true });
  const subscription = persona.subscriptions.some((s) => s.id === search.subscription) ? search.subscription! : "all";
  const licenses = persona.licenses.filter((l) => subscription === "all" || l.subscriptionId === subscription);
  const license = licenses.some((l) => l.id === search.license) ? search.license! : "all";
  const sort = search.sort ?? defaultInstanceFilter.sort;
  const rows = filterInstances(persona, { ...defaultInstanceFilter, subscription, license, status: search.status ?? "all", query: search.query ?? "", sort });
  const page = paginateInstances(rows, search.page ?? 1);
  const filtered = subscription !== "all" || license !== "all" || search.status || search.query || search.sort;
  return <>
    <WorkspaceTitle title="Instances" trailing={<div className="page-actions"><span className="muted-text">{activeInstances(persona).length} instances</span><CreateInstance subscriptionId={subscription === "all" ? undefined : subscription} /></div>} />
    <section className="workspace-panel">
      <div className="table-toolbar instance-filters">
        <label className="compact-search"><Search size={15} /><span className="sr-only">Search instances</span><input placeholder="Search name or license…" value={search.query ?? ""} onChange={(e) => set({ query: e.target.value || undefined })} /></label>
        <label className="filter-select"><span>Subscription</span><select value={subscription} onChange={(e) => set({ subscription: e.target.value === "all" ? undefined : e.target.value, license: undefined })}><option value="all">All</option>{persona.subscriptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="filter-select"><span>License</span><select value={license} onChange={(e) => set({ license: e.target.value === "all" ? undefined : e.target.value })}><option value="all">All</option>{licenses.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        <label className="filter-select"><span>Reporting</span><select value={search.status ?? "all"} onChange={(e) => set({ status: e.target.value === "all" ? undefined : e.target.value as "reporting" | "attention" })}><option value="all">All</option><option value="reporting">Reporting</option><option value="attention">Not reporting</option></select></label>
        {filtered && <Button variant="ghost" size="sm" onClick={() => void navigate({ search: {}, replace: true })}>Clear filters</Button>}
        <div className="toolbar-spacer" />
        <CsvExport
          filename="instances.csv"
          headers={["Instance", "Subscription", "License", "Key type", "Executions", "% of subscription", "Last report", "Reporting status"]}
          rows={page.rows.map((i) => {
            const sub = persona.subscriptions.find((s) => s.id === i.subscriptionId);
            const used = sub ? summarize(sub, persona.instances).used : 0;
            return [
              i.name,
              sub?.name ?? "",
              persona.licenses.find((l) => l.id === i.license)?.label ?? i.license,
              persona.licenses.find((l) => l.id === i.license)?.environment ?? i.env,
              i.executions === null ? "" : String(i.executions),
              i.executions === null ? "" : subscriptionShare(i.executions, used),
              i.lastReport ?? "",
              i.status,
            ];
          })}
        />
      </div>
      <InstanceTable instances={page.rows} sort={sort} onSort={(next) => set({ sort: next === "usage" ? undefined : next })} />
      {page.pages > 1 && <div className="pager"><span className="muted-text">{(page.page - 1) * 20 + 1}–{Math.min(rows.length, page.page * 20)} of {rows.length}</span><Button variant="outline" size="sm" disabled={page.page <= 1} onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page.page - 1 }) })}><ChevronLeft size={14} />Previous</Button><Button variant="outline" size="sm" disabled={page.page >= page.pages} onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page.page + 1 }) })}>Next<ChevronRight size={14} /></Button></div>}
    </section>
    <RemovedInstances />
  </>;
}

function SortHeader({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: (typeof sortValues)[number];
  sort: (typeof sortValues)[number];
  onSort: (sort: (typeof sortValues)[number]) => void;
  className?: string | undefined;
}) {
  const active = sort === field;
  return (
    <th className={className} aria-sort={active ? "descending" : "none"}>
      <button type="button" className={`sort-header${active ? " is-active" : ""}`} onClick={() => onSort(field)}>
        {label}
        <span aria-hidden="true">{active ? " ↓" : ""}</span>
      </button>
    </th>
  );
}

function InstanceTable({
  instances,
  sort,
  onSort,
}: {
  instances: Instance[];
  sort: (typeof sortValues)[number];
  onSort: (sort: (typeof sortValues)[number]) => void;
}) {
  const persona = usePersona();
  return <div className="table-scroll"><table className="data-table"><thead><tr>
    <SortHeader label="Instance" field="name" sort={sort} onSort={onSort} />
    <th>Subscription</th>
    <th>License</th>
    <th>Key type</th>
    <SortHeader label="Executions" field="usage" sort={sort} onSort={onSort} className="numeric" />
    <th className="numeric">% of subscription</th>
    <SortHeader label="Last report" field="report" sort={sort} onSort={onSort} />
    <th>Reporting status</th>
    <th><span className="sr-only">Actions</span></th>
  </tr></thead><tbody>{instances.map((i) => {
    const sub = persona.subscriptions.find((s) => s.id === i.subscriptionId);
    const license = persona.licenses.find((l) => l.id === i.license);
    const used = sub ? summarize(sub, persona.instances).used : 0;
    return <tr key={i.id}>
      <td><Link className="table-link" to="/instances" search={{ instance: i.id }}>{i.name}</Link></td>
      <td>{sub?.name}</td>
      <td><span className="license-name">{license?.label ?? i.license}</span></td>
      <td>{license?.environment ?? i.env}</td>
      <td className="numeric">{i.executions === null ? "—" : fmt(i.executions)}</td>
      <td className="numeric">{subscriptionShare(i.executions, used)}</td>
      <td>{i.lastReport ? timestamp(i.lastReport) : "—"}</td>
      <td><ReportingStatus instance={i} /></td>
      <td><InstanceActions instance={i} /></td>
    </tr>;
  })}{!instances.length && <tr><td colSpan={9} className="empty-table">No instances match your filters.</td></tr>}</tbody></table></div>;
}

function InstanceDetail({ instance: i }: { instance: Instance }) {
  const persona = usePersona();
  const sub = persona.subscriptions.find((s) => s.id === i.subscriptionId);
  const license = persona.licenses.find((l) => l.id === i.license);
  const summary = sub ? summarize(sub, persona.instances) : null;
  return <>
    <WorkspaceTitle title={i.name} crumbs={<Crumb><Link to="/instances">Instances</Link></Crumb>} trailing={i.archived ? <span className="status-badge neutral-badge">Removed</span> : <InstanceActions instance={i} />} />
    <section className="workspace-panel">
      <dl className="subscription-facts detail-facts">
        <div><dt>Billable executions this period</dt><dd>{i.executions === null ? "No usage reported yet" : fmt(i.executions)}</dd></div>
        <div><dt>Share of the subscription</dt><dd>{summary ? subscriptionShare(i.executions, summary.used) : "—"}</dd></div>
        <div><dt>Last report</dt><dd>{i.lastReport ? timestamp(i.lastReport) : "No report received"}</dd></div>
        <div><dt>Reporting status</dt><dd><ReportingStatus instance={i} /></dd></div>
        <div><dt>License</dt><dd>{sub && license ? <Link className="table-link" to="/subscriptions" search={{ subscription: sub.id, license: license.id }}>{license.label}</Link> : i.license}<small className="cell-caption mono-text">{i.license}</small></dd></div>
        <div><dt>Key type</dt><dd>{license?.environment ?? i.env}</dd></div>
        <div><dt>Subscription</dt><dd>{sub ? <Link className="table-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link> : "—"}{sub && <small className="cell-caption">{date(sub.start)} — {date(sub.end)}</small>}</dd></div>
        <div><dt>Subscription included quota</dt><dd>{sub ? `${fmt(sub.quota)} executions` : "—"}</dd></div>
        <div><dt>Subscription executions used</dt><dd>{summary ? fmt(summary.used) : "—"}</dd></div>
        <div><dt>Subscription remaining</dt><dd>{summary ? `${fmt(summary.remaining)} executions` : "—"}</dd></div>
        <div><dt>Environment</dt><dd>{i.env}</dd></div>
        <div><dt>Version</dt><dd>{i.version ?? "Not reported"}</dd></div>
      </dl>
    </section>
  </>;
}
