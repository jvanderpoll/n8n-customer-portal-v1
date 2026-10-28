import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronRight, CircleAlert, Copy, Info, KeyRound, RefreshCw } from "lucide-react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useManagement, usePersona } from "./portal-shell";
import { CsvExport } from "./csv-export";
import { DataTable, type DataColumn } from "./data-table";
import { Button } from "@/components/ui/button";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  cumulativeUsageChart,
  monthlyChartPoints,
  PLAN_FEATURES,
  pastPeriods,
  periodExecutionsLabel,
  planTier,
  quotaPaceSentence,
  type PastPeriod,
  type UsageBreakdown,
} from "@/lib/portal-billing";
import { NOW, summarize, type Instance, type Persona, type Subscription } from "@/lib/portal-data";
import { instanceHosting, isReporting, licensesFor, licensesGroupedByPurchase, quotaColor, quotaTextColor, runningFirst, subscriptionView } from "@/lib/portal-views";
import { ago, date, fmt, monthsAndDaysUntil } from "@/lib/portal-format";

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

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

function CopyLicenseId({ licenseId }: { licenseId: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await copyText(licenseId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="metric-license-line">
      <span className="metric-subtext metric-subtext-id">{licenseId}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="copy-license-id"
        aria-label={copied ? "License ID copied" : "Copy license ID"}
        onClick={() => void onCopy()}
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </Button>
      <span className="sr-only" role="status">{copied ? "License ID copied" : ""}</span>
    </span>
  );
}

export function LastUpdate({ persona }: { persona: Persona }) {
  const { refreshUsage } = useManagement();
  const [busy, setBusy] = useState(false);
  const onRefresh = () => {
    if (busy) return;
    setBusy(true);
    refreshUsage();
    window.setTimeout(() => setBusy(false), 280);
  };
  return (
    <span className="update-label">
      Last update {ago(persona.usageUpdated)}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="update-refresh"
        aria-label="Refresh usage data"
        disabled={busy}
        onClick={onRefresh}
      >
        <RefreshCw size={14} aria-hidden="true" className={busy ? "is-spinning" : undefined} />
      </Button>
    </span>
  );
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

/** Headline features for the subscription's plan tier, shown in a tooltip next to the subscription name. Hidden when the tier isn't sourced. */
function PlanIncludedHint({ plan }: { plan: string }) {
  const tier = planTier(plan);
  const features = tier ? PLAN_FEATURES[tier] : undefined;
  if (!tier || !features?.length) return null;
  const title = `What's included with ${tier}`;
  return (
    <TooltipProvider delayDuration={200}>
      <UiTooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="plan-included-trigger" aria-label={title}>
            <Info aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="plan-included-tooltip !text-sm">
          <strong>{title}</strong>
          <ul>{features.map((f) => <li key={f}>{f}</li>)}</ul>
        </TooltipContent>
      </UiTooltip>
    </TooltipProvider>
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
  const primaryLicenseId = persona.licenses.find((l) => l.status === "Active")?.id;
  const instanceCount = persona.instances.filter((i) => !i.archived).length;
  const executionsThisTerm = running.reduce((sum, sub) => sum + summarize(sub, persona.instances).used, 0);
  const annualQuota = running.reduce((sum, sub) => sum + sub.quota, 0);
  const quotaPct = annualQuota > 0 ? executionsThisTerm / annualQuota : 0;
  const renewalSource = running.filter((s) => s.renewal).sort((a, b) => a.renewal!.localeCompare(b.renewal!))[0];
  const nextRenewal = renewalSource?.renewal;
  const renewalIn = nextRenewal ? monthsAndDaysUntil(nextRenewal, renewalSource.billingAsOf ?? NOW) : null;
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
      </div>
      <div className="metric-strip overview-totals" aria-label="Account totals">
        <div className="overview-metric-row">
          <div className="summary-metric">
            <Link to="/subscriptions" className="summary-metric-link">
              <span className="metric-label">Subscription</span>
              <strong>{running.length === 1 ? running[0]!.name : running.length ? running.map((s) => s.name).join(", ") : "—"}</strong>
            </Link>
            {primaryLicenseId && <CopyLicenseId licenseId={primaryLicenseId} />}
          </div>
          <div className="summary-metric">
            <span className="metric-label">Renewal date</span>
            <strong>{nextRenewal ? date(nextRenewal) : "—"}</strong>
            {renewalIn && <span className="metric-subtext">{renewalIn === "today" ? "Renews today" : `${renewalIn} left`}</span>}
          </div>
          <Link to="/instances" className="summary-metric summary-metric-link">
            <span className="metric-label">Instances</span>
            <strong>{instanceCount}</strong>
          </Link>
          {!isEmpty && (
            <>
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
            </>
          )}
        </div>
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
          {/* Kept for when an account can hold more than one subscription. */}
          {false && (
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
          )}
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

/** End-of-series marker so close instance lines stay distinguishable. */
function seriesEndDot(color: string, lastIndex: number) {
  return (props: { cx?: number; cy?: number; index?: number; key?: string | number }) => {
    const show = props.index === lastIndex && props.cx != null && props.cy != null;
    return (
      <circle
        key={props.key ?? `dot-${props.index ?? 0}`}
        cx={show ? props.cx : 0}
        cy={show ? props.cy : 0}
        r={show ? 3.5 : 0}
        fill={color}
        stroke="var(--portal-surface)"
        strokeWidth={show ? 1.5 : 0}
      />
    );
  };
}

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
  const lastIndex = Math.max(0, chartRows.length - 1);
  const allValues = points.flatMap((point) => series.map((item) => point.values[item.id] ?? 0));
  const peak = Math.max(1, ...allValues, ...(showQuota ? [quota] : []));
  const axisTick = { fontSize: 13, fill: "var(--color--neutral-600)" } as const;
  const markEnds = series.length > 1;
  return (
    <>
      <div className="usage-chart" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="shortLabel" tick={axisTick} axisLine={false} tickLine={false} minTickGap={28} padding={{ left: 18, right: 12 }} />
            <YAxis
              width={44}
              domain={[0, peak * 1.1]}
              tickFormatter={short}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <Tooltip
              labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label ?? "")}
              formatter={(value, name) => [
                fmt(Number(value)),
                name === "quota" ? "Quota" : series.find((item) => item.id === name)?.name ?? "Billable executions",
              ]}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--portal-surface)", color: "var(--portal-text)", fontSize: 14, boxShadow: "0 8px 24px #0002" }}
            />
            {showQuota && <Line type="linear" dataKey="quota" stroke="var(--portal-caption)" strokeDasharray="5 5" strokeWidth={1.25} dot={false} isAnimationActive={false} />}
            {series.map((item, index) => {
              const color = SERIES_COLORS[index % SERIES_COLORS.length]!;
              const isOther = item.id === "other-instances";
              return (
                <Line
                  key={item.id}
                  type="monotone"
                  dataKey={item.id}
                  stroke={color}
                  strokeWidth={isOther ? 2.25 : 2}
                  strokeDasharray={isOther ? "5 4" : undefined}
                  dot={markEnds ? seriesEndDot(color, lastIndex) : false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        {series.map((item, index) => (
          <span key={item.id}><i className="series-swatch" style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }} />{item.name}</span>
        ))}
        {showQuota && <span><i className="legend-quota" />Quota · {fmt(quota)}</span>}
      </div>
    </>
  );
}

function MonthlyExecutionsChart({ subscription: sub, instances }: { subscription: Subscription; instances: Instance[] }) {
  const points = monthlyChartPoints(sub, instances, "term");
  const peak = Math.max(1, ...points.map((point) => point.executions));
  const peakPct = Math.max(0.02, ...points.map((point) => point.cumulativeQuotaPct));
  const axisTick = { fontSize: 13, fill: "var(--color--neutral-600)" } as const;
  const patternId = `open-month-${sub.id}`;
  return (
    <>
      <div className="usage-chart" role="img" aria-label={`Monthly executions for ${sub.name}, and the share of quota used to date`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--color--purple-200)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color--purple-700)" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="shortLabel" tick={axisTick} axisLine={false} tickLine={false} minTickGap={28} padding={{ left: 18, right: 12 }} />
            <YAxis yAxisId="executions" width={40} domain={[0, peak * 1.2]} tickFormatter={short} tick={axisTick} axisLine={false} tickLine={false} tickCount={4} />
            <YAxis yAxisId="quota" orientation="right" width={44} domain={[0, peakPct * 1.35]} tickFormatter={(value) => percent1(Number(value))} tick={axisTick} axisLine={false} tickLine={false} tickCount={4} />
            <Tooltip
              labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label ?? "")}
              formatter={(value, name) => name === "cumulativeQuotaPct"
                ? [percent1(Number(value)), "% of quota used to date"]
                : [fmt(Number(value)), "Executions"]}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--portal-surface)", color: "var(--portal-text)", fontSize: 14, boxShadow: "0 8px 24px #0002" }}
            />
            <Bar yAxisId="executions" dataKey="executions" radius={[2, 2, 0, 0]} maxBarSize={40} isAnimationActive={false}>
              {points.map((point) => <Cell key={point.id} fill={point.open ? `url(#${patternId})` : "var(--color--purple-500)"} />)}
            </Bar>
            <Line yAxisId="quota" type="monotone" dataKey="cumulativeQuotaPct" stroke="var(--color--orange-700)" strokeWidth={2} dot={{ r: 3, fill: "var(--color--orange-700)", strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        <span><i className="legend-bar" />Executions</span>
        <span><i className="legend-quota-line" />% of quota used to date</span>
      </div>
    </>
  );
}

function BillableExecutionsChart({ subscription: sub, showPurchaseLink = false, note }: { subscription: Subscription; showPurchaseLink?: boolean; note?: React.ReactNode }) {
  const persona = usePersona();
  const summary = summarize(sub, persona.instances);
  const monthly = monthlyChartPoints(sub, persona.instances, "term");
  const subscriptionChart = cumulativeUsageChart(sub, persona.instances, persona.licenses, "term", "subscription");
  const exportRows = monthly.map((point, index) => [
    point.label,
    String(point.executions),
    String(subscriptionChart.points[index]?.cumulative ?? ""),
    percent1(point.cumulativeQuotaPct),
    ...subscriptionChart.series.map((item) => String(subscriptionChart.points[index]?.values[item.id] ?? 0)),
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
            headers={["Billing month", "Executions", "Cumulative billable executions", "% of quota used to date", ...subscriptionChart.series.map((item) => item.name)]}
            rows={exportRows}
            label="Download usage chart data"
          />
        </div>
      </div>
      {subscriptionChart.points.length === 0 ? (
        <div className="chart-empty"><strong>No billing months yet</strong><span>Usage appears once a billing period has started.</span></div>
      ) : (
        <>
          <div className="chart-stack">
            <section className="chart-column chart-column--total" aria-label="Monthly executions">
              <h3>Monthly executions</h3>
              <MonthlyExecutionsChart subscription={sub} instances={persona.instances} />
            </section>
            <div className="chart-columns">
              {BREAKDOWN_CHARTS.map((chart) => {
                const drawn = cumulativeUsageChart(sub, persona.instances, persona.licenses, "term", chart.id);
                if (!drawn.series.length) return null;
                return (
                  <section key={chart.id} className="chart-column" aria-label={chart.title}>
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
            </div>
          </div>
          {note}
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
  const timePct = Math.min(1, Math.max(0, period.pct));
  const leadDate = running
    ? sub.renewal ? `Renews ${date(sub.renewal)}` : `Ends ${date(sub.end)}`
    : `Ended ${date(sub.end)}`;
  return <section className={`workspace-panel subscription-card${running ? "" : " is-expired"}`} aria-label={sub.name}>
    <div className="panel-heading">
      <div className="agreement-heading">
        <KeyRound className="agreement-symbol" size={18} aria-hidden="true" />
        <div>
          <h2>
            {linked ? <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link> : sub.name}
            <PlanIncludedHint plan={sub.plan} />
          </h2>
        </div>
      </div>
      <div className="lead-date">
        <span className={`status-badge${running ? "" : " neutral-badge"}`}>{running && <Check size={12} />}{view.status}</span>
        <strong>{leadDate}</strong>
      </div>
    </div>
    <div className="usage-meters">
      <div className="usage-meter">
        <div className="usage-meter-head">
          <span>Annual executions used</span>
          <span className="meter-value">{fmt(summary.used)} / {fmt(sub.quota)} · {percent1(summary.pct)}</span>
        </div>
        <div className="quota-bar" role="progressbar" aria-label="Annual executions used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, summary.pct * 100))}>
          <span style={{ width: `${Math.min(100, summary.pct * 100)}%`, background: fill }} />
        </div>
      </div>
      <div className="usage-meter">
        <div className="usage-meter-head">
          <span>Time into contract</span>
          <span className="meter-value">{percent1(timePct)}</span>
        </div>
        <div className="quota-bar period-bar" role="progressbar" aria-label="Time into contract" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timePct * 100)}>
          <span style={{ width: `${timePct * 100}%` }} />
        </div>
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
    <div className="agreement-actions">
      <Link to="/instances" search={{ subscription: sub.id }} className="quiet-link">{plural(summary.reportingCount, "instance")} reporting</Link>
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

export function LicenseTable({
  subscription: sub,
  actions,
  /** Cross-purchase list: heading is the purchase name (linked), not "Licenses (n)". */
  purchaseLink = false,
  rows: rowsProp,
  filterContent,
  filtersActive = false,
  onClearFilters,
}: {
  subscription: Subscription;
  actions?: React.ReactNode;
  purchaseLink?: boolean;
  /** Optional pre-filtered rows; defaults to all licenses on the subscription. */
  rows?: LicenseRow[];
  filterContent?: React.ReactNode;
  filtersActive?: boolean;
  onClearFilters?: () => void;
}) {
  const persona = usePersona();
  const navigate = useNavigate();
  const licenses = rowsProp ?? licensesFor(persona, sub.id);
  const subscriptionName = (l: LicenseRow) =>
    persona.subscriptions.find((s) => s.id === l.subscriptionId)?.name ?? sub.name;

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
    {
      id: "subscription",
      header: "Subscription",
      accessor: (l) => subscriptionName(l),
      cell: (l) => (
        <Link
          className="text-link"
          to="/subscriptions"
          search={{ subscription: l.subscriptionId }}
          onClick={(event) => event.stopPropagation()}
        >
          {subscriptionName(l)}
        </Link>
      ),
      csv: (l) => subscriptionName(l),
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
          <h2>
            {purchaseLink ? (
              <Link className="text-link" to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link>
            ) : (
              <>Licenses ({licenses.length})</>
            )}
          </h2>
          <span className="supporting">
            {purchaseLink
              ? `${licenses.length} ${licenses.length === 1 ? "license" : "licenses"}. Usage sums from each license’s instances.`
              : "Usage sums from each license’s instances. The quota applies to the subscription."}
          </span>
        </div>
        {actions}
      </div>
      <DataTable
        columns={columns}
        rows={licenses}
        rowKey={(l) => l.id}
        searchPlaceholder="Search licenses…"
        csvFilename={`${sub.name}-licenses.csv`}
        empty={filtersActive ? "No licenses match your filters." : "No licenses on this subscription."}
        onRowClick={(l) => void navigate({ to: "/subscriptions", search: { subscription: sub.id, license: l.id } })}
        filterContent={filterContent}
        filtersActive={filtersActive}
        onClearFilters={onClearFilters}
      />
    </section>
  );
}

/** Licenses across all purchases, grouped by purchase. Omits purchases with no licenses. */
export function AllLicensesList() {
  const persona = usePersona();
  const [purchaseId, setPurchaseId] = useState("all");
  const [environment, setEnvironment] = useState("all");
  const allGroups = licensesGroupedByPurchase(persona);
  const filtersActive = purchaseId !== "all" || environment !== "all";
  const clearFilters = () => {
    setPurchaseId("all");
    setEnvironment("all");
  };
  const environments = [...new Set(persona.licenses.map((l) => l.environment))].sort();
  const groups = allGroups
    .filter((group) => purchaseId === "all" || group.subscription.id === purchaseId)
    .map((group) => ({
      subscription: group.subscription,
      licenses: group.licenses.filter((l) => environment === "all" || l.environment === environment),
    }))
    .filter((group) => group.licenses.length > 0);

  if (!allGroups.length) {
    return <p className="panel-empty">No licenses.</p>;
  }

  const filterContent = (
    <>
      <label>
        Purchase
        <select value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
          <option value="all">All</option>
          {allGroups.map(({ subscription: s }) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label>
        Environment
        <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
          <option value="all">All</option>
          {environments.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
      </label>
    </>
  );

  if (!groups.length) {
    return (
      <p className="panel-empty">
        No licenses match your filters.{" "}
        <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
      </p>
    );
  }

  return (
    <div className="agreement-list">
      {groups.map(({ subscription, licenses }) => (
        <LicenseTable
          key={subscription.id}
          subscription={subscription}
          purchaseLink
          rows={licenses}
          filterContent={filterContent}
          filtersActive={filtersActive}
          onClearFilters={clearFilters}
        />
      ))}
    </div>
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
      accessor: (i) => i.license,
      cell: (i) => <span className="mono-text">{i.license}</span>,
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
