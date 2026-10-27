import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronRight, CircleAlert, KeyRound } from "lucide-react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePersona } from "./portal-shell";
import { CsvExport } from "./csv-export";
import { DataTable, type DataColumn } from "./data-table";
import {
  cumulativeUsageChart,
  PLAN_FEATURES,
  pastPeriods,
  periodExecutionsLabel,
  planTier,
  quotaOnChartScale,
  quotaPaceSentence,
  type PastPeriod,
  type UsageBreakdown,
} from "@/lib/portal-billing";
import { summarize, type Instance, type Persona, type Subscription } from "@/lib/portal-data";
import { instanceHosting, isReporting, licensesFor, quotaColor, quotaTextColor, runningFirst, subscriptionView } from "@/lib/portal-views";
import { ago, date, fmt } from "@/lib/portal-format";

export { CsvExport } from "./csv-export";
export { DataTable, type DataColumn } from "./data-table";

const short = (n: number) => Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(0)}k` : String(n);
const percent = (n: number) => `${Math.round(n * 100)}%`;
const percent1 = (n: number) => `${(Math.round(n * 1000) / 10).toFixed(1)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const eurWhole = (amount: number) => `€${amount.toLocaleString("en-GB")}`;

export function WorkspaceTitle({ title, trailing, crumbs }: { title: string; trailing?: React.ReactNode; crumbs?: React.ReactNode }) {
  return <div className="workspace-title-block">{crumbs && <nav aria-label="Breadcrumb" className="breadcrumbs">{crumbs}</nav>}<div className="workspace-title"><h1>{title}</h1>{trailing}</div></div>;
}

export function Crumb({ children }: { children: React.ReactNode }) {
  return <>{children}<ChevronRight size={14} aria-hidden="true" /></>;
}

export function LastUpdate({ persona }: { persona: Persona }) {
  return <span className="update-label">Last update {ago(persona.usageUpdated)}</span>;
}

/** Shows contract restrictions only when they apply; hides the whole block when the contract has none. */
function Requirements({ subscription, instanceCount }: { subscription: Subscription; instanceCount: number }) {
  const extra = subscription.requirements ?? [];
  const limitLine = subscription.instanceLimit != null
    ? `${Math.max(0, subscription.instanceLimit - instanceCount)} of ${subscription.instanceLimit} instances available`
    : null;
  if (!limitLine && !extra.length) return null;
  return (
    <div className="contract-note">
      <strong>Contract requirements</strong>
      <ul>
        {limitLine && <li>{limitLine}</li>}
        {extra.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}

/** Headline features for the subscription's plan tier, sourced from n8n.io/pricing. Hidden when the tier isn't sourced. */
function PlanIncluded({ plan }: { plan: string }) {
  const tier = planTier(plan);
  const features = tier ? PLAN_FEATURES[tier] : undefined;
  if (!tier || !features?.length) return null;
  return (
    <div className="contract-note plan-included">
      <strong>What's included with {tier}</strong>
      <ul>{features.map((f) => <li key={f}>{f}</li>)}</ul>
      <a className="quiet-link" href="https://n8n.io/pricing/" target="_blank" rel="noreferrer">See full plan details <ArrowUpRight size={14} /></a>
    </div>
  );
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

export function OverviewDashboard({ emptyAction }: { emptyAction?: React.ReactNode }) {
  const persona = usePersona();
  const navigate = useNavigate();
  const { running } = runningFirst(persona);
  const primary = running[0];
  const primarySummary = primary ? summarize(primary, persona.instances) : null;
  const primaryView = primary ? subscriptionView(persona, primary) : null;
  const licenseCount = persona.licenses.filter((l) => l.status === "Active").length;
  const instanceCount = persona.instances.filter((i) => !i.archived).length;
  const executionsThisTerm = running.reduce((sum, sub) => sum + summarize(sub, persona.instances).used, 0);
  const annualQuota = running.reduce((sum, sub) => sum + sub.quota, 0);
  const quotaPct = annualQuota > 0 ? executionsThisTerm / annualQuota : 0;
  const nextRenewal = running
    .map((s) => s.renewal)
    .filter((r): r is string => Boolean(r))
    .sort()[0];
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
      cell: (r) => <span className="quota-figure" style={{ color: quotaTextColor(r.pct) }}>{percent1(r.pct)} of quota</span>,
      csv: (r) => percent1(r.pct),
    },
    {
      id: "executions",
      header: "Billable executions",
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

  const isEmpty = running.length === 0;
  return (
    <>
      <div className="account-banner">
        <span className="account-banner-label">Account</span>
        <strong className="account-banner-name">{persona.company}</strong>
        <span className="account-banner-user">{persona.user}</span>
      </div>
      <div className="metric-strip overview-totals" aria-label="Account totals">
        <div className="overview-metric-row overview-counts">
          <Link to="/subscriptions" className="summary-metric summary-metric-link">
            <span className="metric-label">Subscriptions</span>
            <strong>{running.length}</strong>
          </Link>
          <Link to="/subscriptions" className="summary-metric summary-metric-link">
            <span className="metric-label">Licenses</span>
            <strong>{licenseCount}</strong>
          </Link>
          <Link to="/instances" className="summary-metric summary-metric-link">
            <span className="metric-label">Instances</span>
            <strong>{instanceCount}</strong>
          </Link>
          <div className="summary-metric">
            <span className="metric-label">Renewal date</span>
            <strong>{nextRenewal ? date(nextRenewal) : "—"}</strong>
          </div>
        </div>
        {!isEmpty && (
          <div className="overview-metric-row overview-usage">
            <div className="summary-metric">
              <span className="metric-label">Executions this term</span>
              <strong>{fmt(executionsThisTerm)}</strong>
            </div>
            <div className="summary-metric">
              <span className="metric-label">Annual quota</span>
              <strong>{fmt(annualQuota)}</strong>
            </div>
            <div className="summary-metric">
              <span className="metric-label">Percent of quota</span>
              <strong className="quota-figure" style={{ color: quotaTextColor(quotaPct) }}>{percent1(quotaPct)}</strong>
            </div>
          </div>
        )}
      </div>
      {isEmpty ? (
        <section className="workspace-panel empty-state-panel">
          <h2>No subscriptions yet</h2>
          <p className="supporting">Request a subscription to start creating instances and reporting usage.</p>
          {emptyAction}
        </section>
      ) : (
        <>
          {primary && primarySummary && primaryView && (
            <section className="workspace-panel chart-panel overview-usage-panel">
              <BillableExecutionsChart
                subscription={primary}
                showPurchaseLink
                note={<p className="pace-line">{quotaPaceSentence(primary, primarySummary.used, primaryView.period.pct)}</p>}
              />
            </section>
          )}
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
      )}
    </>
  );
}

const BREAKDOWN_CHARTS: { id: UsageBreakdown; title: string }[] = [
  { id: "license", title: "By license" },
  { id: "instance", title: "By instance" },
];

const SERIES_COLORS = [
  "var(--color--orange-700)",
  "var(--color--purple-700)",
  "var(--color--blue-700)",
  "var(--color--green-800)",
  "var(--color--mint-800)",
  "var(--color--pink-700)",
  "var(--color--gold-700)",
  "var(--color--yellow-800)",
];

function UsageLines({
  label,
  quota,
  points,
  series,
  showQuota,
}: {
  label: string;
  quota: number;
  points: ReturnType<typeof cumulativeUsageChart>["points"];
  series: ReturnType<typeof cumulativeUsageChart>["series"];
  showQuota: boolean;
}) {
  const chartRows = points.map((point) => ({
    label: point.label,
    shortLabel: point.shortLabel,
    ...point.values,
    ...(showQuota ? { quota: point.quota } : {}),
  }));
  const peak = Math.max(1, ...points.flatMap((point) => series.map((item) => point.values[item.id] ?? 0)), ...(showQuota ? [quota] : []));
  return (
    <>
      <div className="chart-legend">
        <div className="chart-legend-series">
          {series.map((item, index) => (
            <span key={item.id}><i className="series-swatch" style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />{item.name}</span>
          ))}
          {showQuota && <span><i className="legend-quota" />Quota · {fmt(quota)}</span>}
        </div>
      </div>
      <div className="usage-chart" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows} margin={{ top: 14, right: 16, left: -4, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="shortLabel" tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, peak * 1.15]} tickFormatter={short} tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} tickCount={4} />
            <Tooltip
              labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label ?? "")}
              formatter={(value, name) => [
                fmt(Number(value)),
                name === "quota" ? "Quota" : series.find((item) => item.id === name)?.name ?? "Billable executions",
              ]}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--portal-surface)", color: "var(--portal-text)", fontSize: 14, boxShadow: "0 8px 24px #0002" }}
            />
            {showQuota && <Line type="linear" dataKey="quota" stroke="var(--portal-caption)" strokeDasharray="5 5" strokeWidth={1.25} dot={false} isAnimationActive={false} />}
            {series.map((item, index) => (
              <Line key={item.id} type="monotone" dataKey={item.id} stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function BillableExecutionsChart({ subscription: sub, showPurchaseLink = false, note }: { subscription: Subscription; showPurchaseLink?: boolean; note?: React.ReactNode }) {
  const persona = usePersona();
  const summary = summarize(sub, persona.instances);
  const subscriptionChart = cumulativeUsageChart(sub, persona.instances, persona.licenses, "term", "subscription");
  const showQuota = quotaOnChartScale(subscriptionChart.points.at(-1)?.cumulative ?? 0, sub.quota);
  const exportRows = subscriptionChart.points.map((point) => [
    point.label,
    String(point.cumulative),
    String(point.quota),
    ...subscriptionChart.series.map((item) => String(point.values[item.id] ?? 0)),
  ]);
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>Billable executions</h2>
          <span className="supporting">
            {fmt(summary.used)} of {fmt(sub.quota)} quota · <strong className="quota-figure" style={{ color: quotaTextColor(summary.pct) }}>{percent1(summary.pct)}</strong>
          </span>
        </div>
        <div className="chart-heading-actions">
          {showPurchaseLink && (
            <Link to="/subscriptions" search={{ subscription: sub.id }} className="quiet-link">View subscription <ArrowUpRight size={14} /></Link>
          )}
          <CsvExport
            filename={`${sub.name}-billable-executions.csv`}
            headers={["Billing month", "Cumulative billable executions", "Quota", ...subscriptionChart.series.map((item) => item.name)]}
            rows={exportRows}
            label="Download usage chart data"
          />
        </div>
      </div>
      {subscriptionChart.points.length === 0 ? (
        <div className="chart-empty"><strong>No billing months yet</strong><span>Usage appears once a billing period has started.</span></div>
      ) : (
        <>
          <UsageLines
            label={`Cumulative billable executions for ${sub.name}, ${fmt(summary.used)} of ${fmt(sub.quota)} quota`}
            quota={sub.quota}
            points={subscriptionChart.points}
            series={subscriptionChart.series}
            showQuota={showQuota}
          />
          {!showQuota && <p className="chart-quota-note">Quota {fmt(sub.quota)} is above this scale.</p>}
          {note}
          {BREAKDOWN_CHARTS.map((chart) => {
            const drawn = cumulativeUsageChart(sub, persona.instances, persona.licenses, "term", chart.id);
            if (!drawn.series.length) return null;
            return (
              <section key={chart.id} className="chart-section" aria-label={chart.title}>
                <h3>{chart.title}</h3>
                <UsageLines
                  label={`${chart.title} for ${sub.name}`}
                  quota={sub.quota}
                  points={drawn.points}
                  series={drawn.series}
                  showQuota={false}
                />
              </section>
            );
          })}
        </>
      )}
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
        <strong className="quota-figure" style={figureColor ? { color: figureColor } : undefined}>{percent1(summary.pct)}</strong>
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
      <div><dt>Remaining</dt><dd>{fmt(summary.remaining)} executions</dd></div>
      <div><dt>Quota resets at renewal</dt><dd>{sub.quotaResetsAtRenewal ? "Yes" : "No"}</dd></div>
      {sub.annualAmountEur != null && <div><dt>Annual amount</dt><dd>{eurWhole(sub.annualAmountEur)}</dd></div>}
    </dl>
    <Requirements subscription={sub} instanceCount={summary.instanceCount} />
    <PlanIncluded plan={sub.plan} />
    <div className="agreement-actions">
      <span>{plural(summary.reportingCount, "instance")} reporting</span>
      {view.quotaPrompt && <Link to="/instances" search={{ subscription: sub.id }} className="quiet-link">View top instances <ArrowUpRight size={14} /></Link>}
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
      header: "Billable executions",
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
          <span className="supporting">
            {sub.annualAmountEur != null
              ? `Executions are counted per contract billing period. The annual amount (${eurWhole(sub.annualAmountEur)}) is shown on the subscription summary; period amounts are not itemized here.`
              : "Executions are counted per contract billing period. Amount uses the published Business price, €667 for 40,000 executions, because Enterprise is custom. A closed period is billed for its quota, plus any executions over that quota."}
          </span>
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

export function UsagePanel({ subscription: sub }: { subscription: Subscription }) {
  return (
    <section className="workspace-panel chart-panel">
      <BillableExecutionsChart subscription={sub} />
    </section>
  );
}

type LicenseRow = ReturnType<typeof licensesFor>[number];

export function LicenseTable({ subscription: sub, actions }: { subscription: Subscription; actions?: React.ReactNode }) {
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
      header: "Billable executions",
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
        {actions}
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
      header: "Billable executions",
      numeric: true,
      accessor: (i) => i.executions,
      cell: (i) => (i.executions === null ? "—" : fmt(i.executions)),
      csv: (i) => (i.executions === null ? "" : String(i.executions)),
    },
    {
      id: "hosting",
      header: "Hosting",
      accessor: (i) => instanceHosting(i, persona),
      cell: (i) => instanceHosting(i, persona),
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
