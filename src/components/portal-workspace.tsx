import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronRight, CircleAlert, KeyRound, MessageCircle } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePersona } from "./portal-shell";
import { Button } from "./ui/button";
import { Help } from "./portal-shared";
import { CsvExport } from "./csv-export";
import { NOW, type Instance, type Persona, type Subscription } from "@/lib/portal-data";
import { isReporting, licensesFor, quotaColor, subscriptionView } from "@/lib/portal-views";
import { ago, date, fmt, timestamp } from "@/lib/portal-format";

export { CsvExport } from "./csv-export";

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
  return <span className="update-label">Last update {ago(persona.usageUpdated)}<Help label="About usage updates">Last update: {timestamp(persona.usageUpdated)}. Instances report usage roughly every 24 hours. Illustrative sample data.</Help></span>;
}

export function ContactCsm({ subscription, topic, children }: { subscription: Subscription; topic: "quota" | "renewal"; children: React.ReactNode }) {
  const persona = usePersona();
  return <div className={`contact-prompt contact-prompt-${topic}`} role="note"><MessageCircle size={17} aria-hidden="true" /><span>{children}</span><Button asChild variant="outline" size="sm"><Link to="/contact" search={{ topic, subscription: subscription.id }}>Contact {persona.csm}</Link></Button></div>;
}

function Requirements({ subscription }: { subscription: Subscription }) {
  if (!subscription.requirements?.length) return null;
  return <div className="contract-note"><strong>Contract requirements</strong><ul>{subscription.requirements.map((r) => <li key={r}>{r}</li>)}</ul></div>;
}

export function SubscriptionCard({ subscription: sub, linked = false }: { subscription: Subscription; linked?: boolean }) {
  const persona = usePersona();
  const view = subscriptionView(persona, sub);
  const { summary, period } = view;
  const running = view.status === "Running";
  const fill = quotaColor(summary.pct);
  return <section className={`workspace-panel subscription-card${running ? "" : " is-expired"}`} aria-label={sub.name}>
    <div className="panel-heading">
      <div className="agreement-heading"><span className="agreement-symbol"><KeyRound size={19} /></span><div><h2>{linked ? <Link to="/subscriptions" search={{ subscription: sub.id }}>{sub.name}</Link> : sub.name}</h2><span className="supporting">{sub.plan}</span></div></div>
      <div className="lead-date"><span className={`status-badge${running ? "" : " neutral-badge"}`}>{running && <Check size={12} />}{view.status}</span><strong>{running ? sub.renewal ? `Renews ${date(sub.renewal)}` : `Ends ${date(sub.end)}` : `Ended ${date(sub.end)}`}</strong></div>
    </div>
    {view.renewalPrompt && <ContactCsm subscription={sub} topic="renewal"><strong>Renewal in {plural(view.daysToRenewal!, "day")}.</strong> Talk to your CSM about your renewal.</ContactCsm>}
    <div className="usage-figures">
      <div className="usage-figure">
        <span className="metric-label">Quota used</span>
        <strong>{percent(summary.pct)}</strong>
        <div className="quota-bar" role="progressbar" aria-label="Quota used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(summary.pct * 100)}><span style={{ width: `${Math.min(100, summary.pct * 100)}%`, background: fill }} /></div>
        <span className="metric-note">{fmt(summary.used)} of {fmt(sub.quota)} executions</span>
      </div>
      <div className="usage-figure">
        <span className="metric-label">Period gone</span>
        <strong>{percent(period.pct)}</strong>
        <span className="metric-note">{date(sub.start)} — {date(sub.end)}</span>
      </div>
    </div>
    {view.quotaPrompt && <ContactCsm subscription={sub} topic="quota">{view.quotaPrompt === "over" ? <><strong>{fmt(-summary.remaining)} executions over quota.</strong> Talk to your CSM about your options.</> : <><strong>{percent(summary.pct)} of your quota is used.</strong> Talk to your CSM before you reach it.</>}</ContactCsm>}
    <dl className="subscription-facts">
      <div><dt>Quota</dt><dd>{fmt(sub.quota)} executions</dd></div>
      <div><dt>Executions used</dt><dd>{fmt(summary.used)}</dd></div>
      <div><dt>Period</dt><dd>{date(sub.start)} — {date(sub.end)}</dd></div>
      <div><dt>Time left</dt><dd>{running ? plural(period.daysLeft, "day") : "Ended"}</dd></div>
      <div><dt>Quota resets at renewal</dt><dd>{sub.quotaResetsAtRenewal ? "Yes" : "No"}</dd></div>
    </dl>
    <Requirements subscription={sub} />
    <div className="agreement-actions"><span>{plural(summary.reportingCount, "instance")} reporting</span>{linked && <Link to="/subscriptions" search={{ subscription: sub.id }} className="quiet-link">View subscription <ArrowUpRight size={14} /></Link>}</div>
  </section>;
}

export function UsagePanel({ subscription: sub }: { subscription: Subscription }) {
  const persona = usePersona();
  const { summary, status } = subscriptionView(persona, sub);
  return <section className="workspace-panel chart-panel"><div className="panel-heading"><div><h2>Usage over time</h2><span className="supporting">Cumulative executions this period</span></div><Help label="How to read the usage chart">Illustrative history, aligned to the current total. The dashed line is the subscription quota. No future usage is projected.</Help></div><UsageChart subscription={sub} used={summary.used} ended={status === "Expired"} /></section>;
}

function UsageChart({ subscription: sub, used, ended }: { subscription: Subscription; used: number; ended: boolean }) {
  const start = Date.parse(sub.start), end = Date.parse(sub.end), now = ended ? end : Math.min(Date.parse(NOW), end);
  const ticks = Array.from({ length: 5 }, (_, i) => start + (end - start) * i / 4);
  const data: { time: number; used: number | null; quota: number }[] = Array.from({ length: 13 }, (_, i) => ({ time: start + (now - start) * i / 12, used: Math.round(used * (0.68 * (i / 12) ** 1.5 + 0.32 * (i / 12))), quota: sub.quota }));
  if (now < end) data.push({ time: end, used: null, quota: sub.quota });
  const ceiling = Math.max(used, sub.quota, 1) * 1.13;
  return <><div className="chart-legend"><span><i />Executions</span><span><i className="legend-quota" />Quota · {short(sub.quota)}</span></div><div className="usage-chart" role="img" aria-label={`Executions: ${fmt(used)}${ended ? ` at the end of the period` : ` as of ${date(NOW)}`}, quota ${fmt(sub.quota)}`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 14, right: 16, left: -4, bottom: 0 }}><defs><linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color--orange-700)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--color--orange-700)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis type="number" dataKey="time" domain={[start, end]} ticks={ticks} tickFormatter={(v: number) => new Date(v).toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" })} tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, ceiling]} tickFormatter={short} tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} tickCount={4} /><Tooltip labelFormatter={(v) => date(new Date(Number(v)).toISOString())} formatter={(v, name) => [fmt(Number(v)), name === "used" ? "Executions" : "Quota"]} contentStyle={{ borderRadius: 8, borderColor: "var(--border)", color: "var(--portal-text)", fontSize: 14 }} /><Line type="linear" dataKey="quota" stroke="var(--portal-caption)" strokeDasharray="5 5" strokeWidth={1.25} dot={false} isAnimationActive={false} /><Area type="monotone" dataKey="used" stroke="var(--color--orange-700)" strokeWidth={2.5} fill="url(#usage-fill)" activeDot={{ r: 4, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div></>;
}

export function LicenseTable({ subscription: sub }: { subscription: Subscription }) {
  const persona = usePersona();
  const licenses = licensesFor(persona, sub.id);
  const csvRows = licenses.map((l) => [
    l.label,
    l.id,
    l.environment,
    l.executions === null ? "" : String(l.executions),
    String(l.reportingCount),
  ]);
  return <section className="workspace-panel"><div className="panel-heading"><div><h2>Licenses <span className="count-pill">{licenses.length}</span></h2><span className="supporting">Usage sums from each license’s instances. The quota applies to the subscription.</span></div><CsvExport filename={`${sub.name}-licenses.csv`} headers={["License", "Reference", "Environment", "Executions", "Instances reporting"]} rows={csvRows} /></div>
    <div className="table-scroll"><table className="data-table"><thead><tr><th>License</th><th>Reference</th><th>Environment</th><th className="numeric">Executions</th><th className="numeric">Instances reporting</th></tr></thead><tbody>{licenses.map((l) => <tr key={l.id}><td><Link className="table-link" to="/subscriptions" search={{ subscription: sub.id, license: l.id }}>{l.label}</Link>{l.status !== "Active" && <small className="cell-caption">{l.status}</small>}</td><td className="mono-text">{l.id}</td><td>{l.environment}</td><td className="numeric">{l.executions === null ? "—" : fmt(l.executions)}</td><td className="numeric">{l.reportingCount}</td></tr>)}{!licenses.length && <tr><td colSpan={5} className="empty-table">No licenses on this subscription.</td></tr>}</tbody></table></div>
  </section>;
}

export function ReportingStatus({ instance: i }: { instance: Instance }) {
  const ok = isReporting(i);
  return <span className={`reporting-status ${ok ? "" : "attention-status"}`}>{ok ? <Check size={12} /> : <CircleAlert size={12} />}{i.status === "error" ? "Reporting error" : i.status === "pending" ? i.lastReport ? `Last report ${ago(i.lastReport)}` : "Awaiting first report" : i.lastReport ? `Reported ${ago(i.lastReport)}` : "Reported"}</span>;
}

export function InstanceList({ instances, empty = "No instances activated on this license." }: { instances: Instance[]; empty?: string }) {
  const persona = usePersona();
  const rows = [...instances].sort((a, b) => (b.executions ?? -1) - (a.executions ?? -1) || a.name.localeCompare(b.name));
  const csvRows = rows.map((i) => [
    i.name,
    persona.licenses.find((l) => l.id === i.license)?.label ?? i.license,
    i.executions === null ? "" : String(i.executions),
    i.status === "error" ? "Reporting error" : i.status === "pending" ? (i.lastReport ? `Last report ${ago(i.lastReport)}` : "Awaiting first report") : i.lastReport ? `Reported ${ago(i.lastReport)}` : "Reported",
  ]);
  return <div className="table-block"><div className="table-toolbar"><CsvExport filename="covered-instances.csv" headers={["Instance", "License", "Executions", "Reporting status"]} rows={csvRows} /></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Instance</th><th>License</th><th className="numeric">Executions</th><th>Reporting status</th></tr></thead><tbody>{rows.map((i) => <tr key={i.id}><td><Link className="table-link" to="/instances" search={{ instance: i.id }}>{i.name}</Link></td><td><span className="license-name">{persona.licenses.find((l) => l.id === i.license)?.label ?? i.license}</span></td><td className="numeric">{i.executions === null ? "—" : fmt(i.executions)}</td><td><ReportingStatus instance={i} /></td></tr>)}{!rows.length && <tr><td colSpan={4} className="empty-table">{empty}</td></tr>}</tbody></table></div></div>;
}
