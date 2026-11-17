import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleAlert, PanelRight, X } from "lucide-react";
import { z } from "zod";
import { usePersona } from "@/components/portal-shell";
import { TruncatedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Crumb, CsvExport, DataTable, LastUpdate, MonthlyUsageBars, ReportingStatus, WorkspaceTitle, type DataColumn } from "@/components/portal-workspace";
import { BulkRemoveInstances, InstanceActions, RemovedInstances } from "@/components/portal-management";
import { activeInstances } from "@/lib/portal-management";
import { instanceProjects, instanceShare, instanceUsageMonths, instanceWorkflows, projectUsageMonths, workflowUsageMonths, type InstanceProject, type InstanceWorkflow, type UsageMonth } from "@/lib/portal-instance-activity";
import { fmt, portalHead, timestamp } from "@/lib/portal-format";
import { summarize, type Instance } from "@/lib/portal-data";
import { defaultInstanceFilter, filterInstances, hasNotReported, instanceHosting, subscriptionShare } from "@/lib/portal-views";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  subscription: z.string().optional().catch(undefined),
  license: z.string().optional().catch(undefined),
  status: z.enum(["reporting", "attention"]).optional().catch(undefined),
  hosting: z.enum(["Cloud", "Self-hosted"]).optional().catch(undefined),
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
  const hosting = search.hosting ?? "all";
  const filteredRows = filterInstances(persona, {
    ...defaultInstanceFilter,
    subscription,
    license,
    status: search.status ?? "all",
    hosting,
    query: "",
    sort: "usage",
  });
  const filtersActive = subscription !== "all" || license !== "all" || Boolean(search.status) || hosting !== "all";
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
      header: "License key",
      accessor: (i) => i.license,
      cell: (i) => <span className="mono-text license-key">{i.license}</span>,
    },
    {
      id: "hosting",
      header: "Hosting",
      accessor: (i) => instanceHosting(i, persona),
      cell: (i) => instanceHosting(i, persona),
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
      header: "Share of usage",
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
      cell: (i) => hasNotReported(i) ? <span className="reporting-status attention-status"><CircleAlert size={12} />Not reporting</span> : (i.lastReport ? timestamp(i.lastReport) : "—"),
      csv: (i) => hasNotReported(i) ? "Not reporting" : (i.lastReport ?? ""),
    },
  ];

  return <>
    <WorkspaceTitle title={`Instances (${count})`} trailing={<LastUpdate persona={persona} />} />
    <section className="workspace-panel">
      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(i) => i.id}
        searchPlaceholder="Search name or license…"
        search={search.query ?? ""}
        onSearchChange={(value) => set({ query: value || undefined, page: undefined })}
        csvFilename="instances.csv"
        empty={count === 0 && !filtersActive ? "No instances." : "No instances match your filters."}
        onRowClick={(i) => void navigate({ to: "/instances", search: { instance: i.id } })}
        rowActions={(i) => <InstanceActions instance={i} />}
        bulkActions={({ selectedRows, clearSelection }) => (
          <BulkRemoveInstances instances={selectedRows} onDone={clearSelection} />
        )}
        pageSize={20}
        page={search.page ?? 1}
        onPageChange={(page) => set({ page: page <= 1 ? undefined : page })}
        initialSort={{ id: "executions", dir: "desc" }}
        rowClassName={(i) => (hasNotReported(i) ? "not-reporting-row" : undefined)}
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
              License key
              <select value={license} onChange={(e) => set({ license: e.target.value === "all" ? undefined : e.target.value, page: undefined })}>
                <option value="all">All</option>
                {licenses.map((l) => <option key={l.id} value={l.id}>{l.id}</option>)}
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
            <label>
              Hosting
              <select value={hosting} onChange={(e) => set({ hosting: e.target.value === "all" ? undefined : e.target.value as "Cloud" | "Self-hosted", page: undefined })}>
                <option value="all">All</option>
                <option value="Cloud">Cloud</option>
                <option value="Self-hosted">Self-hosted</option>
              </select>
            </label>
          </>
        }
      />
    </section>
    <RemovedInstances />
  </>;
}

type InstanceSection = "details" | "projects" | "workflows";

function PastMonths({ months, csvFilename }: { months: UsageMonth[]; csvFilename: string }) {
  const rows = months.map((month) => [month.shortLabel, String(month.executions)]);
  return (
    <>
      <div className="past-months-heading-row">
        <h3 className="past-months-heading">Past months</h3>
        <CsvExport filename={csvFilename} headers={["Month", "Executions"]} rows={rows} />
      </div>
      <table className="label-value-table past-months-table">
        <thead>
          <tr><th scope="col"><TruncatedCell>Month</TruncatedCell></th><th scope="col" className="numeric"><TruncatedCell>Executions</TruncatedCell></th></tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.id}>
              <th scope="row"><TruncatedCell>{month.shortLabel}</TruncatedCell></th>
              <td className="numeric"><TruncatedCell>{fmt(month.executions)}</TruncatedCell></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function UsageHistory({ title, termTotal, months, csvFilename, embedded = false }: { title: string; termTotal: number | null; months: UsageMonth[]; csvFilename: string; embedded?: boolean }) {
  const chart = months.length ? (
    <>
      <MonthlyUsageBars points={months} label={`Monthly executions for ${title}`} />
      <div className="chart-legend"><span><i className="legend-bar" />Executions</span></div>
      <PastMonths months={months} csvFilename={csvFilename} />
    </>
  ) : <p className="panel-empty">No usage reported yet.</p>;
  if (embedded) {
    return (
      <div className="usage-history usage-history--embedded">
        {termTotal !== null && <p className="supporting">{fmt(termTotal)} this term</p>}
        {chart}
      </div>
    );
  }
  return (
    <section className="workspace-panel chart-panel usage-history">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {termTotal !== null && <span className="supporting">{fmt(termTotal)} this term</span>}
        </div>
      </div>
      {chart}
    </section>
  );
}

function PeekName({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <span className="peek-name">
      <TruncatedCell>{name}</TruncatedCell>
      <Button type="button" variant="ghost" size="icon" aria-label={`Open ${name}`} onClick={(event) => { event.stopPropagation(); onOpen(); }}>
        <PanelRight />
      </Button>
    </span>
  );
}

function InstanceDetail({ instance: i }: { instance: Instance }) {
  const persona = usePersona();
  const [section, setSection] = useState<InstanceSection>("details");
  const [projectFilter, setProjectFilter] = useState("all");
  const [peek, setPeek] = useState<{ kind: "project" | "workflow"; id: string } | null>(null);
  const sub = persona.subscriptions.find((s) => s.id === i.subscriptionId);
  const license = persona.licenses.find((l) => l.id === i.license);
  const summary = sub ? summarize(sub, persona.instances) : null;
  const projects = instanceProjects(i);
  const workflows = instanceWorkflows(i);
  const visibleWorkflows = projectFilter === "all" ? workflows : workflows.filter((workflow) => workflow.project === projectFilter);
  const instanceMonths = sub ? instanceUsageMonths(i, sub, persona.instances) : [];
  const latestMonth = i.executions === null ? null : instanceMonths.at(-1)?.executions ?? null;
  const peekProject = peek?.kind === "project" ? projects.find((project) => project.id === peek.id) ?? null : null;
  const peekWorkflow = peek?.kind === "workflow" ? workflows.find((workflow) => workflow.id === peek.id) ?? null : null;
  const peekTitle = peekProject?.name ?? peekWorkflow?.name ?? "";
  const peekTotal = peekProject?.executions ?? peekWorkflow?.executions ?? null;
  const peekMonths = !sub ? [] : peekProject ? projectUsageMonths(i, peekProject, sub, persona.instances) : peekWorkflow ? workflowUsageMonths(i, peekWorkflow, sub, persona.instances) : [];

  useEffect(() => {
    setSection("details");
    setProjectFilter("all");
    setPeek(null);
  }, [i.id]);

  useEffect(() => {
    setPeek(null);
  }, [section]);

  const workflowCount = (project: InstanceProject) => workflows.filter((workflow) => workflow.project === project.name).length;
  const projectColumns: DataColumn<InstanceProject>[] = [
    {
      id: "project",
      header: "Project",
      accessor: (project) => project.name,
      truncate: false,
      cell: (project) => <PeekName name={project.name} onOpen={() => setPeek({ kind: "project", id: project.id })} />,
    },
    {
      id: "workflows",
      header: "Workflows",
      numeric: true,
      accessor: workflowCount,
      cell: (project) => fmt(workflowCount(project)),
      csv: (project) => String(workflowCount(project)),
    },
    {
      id: "executions",
      header: "Executions",
      numeric: true,
      accessor: (project) => project.executions,
      cell: (project) => fmt(project.executions),
      csv: (project) => String(project.executions),
    },
    {
      id: "share",
      header: "Share of this instance",
      numeric: true,
      accessor: (project) => (i.executions && i.executions > 0 ? project.executions / i.executions : 0),
      cell: (project) => instanceShare(project.executions, i.executions),
      csv: (project) => instanceShare(project.executions, i.executions),
    },
  ];
  const workflowColumns: DataColumn<InstanceWorkflow>[] = [
    {
      id: "workflow",
      header: "Workflow",
      accessor: (workflow) => workflow.name,
      truncate: false,
      cell: (workflow) => <PeekName name={workflow.name} onOpen={() => setPeek({ kind: "workflow", id: workflow.id })} />,
    },
    { id: "project", header: "Project", accessor: (workflow) => workflow.project, cell: (workflow) => workflow.project },
    {
      id: "executions",
      header: "Executions",
      numeric: true,
      accessor: (workflow) => workflow.executions,
      cell: (workflow) => fmt(workflow.executions),
      csv: (workflow) => String(workflow.executions),
    },
    {
      id: "share",
      header: "Share of this instance",
      numeric: true,
      accessor: (workflow) => (i.executions && i.executions > 0 ? workflow.executions / i.executions : 0),
      cell: (workflow) => instanceShare(workflow.executions, i.executions),
      csv: (workflow) => instanceShare(workflow.executions, i.executions),
    },
  ];

  return <>
    <WorkspaceTitle title={i.name} crumbs={<Crumb><Link to="/instances">Instances</Link></Crumb>} trailing={i.archived ? <span className="status-badge neutral-badge">Removed</span> : <InstanceActions instance={i} />} />
    {hasNotReported(i) && (
      <div className="notice notice-warning" role="status">
        <CircleAlert size={16} />
        <strong>This instance hasn't reported since {i.lastReport ? timestamp(i.lastReport) : ""}.</strong>
      </div>
    )}
    <div className="subscription-tabs" role="tablist" aria-label="Instance sections">
      <button type="button" role="tab" aria-selected={section === "details"} className={cn("subscription-tab", section === "details" && "is-active")} onClick={() => setSection("details")}>
        Details
      </button>
      <button type="button" role="tab" aria-selected={section === "projects"} className={cn("subscription-tab", section === "projects" && "is-active")} onClick={() => setSection("projects")}>
        Projects
      </button>
      <button type="button" role="tab" aria-selected={section === "workflows"} className={cn("subscription-tab", section === "workflows" && "is-active")} onClick={() => setSection("workflows")}>
        Workflows
      </button>
    </div>
    {hasNotReported(i) && section === "details" && (
      <section className="workspace-panel">
        <table className="label-value-table">
          <tbody>
            {sub && <tr><th scope="row"><TruncatedCell>Hosting</TruncatedCell></th><td><TruncatedCell>{instanceHosting(i, persona)}</TruncatedCell></td></tr>}
            <tr><th scope="row"><TruncatedCell>Environment</TruncatedCell></th><td><TruncatedCell>{i.env}</TruncatedCell></td></tr>
            <tr>
              <th scope="row"><TruncatedCell>License key</TruncatedCell></th>
              <td className="mono-text"><TruncatedCell>{sub && license ? <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id, license: license.id }}>{i.license}</Link> : i.license}</TruncatedCell></td>
            </tr>
            {sub && <tr><th scope="row"><TruncatedCell>Subscription</TruncatedCell></th><td><TruncatedCell><Link className="text-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link></TruncatedCell></td></tr>}
          </tbody>
        </table>
      </section>
    )}
    {hasNotReported(i) && section === "projects" && <p className="panel-empty">We couldn't retrieve the projects.</p>}
    {hasNotReported(i) && section === "workflows" && <p className="panel-empty">We couldn't retrieve the workflows.</p>}
    {!hasNotReported(i) && section === "details" && (
      <>
        <div className="metric-strip instance-headlines" aria-label="Instance usage">
          <div className="summary-metric">
            <span className="metric-label">Executions this month</span>
            <strong>{latestMonth === null ? "No usage reported yet" : fmt(latestMonth)}</strong>
          </div>
          <div className="summary-metric">
            <span className="metric-label">Share of the subscription</span>
            <strong>{summary ? subscriptionShare(i.executions, summary.used) : "—"}</strong>
          </div>
          <div className="summary-metric summary-metric-report">
            <span className="metric-label">Last report</span>
            <strong>{i.lastReport ? timestamp(i.lastReport) : "No report received"}</strong>
          </div>
        </div>
        <section className="workspace-panel">
          <table className="label-value-table">
            <tbody>
              <tr><th scope="row"><TruncatedCell>Reporting status</TruncatedCell></th><td><TruncatedCell><ReportingStatus instance={i} /></TruncatedCell></td></tr>
              <tr><th scope="row"><TruncatedCell>Hosting</TruncatedCell></th><td><TruncatedCell>{sub ? instanceHosting(i, persona) : "—"}</TruncatedCell></td></tr>
              <tr><th scope="row"><TruncatedCell>Environment</TruncatedCell></th><td><TruncatedCell>{i.env}</TruncatedCell></td></tr>
              <tr><th scope="row"><TruncatedCell>Version</TruncatedCell></th><td><TruncatedCell>{i.version ?? "Not reported"}</TruncatedCell></td></tr>
              <tr>
                <th scope="row"><TruncatedCell>License key</TruncatedCell></th>
                <td className="mono-text"><TruncatedCell>{sub && license ? <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id, license: license.id }}>{i.license}</Link> : i.license}</TruncatedCell></td>
              </tr>
              <tr><th scope="row"><TruncatedCell>Subscription</TruncatedCell></th><td><TruncatedCell>{sub ? <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link> : "—"}</TruncatedCell></td></tr>
            </tbody>
          </table>
        </section>
        <UsageHistory title="Monthly executions" termTotal={i.executions} months={instanceMonths} csvFilename={`${i.name}-past-months.csv`} />
      </>
    )}
    {!hasNotReported(i) && section === "projects" && (
      <>
        <section className="workspace-panel">
          <DataTable
            columns={projectColumns}
            rows={projects}
            rowKey={(project) => project.id}
            searchPlaceholder="Search projects…"
            csvFilename={`${i.name}-projects.csv`}
            empty="No projects on this instance."
            initialSort={{ id: "executions", dir: "desc" }}
            showFilters={false}
          />
        </section>
      </>
    )}
    {!hasNotReported(i) && section === "workflows" && (
      <>
      <section className="workspace-panel">
        <DataTable
          columns={workflowColumns}
          rows={visibleWorkflows}
          rowKey={(workflow) => workflow.id}
          searchPlaceholder="Search workflows…"
          csvFilename={`${i.name}-workflows.csv`}
          empty={projectFilter === "all" ? "No workflows on this instance." : "No workflows match your filters."}
          initialSort={{ id: "executions", dir: "desc" }}
          filtersActive={projectFilter !== "all"}
          onClearFilters={() => setProjectFilter("all")}
          filterContent={
            <label>
              Project
              <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option value="all">All</option>
                {projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
              </select>
            </label>
          }
        />
      </section>
    </>
  )}
    <Sheet open={peek !== null && Boolean(peekTitle)} onOpenChange={(open) => { if (!open) setPeek(null); }}>
      <SheetContent side="right" hideClose overlayClassName="usage-peek-overlay" className="usage-peek">
        <div className="usage-peek-heading">
          <SheetTitle className="usage-peek-title">{peekTitle}</SheetTitle>
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Close">
              <X />
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">Monthly executions and past months for {peekTitle}.</SheetDescription>
        {peekTitle && (
          <UsageHistory
            embedded
            title={peekTitle}
            termTotal={peekTotal}
            months={peekMonths}
            csvFilename={`${i.name}-${peekTitle}-past-months.csv`}
          />
        )}
      </SheetContent>
    </Sheet>
  </>;
}
