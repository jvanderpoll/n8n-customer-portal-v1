import { Fragment as FragmentRow, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowDown, ChevronDown, ChevronRight, Check, CircleAlert, Search, SlidersHorizontal, X, Layers3 } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePersona, useManagement } from "./portal-shell";
import { InstanceActions } from "./portal-management";
import { Button } from "./ui/button";
import { Help, EmptySubscription } from "./portal-shared";
import { NOW, summarize, type Persona, type Subscription } from "@/lib/portal-data";
import { licensesFor } from "@/lib/portal-views";
import { ago, date, fmt, timestamp } from "@/lib/portal-format";

const short = (n: number) => Math.abs(n) >= 1e6 ? `${+(n / 1e6).toFixed(1)}m` : Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(0)}k` : String(n);
const metricName = (s: Subscription) => s.metric === "instances" ? "Reported instances" : "Billable executions";

export function UsageWorkspace({ subscriptionId, licenseId, onSubscriptionChange }: { subscriptionId?: string | undefined; licenseId?: string | undefined; onSubscriptionChange: (id: string) => void }) {
  const persona = usePersona();
  const sub = persona.subscriptions.find((s) => s.id === subscriptionId) ?? persona.subscriptions[0];
  if (!sub) return <><WorkspaceTitle title="Usage" /><EmptySubscription persona={persona} /></>;
  const summary = summarize(sub, persona.instances);
  const rows = persona.instances.filter((i) => !i.archived && i.subscriptionId === sub.id);
  const licenses = licensesFor(persona, sub.id);
  const over = summary.remaining !== null && summary.remaining < 0;
  return <>
    <WorkspaceTitle title="Usage" trailing={<span className="update-label">As of {date(NOW)}<Help label="About these usage figures">Illustrative sample data, fixed at {timestamp(NOW)}. Figures cover the selected agreement’s contract period. Billable executions exclude manual and sub-workflow runs. Usage already reported by removed instances stays in the agreement total.</Help></span>} />
    <div className="agreement-context">
      <div><span className="eyebrow">Agreement</span><div className="agreement-picker"><select aria-label="Select agreement" value={sub.id} onChange={(e) => onSubscriptionChange(e.target.value)}>{persona.subscriptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={15} /></div></div>
      <div className="period-context"><span className="eyebrow">Contract period</span><span>{date(sub.start)} — {date(sub.end)}</span></div>
      <Link className="quiet-link" to="/subscriptions" search={{ subscription: sub.id }}>Agreement details <ArrowUpRight size={14} /></Link>
    </div>
    <section className="metric-strip" aria-label="Agreement usage summary">
      <SummaryMetric label={metricName(sub)} value={summary.used === null ? "Unavailable" : fmt(summary.used)} note={summary.used === null ? "No usable reports" : summary.incomplete.length ? "Known usage · incomplete" : summary.pct === null ? "Current contract period" : `${Math.round(summary.pct * 100)}% of included allowance`} />
      <SummaryMetric label="Included allowance" value={summary.unlimited ? "Unlimited" : sub.quota === null ? "Unavailable" : fmt(sub.quota)} note={sub.metric === "instances" ? "Instances" : "Billable executions"} />
      <SummaryMetric label={over ? "Above allowance" : "Remaining"} value={summary.remaining === null ? "—" : fmt(Math.abs(summary.remaining))} note={summary.unlimited ? "No contracted limit" : summary.used === null ? "Usage unavailable" : sub.quota === null ? "Allowance unavailable" : summary.incomplete.length ? "Based on known usage" : over ? "Contact your account team" : sub.metric === "instances" ? "Instance capacity" : "Billable executions"} danger={over} />
      <SummaryMetric label="Next renewal" value={date(sub.renewal)} note={sub.plan ?? "Self-hosted Enterprise"} />
    </section>
    {(summary.incomplete.length > 0 || summary.used === null) && <div className="notice notice-warning"><CircleAlert size={17} /><span><strong>{summary.used === null ? "Usage is unavailable." : "Usage is incomplete."}</strong> {summary.incomplete.length} of {rows.length} instances do not have a current report.</span><Link to="/instances" search={{ subscription: sub.id, status: "incomplete" }}>Review reports <ArrowUpRight size={14} /></Link></div>}
    {over && <div className="notice notice-over"><CircleAlert size={17} /><span><strong>{fmt(Math.abs(summary.remaining!))} {sub.metric === "instances" ? "instances" : "executions"} above your allowance.</strong> Your renewal is {date(sub.renewal)}.</span></div>}
    <div className="usage-grid">
      <section className="workspace-panel chart-panel"><div className="panel-heading"><div><h2>{sub.metric === "instances" ? "Instances over time" : "Consumption over time"}</h2><span className="supporting">{sub.metric === "instances" ? "Reported instance count" : "Cumulative billable executions"}</span></div><Help label="How to read the consumption chart">Illustrative history, aligned to the current total. The dashed line is the agreement allowance. The chart ends at the sample reporting date; no future usage is projected.</Help></div><UsageChart subscription={sub} used={summary.used} /></section>
      <section className="workspace-panel"><div className="panel-heading"><div><h2>Usage by license</h2><span className="supporting">{licenses.length} {licenses.length === 1 ? "license" : "licenses"} · {rows.length} instances</span></div><Layers3 size={17} className="muted-icon" /></div>
        <div className="license-breakdown">{licenses.map((l, n) => {
          const value = l.summary.used;
          const proportion = summary.used && value !== null ? value / summary.used * 100 : 0;
          return <div className="license-contribution" key={l.id}><div className="contribution-heading"><Link to="/" search={{ subscription: sub.id, license: l.id }}><span className={`license-dot tone-${n % 3}`} />{l.label}</Link><strong>{value === null ? "—" : fmt(value)}</strong></div><div className="contribution-track" aria-hidden="true"><span className={`tone-${n % 3}`} style={{ width: `${Math.max(0, Math.min(100, proportion))}%` }} /></div><div className="contribution-caption"><span>{l.instances.length ? `${l.instances.length} instances` : value ? "Historical usage · no current instances" : "No instances activated"}</span><span>{value !== null && summary.used ? `${Math.round(proportion)}%` : ""}</span></div></div>;
        })}</div>
        <Link to="/subscriptions" search={{ subscription: sub.id }} className="panel-footer-link">View licenses <ArrowUpRight size={14} /></Link>
      </section>
    </div>
    <InstanceContribution persona={persona} subscription={sub} initialLicense={licenseId} key={`${persona.id}-${sub.id}-${licenseId ?? ""}`} />
  </>;
}

export function WorkspaceTitle({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return <div className="workspace-title"><h1>{title}</h1>{trailing}</div>;
}

function SummaryMetric({ label, value, note, danger }: { label: string; value: string; note: string; danger?: boolean }) {
  return <div className={`summary-metric${danger ? " metric-danger" : ""}`}><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-note">{note}</span></div>;
}

function UsageChart({ subscription: sub, used }: { subscription: Subscription; used: number | null }) {
  if (used === null) return <div className="chart-empty"><CircleAlert size={24} /><strong>No usage history available</strong><span>Usage will appear when reports are available.</span></div>;
  const start = Date.parse(sub.start), end = Date.parse(sub.end), now = Math.min(Date.parse(NOW), end);
  const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const ticks = Array.from({ length: 5 }, (_, i) => start + (end - start) * i / 4);
  const data: { time: number; used: number | null; quota: number | undefined }[] = Array.from({ length: 13 }, (_, i) => ({ time: start + (now - start) * i / 12, used: sub.metric === "instances" ? Math.round(used * Math.pow(i / 12, 1.28)) : Math.round(used * (0.68 * (i / 12) ** 1.5 + 0.32 * (i / 12))), quota: sub.quota && sub.quota > 0 ? sub.quota : undefined }));
  if (elapsed < 1) data.push({ time: end, used: null, quota: sub.quota && sub.quota > 0 ? sub.quota : undefined });
  const ceiling = Math.max(used, sub.quota && sub.quota > 0 ? sub.quota : 0, 1) * 1.13;
  return <><div className="chart-legend"><span><i />{sub.metric === "instances" ? "Reported instances" : "Billable executions"}</span>{sub.quota !== null && sub.quota > 0 && <span><i className="legend-quota" />Allowance · {short(sub.quota)}</span>}</div><div className="usage-chart" role="img" aria-label={`${metricName(sub)}: ${fmt(used)} as of ${date(NOW)}${sub.quota && sub.quota > 0 ? `, allowance ${fmt(sub.quota)}` : ""}`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 14, right: 16, left: -4, bottom: 0 }}><defs><linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color--orange-700)" stopOpacity={0.18} /><stop offset="100%" stopColor="var(--color--orange-700)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis type="number" dataKey="time" domain={[start, end]} ticks={ticks} tickFormatter={(v: number) => new Date(v).toLocaleDateString("en-GB", { month: "short", day: "numeric", timeZone: "UTC" })} tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, ceiling]} tickFormatter={short} tick={{ fontSize: 14, fill: "var(--portal-secondary)" }} axisLine={false} tickLine={false} tickCount={4} /><Tooltip labelFormatter={(v) => date(new Date(Number(v)).toISOString())} formatter={(v, name) => [fmt(Number(v)), name === "used" ? metricName(sub) : "Included allowance"]} contentStyle={{ borderRadius: 8, borderColor: "var(--border)", color: "var(--portal-text)", fontSize: 14 }} /><Line type="linear" dataKey="quota" stroke="var(--portal-caption)" strokeDasharray="5 5" strokeWidth={1.25} dot={false} isAnimationActive={false} /><Area type="monotone" dataKey="used" stroke="var(--color--orange-700)" strokeWidth={2.5} fill="url(#usage-fill)" activeDot={{ r: 4, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} /></ComposedChart></ResponsiveContainer></div></>;
}

export function InstanceContribution({ persona, subscription, initialQuery, initialLicense, initialIncomplete = false, inventory = false }: { persona: Persona; subscription: Subscription; initialLicense?: string | undefined; initialQuery?: string | undefined; initialIncomplete?: boolean; inventory?: boolean }) {
  const { role } = useManagement();
  const managing = inventory && role === "Admin";
  const [query, setQuery] = useState(initialQuery ?? "");
  const [license, setLicense] = useState(persona.licenses.some((l) => l.id === initialLicense && l.subscriptionId === subscription.id) ? initialLicense! : "all");
  const [incomplete, setIncomplete] = useState(initialIncomplete);
  const [sort, setSort] = useState<"usage" | "name">(subscription.metric === "instances" ? "name" : "usage");
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(6);
  const total = summarize(subscription, persona.instances).used;
  const rows = persona.instances.filter((i) => !i.archived && i.subscriptionId === subscription.id && (license === "all" || i.license === license) && (!incomplete || i.status === "pending" || i.status === "error") && `${i.name} ${i.license}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : (b.executions ?? -1) - (a.executions ?? -1));
  const oem = subscription.metric === "instances";
  return <section className="workspace-panel instances-panel"><div className="panel-heading"><div><h2>{inventory ? `${subscription.name} · instances` : oem ? "Included instances" : "Instance contribution"} <span className="count-pill">{rows.length}</span></h2><span className="supporting">{oem ? "Instances counted toward this agreement" : "Billable executions in this contract period"}</span></div>{!inventory && <Link className="quiet-link" to="/instances" search={{ subscription: subscription.id }}>All instances <ArrowUpRight size={14} /></Link>}</div>
    <div className="table-toolbar"><label className="compact-search"><Search size={15} /><span className="sr-only">Search contributing instances</span><input placeholder="Search instances…" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(6); }} /></label><details className="filter-menu"><summary><SlidersHorizontal size={14} />Filters{license !== "all" || incomplete ? " · active" : ""}</summary><div className="filter-options"><label>License<select value={license} onChange={(e) => { setLicense(e.target.value); setLimit(6); }}><option value="all">All licenses</option>{persona.licenses.filter((l) => l.subscriptionId === subscription.id).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={incomplete} onChange={(e) => { setIncomplete(e.target.checked); setLimit(6); }} />Needs attention</label></div></details>{license !== "all" && <Button variant="ghost" size="sm" className="filter-chip" onClick={() => setLicense("all")}>{persona.licenses.find((l) => l.id === license)?.label ?? license}<X size={12} /></Button>}</div>
    <div className="table-scroll"><table className="data-table"><thead><tr><th><Button variant="ghost" size="sm" onClick={() => setSort("name")}>Instance{sort === "name" && <ArrowDown size={12} />}</Button></th><th>License</th>{!oem && <th className="numeric"><Button variant="ghost" size="sm" onClick={() => setSort("usage")}>Executions{sort === "usage" && <ArrowDown size={12} />}</Button></th>}{!oem && <th>Share of usage</th>}<th>Reporting</th>{managing && <th><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{rows.slice(0, limit).map((i) => <FragmentRow key={i.id}><tr className={selected === i.id ? "selected-row" : ""}><td><Button variant="ghost" size="sm" className="instance-name" aria-expanded={selected === i.id} onClick={() => setSelected(selected === i.id ? null : i.id)}>{selected === i.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{i.name}</Button></td><td><span className="license-name">{persona.licenses.find((l) => l.id === i.license)?.label ?? i.license}</span></td>{!oem && <td className="numeric">{i.executions === null ? <span className="muted-text">Unavailable</span> : fmt(i.executions)}</td>}{!oem && <td><div className="row-share"><span><i style={{ width: `${total && i.executions !== null ? Math.min(100, i.executions / total * 100) : 0}%` }} /></span><small>{total && i.executions !== null ? `${Math.round(i.executions / total * 100)}%` : "—"}</small></div></td>}<td><span className={`reporting-status ${i.status === "pending" || i.status === "error" ? "attention-status" : ""}`}>{i.status === "pending" || i.status === "error" ? <CircleAlert size={12} /> : <Check size={12} />}{i.status === "error" ? "Unavailable" : i.status === "pending" ? i.lastReport ? "Outdated" : "Awaiting report" : i.status === "zero" ? "Zero confirmed" : i.lastReport ? ago(i.lastReport) : "Reported"}</span></td>{managing && <td><InstanceActions instance={i} /></td>}</tr>{selected === i.id && <tr className="detail-row"><td colSpan={(oem ? 3 : 5) + (managing ? 1 : 0)}><dl><div><dt>Instance ID</dt><dd>{i.id}</dd></div><div><dt>License reference</dt><dd>{i.license}</dd></div><div><dt>Environment</dt><dd>{i.env}</dd></div><div><dt>Version</dt><dd>{i.version ?? "Not reported"}</dd></div><div><dt>Last report</dt><dd>{i.lastReport ? timestamp(i.lastReport) : "No report received"}</dd></div></dl></td></tr>}</FragmentRow>)}{!rows.length && <tr><td colSpan={(oem ? 3 : 5) + (managing ? 1 : 0)} className="empty-table">{license !== "all" && !query && !incomplete ? "No instances activated on this license yet." : "No instances match your filters."}</td></tr>}</tbody></table></div>
    {rows.length > limit && <div className="show-more"><Button variant="ghost" size="sm" onClick={() => setLimit(limit + 20)}>Show more instances <ChevronDown size={14} /></Button></div>}
  </section>;
}

