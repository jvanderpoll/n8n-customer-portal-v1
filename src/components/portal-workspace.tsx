import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronRight, CircleAlert, KeyRound } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePersona } from "./portal-shell";
import { CsvExport } from "./csv-export";
import { DataTable, type DataColumn } from "./data-table";
import { cumulativeExecutionShare, pastPeriods, periodExecutionsLabel, type PastPeriod } from "@/lib/portal-billing";
import { NOW, summarize, type Instance, type Persona, type Subscription } from "@/lib/portal-data";
import { isReporting, licensesFor, quotaColor, quotaTextColor, runningFirst, subscriptionView } from "@/lib/portal-views";
import { ago, date, fmt } from "@/lib/portal-format";

export { CsvExport } from "./csv-export";
export { DataTable, type DataColumn } from "./data-table";

const short = (n: number) => Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(0)}k` : String(n);
const percent = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function WorkspaceTitle({ title, trailing, crumbs }: { title: string; trailing?: React.ReactNode; crumbs?: React.ReactNode }) {
  return <div className="workspace-title-block">{crumbs && <nav aria-label="Breadcrumb" className="breadcrumbs">{crumbs}</nav>}<div className="workspace-title"><h1>{title}</h1>{trailing}</div></div>;
}

export function Crumb({ children }: { children: React.ReactNode }) {
  return <>{children}<ChevronRight size={14} aria-hidden="true" /></>;
}

export function LastUpdate({ persona }: { persona: Persona }) {
  return <span className="update-label">Last update {ago(persona.usageUpdated)}</span>;
}

function Requirements({ subscription }: { subscription: Subscription }) {
  if (!subscription.requirements?.length) return null;
  return <div className="contract-note"><strong>Contract requirements</strong><ul>{subscription.requirements.map((r) => <li key={r}>{r}</li>)}</ul></div>;
}

type OverviewSubRow = {
  id: string;
  name: string;
  pct: number;
  used: number;
  reportingCount: number;
  renewalLabel: string;
  renewalSort: string;
};

export function OverviewDashboard() {
  const persona = usePersona();
  const navigate = useNavigate();
  const { running } = runningFirst(persona);
  const totals = running.reduce(
    (acc, sub) => {
      const summary = summarize(sub, persona.instances);
      return {
        used: acc.used + summary.used,
        reporting: acc.reporting + summary.reportingCount,
      };
    },
    { used: 0, reporting: 0 },
  );
  const rows: OverviewSubRow[] = running.map((sub) => {
    const summary = summarize(sub, persona.instances);
    return {
      id: sub.id,
      name: sub.name,
      pct: summary.pct,
      used: summary.used,
      reportingCount: summary.reportingCount,
      renewalLabel: sub.renewal ? `Renews ${date(sub.renewal)}` : `Ends ${date(sub.end)}`,
      renewalSort: sub.renewal ?? sub.end,
    };
  });
  const columns: DataColumn<OverviewSubRow>[] = [
    { id: "name", header: "Subscription", accessor: (r) => r.name, cell: (r) => r.name },
    {
      id: "quota",
      header: "Quota",
      numeric: true,
      accessor: (r) => r.pct,
      cell: (r) => <span className="quota-figure" style={{ color: quotaTextColor(r.pct) }}>{percent(r.pct)} of quota</span>,
      csv: (r) => percent(r.pct),
    },
    {
      id: "executions",
      header: "Executions",
      numeric: true,
      accessor: (r) => r.used,
      cell: (r) => fmt(r.used),
    },
    {
      id: "instances",
      header: "Instances reporting",
      numeric: true,
      accessor: (r) => r.reportingCount,
      cell: (r) => plural(r.reportingCount, "instance"),
      csv: (r) => String(r.reportingCount),
    },
    {
      id: "renewal",
      header: "Renewal",
      accessor: (r) => r.renewalSort,
      cell: (r) => r.renewalLabel,
      csv: (r) => r.renewalLabel,
    },
  ];

  return (
    <>
      <div className="metric-strip overview-totals" aria-label="Account totals">
        <Link to="/subscriptions" className="summary-metric summary-metric-link">
          <span className="metric-label">Running subscriptions</span>
          <strong>{running.length}</strong>
        </Link>
        <Link to="/subscriptions" className="summary-metric summary-metric-link">
          <span className="metric-label">Executions used</span>
          <strong>{fmt(totals.used)}</strong>
        </Link>
        <Link to="/instances" className="summary-metric summary-metric-link">
          <span className="metric-label">Instances reporting</span>
          <strong>{totals.reporting}</strong>
        </Link>
      </div>
      <section className="workspace-panel">
        <div className="panel-heading">
          <div>
            <h2>Running subscriptions</h2>
            <span className="supporting">Quota use and renewal for each active contract.</span>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          searchPlaceholder="Search subscriptions…"
          csvFilename="running-subscriptions.csv"
          empty="No subscriptions."
          onRowClick={(r) => void navigate({ to: "/subscriptions", search: { subscription: r.id } })}
        />
      </section>
      <p className="overview-footnote">
        <Link to="/subscriptions" className="text-link quiet-link">View all subscriptions <ArrowUpRight size={14} /></Link>
      </p>
    </>
  );
}

export function SubscriptionCard({ subscription: sub, linked = false }: { subscription: Subscription; linked?: boolean }) {
  const persona = usePersona();
  const view = subscriptionView(persona, sub);
  const { summary, period } = view;
  const running = view.status === "Running";
  const fill = running ? quotaColor(summary.pct) : "var(--color--neutral-400, var(--portal-caption))";
  const figureColor = running ? quotaTextColor(summary.pct) : undefined;
  const timePct = Math.min(1, Math.max(0, period.pct));
  const leadDate = running
    ? sub.renewal ? `Renews ${date(sub.renewal)}` : `Ends ${date(sub.end)}`
    : `Ended ${date(sub.end)}`;
  return <section className={`workspace-panel subscription-card${running ? "" : " is-expired"}`} aria-label={sub.name}>
    <div className="panel-heading">
      <div className="agreement-heading">
        <KeyRound className="agreement-symbol" size={18} aria-hidden="true" />
        <div>
          <h2>{linked ? <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link> : sub.name}</h2>
          <span className="supporting">{sub.plan}</span>
        </div>
      </div>
      <div className="lead-date">
        <span className={`status-badge${running ? "" : " neutral-badge"}`}>{running && <Check size={12} />}{view.status}</span>
        <strong>{leadDate}</strong>
      </div>
    </div>
    <div className="usage-meter">
      <div className="usage-meter-head">
        <strong className="quota-figure" style={figureColor ? { color: figureColor } : undefined}>{percent(summary.pct)}</strong>
        <span>of quota used · {fmt(summary.used)} of {fmt(sub.quota)} executions</span>
      </div>
      <div className="quota-bar" role="progressbar" aria-label="Quota used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(summary.pct * 100)}>
        <span style={{ width: `${Math.min(100, summary.pct * 100)}%`, background: fill }} />
        <i className="time-marker" style={{ left: `${timePct * 100}%` }} aria-hidden="true" />
      </div>
      <div className="usage-meter-scale">
        <span className="time-label" style={{ left: `${timePct * 100}%`, transform: `translateX(-${timePct * 100}%)` }}>{running ? `${plural(period.daysLeft, "day")} left` : "Period ended"}</span>
      </div>
    </div>
    <dl className="subscription-facts">
      <div><dt>Period</dt><dd>{date(sub.start)} — {date(sub.end)}</dd></div>
      <div><dt>Time left</dt><dd>{running ? plural(period.daysLeft, "day") : "Ended"}</dd></div>
      <div><dt>Quota resets at renewal</dt><dd>{sub.quotaResetsAtRenewal ? "Yes" : "No"}</dd></div>
    </dl>
    <Requirements subscription={sub} />
    <div className="agreement-actions">
      <span>{plural(summary.reportingCount, "instance")} reporting</span>
      {linked && <Link to="/subscriptions" search={{ subscription: sub.id }} className="quiet-link">View subscription <ArrowUpRight size={14} /></Link>}
    </div>
  </section>;
}

const eur = (amount: number) => `€${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function standingLabel(period: PastPeriod) {
  if (period.standing === "in-progress") return "In progress";
  if (period.standing === "on-quota") return "On quota";
  const gap = fmt(Math.abs(period.delta));
  return period.standing === "over" ? `Over by ${gap}` : `Under by ${gap}`;
}

export function PastPeriods({ subscription: sub }: { subscription: Subscription }) {
  const persona = usePersona();
  const periods = pastPeriods(sub, persona.instances);
  const columns: DataColumn<PastPeriod>[] = [
    { id: "period", header: "Period", accessor: (p) => p.start, cell: (p) => p.label, csv: (p) => p.label },
    {
      id: "executions",
      header: "Executions",
      numeric: true,
      accessor: (p) => p.executions,
      cell: (p) => {
        const ratio = p.quota > 0 ? p.executions / p.quota : 0;
        return (
          <span className="quota-figure" style={{ color: quotaTextColor(ratio) }}>
            {fmt(p.executions)}/{fmt(p.quota)}
          </span>
        );
      },
      csv: (p) => periodExecutionsLabel(p),
    },
    { id: "standing", header: "Against quota", accessor: (p) => standingLabel(p), cell: (p) => standingLabel(p) },
    {
      id: "amount",
      header: "Amount",
      numeric: true,
      accessor: (p) => p.amountEur,
      cell: (p) => (p.amountEur == null ? "—" : eur(p.amountEur)),
      csv: (p) => (p.amountEur == null ? "" : p.amountEur.toFixed(2)),
    },
  ];
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>Past periods ({periods.length})</h2>
          <span className="supporting">Executions are counted per contract billing period. Amount uses the published Business price, €667 for 40,000 executions, because Enterprise is custom. A closed period is billed for its quota, plus any executions over that quota.</span>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={[...periods].reverse()}
        rowKey={(p) => p.id}
        searchPlaceholder="Search periods…"
        csvFilename={`${sub.name}-past-periods.csv`}
        empty="No past periods."
        initialSort={{ id: "period", dir: "desc" }}
      />
    </section>
  );
}

function usageChartPoints(sub: Subscription, used: number, ended: boolean) {
  const start = Date.parse(sub.start);
  const end = Date.parse(sub.end);
  const now = ended ? end : Math.min(Date.parse(NOW), end);
  const data: { time: number; date: string; used: number | null; quota: number }[] = Array.from({ length: 13 }, (_, i) => {
    const time = start + (now - start) * i / 12;
    return {
      time,
      date: new Date(time).toISOString().slice(0, 10),
      used: Math.round(used * cumulativeExecutionShare(i / 12)),
      quota: sub.quota,
    };
  });
  if (now < end) data.push({ time: end, date: new Date(end).toISOString().slice(0, 10), used: null, quota: sub.quota });
  return { start, end, now, data };
}

export function UsagePanel({ subscription: sub }: { subscription: Subscription }) {
  const persona = usePersona();
  const { summary, status } = subscriptionView(persona, sub);
  const ended = status === "Expired";
  const { data } = usageChartPoints(sub, summary.used, ended);
  const exportRows = data
    .filter((point) => point.used != null)
    .map((point) => [point.date, String(point.used), String(point.quota)]);
  return (
    <section className="workspace-panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Usage over time</h2>
          <span className="supporting">Cumulative executions this period</span>
        </div>
        <CsvExport
          filename={`${sub.name}-usage.csv`}
          headers={["Date", "Executions", "Quota"]}
          rows={exportRows}
          label="Download usage chart data"
        />
      </div>
      <UsageChart subscription={sub} used={summary.used} ended={ended} />
    </section>
  );
}

function UsageChart({ subscription: sub, used, ended }: { subscription: Subscription; used: number; ended: boolean }) {
  const { start, end, data } = usageChartPoints(sub, used, ended);
  const ticks = Array.from({ length: 5 }, (_, i) => start + (end - start) * i / 4);
  const ceiling = Math.max(used, sub.quota, 1) * 1.13;
  return <><div className="chart-legend"><span><i />Executions</span><span><i className="legend-quota" />Quota · {short(sub.quota)}</span></div><div className="usage-chart" role="img" aria-label={`Executions: ${fmt(used)}${ended ? ` at the end of the period` : ` as of ${date(NOW)}`}, quota ${fmt(sub.quota)}`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 14, right: 16, left: -4, bottom: 0 }}><defs><linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color--orange-700)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--color--orange-700)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis type="number" dataKey="time" domain={[start, end]} ticks={ticks} tickFormatter={(v: number) => new Date(v).toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" })} tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, ceiling]} tickFormatter={short} tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} tickCount={4} /><Tooltip labelFormatter={(v) => date(new Date(Number(v)).toISOString())} formatter={(v, name) => [fmt(Number(v)), name === "used" ? "Executions" : "Quota"]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--portal-surface)", color: "var(--portal-text)", fontSize: 14, boxShadow: "0 8px 24px #0002" }} /><Line type="linear" dataKey="quota" stroke="var(--portal-caption)" strokeDasharray="5 5" strokeWidth={1.25} dot={false} isAnimationActive={false} /><Area type="monotone" dataKey="used" stroke="var(--color--orange-700)" strokeWidth={2.5} fill="url(#usage-fill)" activeDot={{ r: 4, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div></>;
}

type LicenseRow = ReturnType<typeof licensesFor>[number];

export function LicenseTable({ subscription: sub }: { subscription: Subscription }) {
  const persona = usePersona();
  const navigate = useNavigate();
  const licenses = licensesFor(persona, sub.id);
  const columns: DataColumn<LicenseRow>[] = [
    {
      id: "label",
      header: "License",
      accessor: (l) => l.label,
      cell: (l) => (
        <>
          {l.label}
          {l.status !== "Active" && <small className="cell-caption">{l.status}</small>}
        </>
      ),
      csv: (l) => l.label,
    },
    { id: "id", header: "Reference", accessor: (l) => l.id, cell: (l) => <span className="mono-text">{l.id}</span> },
    { id: "environment", header: "Environment", accessor: (l) => l.environment, cell: (l) => l.environment },
    {
      id: "executions",
      header: "Executions",
      numeric: true,
      accessor: (l) => l.executions,
      cell: (l) => (l.executions === null ? "—" : fmt(l.executions)),
      csv: (l) => (l.executions === null ? "" : String(l.executions)),
    },
    {
      id: "reporting",
      header: "Instances reporting",
      numeric: true,
      accessor: (l) => l.reportingCount,
      cell: (l) => l.reportingCount,
    },
  ];
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>Licenses ({licenses.length})</h2>
          <span className="supporting">Usage sums from each license’s instances. The quota applies to the subscription.</span>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={licenses}
        rowKey={(l) => l.id}
        searchPlaceholder="Search licenses…"
        csvFilename={`${sub.name}-licenses.csv`}
        empty="No licenses on this subscription."
        onRowClick={(l) => void navigate({ to: "/subscriptions", search: { subscription: sub.id, license: l.id } })}
      />
    </section>
  );
}

export function ReportingStatus({ instance: i }: { instance: Instance }) {
  const ok = isReporting(i);
  return <span className={`reporting-status ${ok ? "" : "attention-status"}`}>{ok ? <Check size={12} /> : <CircleAlert size={12} />}{i.status === "error" ? "Reporting error" : i.status === "pending" ? i.lastReport ? `Last report ${ago(i.lastReport)}` : "Awaiting first report" : i.lastReport ? `Reported ${ago(i.lastReport)}` : "Reported"}</span>;
}

export function InstanceList({ instances, empty = "No instances activated on this license." }: { instances: Instance[]; empty?: string }) {
  const persona = usePersona();
  const navigate = useNavigate();
  const rows = [...instances].sort((a, b) => (b.executions ?? -1) - (a.executions ?? -1) || a.name.localeCompare(b.name));
  const columns: DataColumn<Instance>[] = [
    { id: "name", header: "Instance", accessor: (i) => i.name, cell: (i) => i.name },
    {
      id: "license",
      header: "License",
      accessor: (i) => persona.licenses.find((l) => l.id === i.license)?.label ?? i.license,
      cell: (i) => <span className="license-name">{persona.licenses.find((l) => l.id === i.license)?.label ?? i.license}</span>,
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
      id: "status",
      header: "Reporting status",
      accessor: (i) => i.status === "error" ? "Reporting error" : i.status === "pending" ? (i.lastReport ? `Last report ${ago(i.lastReport)}` : "Awaiting first report") : i.lastReport ? `Reported ${ago(i.lastReport)}` : "Reported",
      cell: (i) => <ReportingStatus instance={i} />,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(i) => i.id}
      searchPlaceholder="Search instances…"
      csvFilename="covered-instances.csv"
      empty={empty}
      onRowClick={(i) => void navigate({ to: "/instances", search: { instance: i.id } })}
      initialSort={{ id: "executions", dir: "desc" }}
    />
  );
}
