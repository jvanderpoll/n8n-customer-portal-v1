import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Instance, type Persona, type Subscription, summarize } from "@/lib/portal-data";
import { ago, date, fmt, timestamp } from "@/lib/portal-format";

export function PageHeading({ title, description }: { title: string; description: string }) {
  return <header className="mb-6"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-1 text-muted-foreground">{description}</p></header>;
}

export function Freshness({ persona }: { persona: Persona }) {
  return persona.usageUpdated ? <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />Usage updated {timestamp(persona.usageUpdated)} ({ago(persona.usageUpdated)}).<span>Instances report roughly every 24 h.</span></p> : null;
}

export function Requirements({ persona }: { persona: Persona }) {
  if (!persona.requirements.length) return null;
  return <section className="mb-6 border-l-2 border-border pl-4"><h2 className="font-semibold">Contract requirements</h2><ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">{persona.requirements.map((r) => <li key={r}>{r}</li>)}</ul></section>;
}

export function StatusText({ instance, compact = false }: { instance: Instance; compact?: boolean }) {
  if (instance.status === "pending") return <span className="inline-flex items-start gap-1.5"><Clock3 className="mt-0.5 size-3.5 shrink-0" /><span>Waiting for next report{!compact && (instance.lastReport ? ` · last received ${ago(instance.lastReport)}; usage shown is from that report` : " · never reported")}</span></span>;
  if (instance.status === "error") return <span className="inline-flex items-start gap-1.5 text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" /><span>Reporting error · data unavailable{!compact && (instance.lastReport ? ` since ${date(instance.lastReport)}` : " · never reported")}</span></span>;
  return <span className="inline-flex items-start gap-1.5 text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /><span>{instance.status === "zero" ? "Confirmed 0" : "Reported"}{!compact && (instance.lastReport ? ` · ${ago(instance.lastReport)}` : " · timestamp unavailable")}</span></span>;
}

export function SubscriptionUsage({ subscription, persona }: { subscription: Subscription; persona: Persona }) {
  const summary = summarize(subscription, persona.instances);
  const over = summary.remaining < 0;
  const count = persona.instances.filter((i) => i.subscriptionId === subscription.id).length;
  const allZero = summary.used === 0 && summary.zero.length > 0 && !summary.incomplete.length;
  return <>
    <div className="mt-4 grid grid-cols-3 gap-3">
      <Metric label="Included quota" value={fmt(subscription.quota)} />
      <Metric label={summary.incomplete.length ? "Used (may be incomplete)" : "Used"} value={fmt(summary.used)} detail={`${Math.round(summary.pct * 100)}% of quota`} />
      <Metric label={over ? "Over quota" : "Remaining"} value={fmt(Math.abs(summary.remaining))} destructive={over} />
    </div>
    <progress aria-label={`${subscription.name} quota used`} value={Math.min(summary.used, subscription.quota)} max={subscription.quota || 1} className={`quota-progress mt-3 h-2 w-full ${over ? "quota-over" : ""}`} />
    {over && <p className="mt-2 text-xs text-destructive">Usage exceeds included quota by {fmt(-summary.remaining)} executions ({Math.round((summary.pct - 1) * 100)}%). <Button variant="link" asChild size="sm" className="h-auto whitespace-normal p-0 text-xs"><Link to="/contact">Contact n8n about next steps</Link></Button>.</p>}
    {allZero && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5" />Confirmed zero: all {summary.zero.length} instances reported 0 executions in this period.</p>}
    {!!summary.incomplete.length && <div className="mt-4 border-l-2 border-warn bg-warn-bg p-3 text-xs">
      <div className="flex items-start gap-2 font-semibold"><AlertTriangle className="size-4 shrink-0" />Total may be incomplete — {summary.incomplete.length} of {count} instances lack current data</div>
      <ul className="mt-2 space-y-1.5">{summary.incomplete.map((i) => <li key={i.id}><span className="font-mono">{i.name}</span> — <StatusText instance={i} /></li>)}</ul>
      <Button variant="link" asChild size="sm" className="mt-2 h-auto p-0 text-xs"><Link to="/instances" search={{ subscription: subscription.id, status: "incomplete" }}>Show affected instances <ArrowRight /></Link></Button>
    </div>}
  </>;
}

function Metric({ label, value, detail, destructive }: { label: string; value: string; detail?: string; destructive?: boolean }) {
  return <div className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 break-words text-base font-semibold tabular-nums sm:text-lg ${destructive ? "text-destructive" : ""}`}>{value}</div>{detail && <div className="text-xs text-muted-foreground">{detail}</div>}</div>;
}

export function EmptySubscription({ persona }: { persona: Persona }) {
  return <section className="max-w-2xl border-t border-border py-6"><h2 className="font-semibold">No subscription linked to {persona.company} yet</h2>
    <p className="mt-2 text-muted-foreground">Your account exists, but no Enterprise subscription has been linked yet. There is no quota, license or usage data to show.</p>
    <h3 className="mt-5 font-medium">What happens next</h3><ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground"><li>n8n links your signed subscription to this account.</li><li>You activate the license on your self-hosted instances.</li><li>After an instance sends its first usage report, it appears here.</li></ol>
    <Button variant="link" asChild className="mt-4 h-auto p-0"><Link to="/contact">Contact n8n <ArrowRight /></Link></Button>
  </section>;
}