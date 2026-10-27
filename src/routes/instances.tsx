import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { usePersona } from "@/components/portal-shell";
import { Crumb, DataTable, ReportingStatus, WorkspaceTitle, type DataColumn } from "@/components/portal-workspace";
import { BulkRemoveInstances, CreateInstance, InstanceActions, RemovedInstances } from "@/components/portal-management";
import { activeInstances } from "@/lib/portal-management";
import { date, fmt, portalHead, timestamp } from "@/lib/portal-format";
import { summarize, type Instance } from "@/lib/portal-data";
import { defaultInstanceFilter, filterInstances, subscriptionShare } from "@/lib/portal-views";

const searchSchema = z.object({
  subscription: z.string().optional().catch(undefined),
  license: z.string().optional().catch(undefined),
  status: z.enum(["reporting", "attention"]).optional().catch(undefined),
  query: z.string().optional().catch(undefined),
  instance: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
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
  const set = (patch: Partial<z.infer<typeof searchSchema>>) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const subscription = persona.subscriptions.some((s) => s.id === search.subscription) ? search.subscription! : "all";
  const licenses = persona.licenses.filter((l) => subscription === "all" || l.subscriptionId === subscription);
  const license = licenses.some((l) => l.id === search.license) ? search.license! : "all";
  const filteredRows = filterInstances(persona, {
    ...defaultInstanceFilter,
    subscription,
    license,
    status: search.status ?? "all",
    query: "",
    sort: "usage",
  });
  const filtersActive = subscription !== "all" || license !== "all" || Boolean(search.status);
  const count = activeInstances(persona).length;

  const columns: DataColumn<Instance>[] = [
    { id: "name", header: "Instance", accessor: (i) => i.name, cell: (i) => i.name },
    {
      id: "subscription",
      header: "Subscription",
      accessor: (i) => persona.subscriptions.find((s) => s.id === i.subscriptionId)?.name ?? "",
      cell: (i) => persona.subscriptions.find((s) => s.id === i.subscriptionId)?.name,
    },
    {
      id: "license",
      header: "License",
      accessor: (i) => persona.licenses.find((l) => l.id === i.license)?.label ?? i.license,
      cell: (i) => <span className="license-name">{persona.licenses.find((l) => l.id === i.license)?.label ?? i.license}</span>,
    },
    {
      id: "keyType",
      header: "Key type",
      accessor: (i) => persona.licenses.find((l) => l.id === i.license)?.environment ?? i.env,
      cell: (i) => persona.licenses.find((l) => l.id === i.license)?.environment ?? i.env,
    },
    {
      id: "executions",
      header: "Executions",
      numeric: true,
      accessor: (i) => i.executions,
      cell: (i) => (i.executions === null ? "—" : fmt(i.executions)),
      csv: (i) => (i.executions === null ? "" : String(i.executions)),
    },
    {
      id: "share",
      header: "% of subscription",
      numeric: true,
      accessor: (i) => {
        const sub = persona.subscriptions.find((s) => s.id === i.subscriptionId);
        const used = sub ? summarize(sub, persona.instances).used : 0;
        if (i.executions === null) return null;
        return used <= 0 ? 0 : Math.round((i.executions / used) * 100);
      },
      cell: (i) => {
        const sub = persona.subscriptions.find((s) => s.id === i.subscriptionId);
        const used = sub ? summarize(sub, persona.instances).used : 0;
        return subscriptionShare(i.executions, used);
      },
      csv: (i) => {
        const sub = persona.subscriptions.find((s) => s.id === i.subscriptionId);
        const used = sub ? summarize(sub, persona.instances).used : 0;
        return i.executions === null ? "" : subscriptionShare(i.executions, used);
      },
    },
    {
      id: "report",
      header: "Last report",
      accessor: (i) => (i.lastReport ? Date.parse(i.lastReport) : null),
      cell: (i) => (i.lastReport ? timestamp(i.lastReport) : "—"),
      csv: (i) => i.lastReport ?? "",
    },
    {
      id: "status",
      header: "Reporting status",
      accessor: (i) => i.status,
      cell: (i) => <ReportingStatus instance={i} />,
    },
  ];

  return <>
    <WorkspaceTitle title={`Instances (${count})`} trailing={<div className="page-actions"><CreateInstance subscriptionId={subscription === "all" ? undefined : subscription} /></div>} />
    <section className="workspace-panel">
      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(i) => i.id}
        searchPlaceholder="Search name or license…"
        search={search.query ?? ""}
        onSearchChange={(value) => set({ query: value || undefined, page: undefined })}
        csvFilename="instances.csv"
        empty="No instances match your filters."
        onRowClick={(i) => void navigate({ to: "/instances", search: { instance: i.id } })}
        rowActions={(i) => <InstanceActions instance={i} />}
        bulkActions={({ selectedRows, clearSelection }) => (
          <BulkRemoveInstances instances={selectedRows} onDone={clearSelection} />
        )}
        pageSize={20}
        page={search.page ?? 1}
        onPageChange={(page) => set({ page: page <= 1 ? undefined : page })}
        initialSort={{ id: "executions", dir: "desc" }}
        filtersActive={filtersActive}
        onClearFilters={() => void navigate({ search: { query: search.query }, replace: true })}
        filterContent={
          <>
            <label>
              Subscription
              <select value={subscription} onChange={(e) => set({ subscription: e.target.value === "all" ? undefined : e.target.value, license: undefined, page: undefined })}>
                <option value="all">All</option>
                {persona.subscriptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>
              License
              <select value={license} onChange={(e) => set({ license: e.target.value === "all" ? undefined : e.target.value, page: undefined })}>
                <option value="all">All</option>
                {licenses.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label>
              Reporting
              <select value={search.status ?? "all"} onChange={(e) => set({ status: e.target.value === "all" ? undefined : e.target.value as "reporting" | "attention", page: undefined })}>
                <option value="all">All</option>
                <option value="reporting">Reporting</option>
                <option value="attention">Not reporting</option>
              </select>
            </label>
          </>
        }
      />
    </section>
    <RemovedInstances />
  </>;
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
        <div><dt>License</dt><dd>{sub && license ? <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id, license: license.id }}>{license.label}</Link> : i.license}<small className="cell-caption mono-text">{i.license}</small></dd></div>
        <div><dt>Key type</dt><dd>{license?.environment ?? i.env}</dd></div>
        <div><dt>Subscription</dt><dd>{sub ? <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link> : "—"}{sub && <small className="cell-caption">{date(sub.start)} — {date(sub.end)}</small>}</dd></div>
        <div><dt>Subscription included quota</dt><dd>{sub ? `${fmt(sub.quota)} executions` : "—"}</dd></div>
        <div><dt>Subscription executions used</dt><dd>{summary ? fmt(summary.used) : "—"}</dd></div>
        <div><dt>Subscription remaining</dt><dd>{summary ? `${fmt(summary.remaining)} executions` : "—"}</dd></div>
        <div><dt>Environment</dt><dd>{i.env}</dd></div>
        <div><dt>Version</dt><dd>{i.version ?? "Not reported"}</dd></div>
      </dl>
    </section>
  </>;
}
