import { type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, CircleAlert, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Instance, type Persona, type Subscription, summarize } from "@/lib/portal-data";
import { ago, date, fmt, timestamp } from "@/lib/portal-format";

export function Help({ label, children }: { label: string; children: ReactNode }) {
  return <Popover><PopoverTrigger asChild><button type="button" aria-label={label} className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><Info className="size-3.5" /></button></PopoverTrigger><PopoverContent className="text-sm leading-relaxed">{children}</PopoverContent></Popover>;
}

export function PageHeading({ title }: { title: string }) {
  return <header className="mb-6"><h1 className="text-xl font-semibold">{title}</h1></header>;
}

export function Freshness({ persona }: { persona: Persona }) {
  return persona.usageUpdated ? <div className="mb-5 flex items-center gap-1 text-sm text-muted-foreground">Updated {ago(persona.usageUpdated)}<Help label="About usage updates">Last update: {timestamp(persona.usageUpdated)}. Instances report roughly every 24 hours. Usage covers each subscription’s contract period.</Help></div> : null;
}

export function Requirements({ persona }: { persona: Persona }) {
  if (!persona.requirements.length) return null;
  return <details className="mb-5 text-sm"><summary className="cursor-pointer text-muted-foreground hover:text-foreground">Reporting requirement</summary><ul className="mt-2 space-y-1 text-muted-foreground">{persona.requirements.map((r) => <li key={r}>{r}</li>)}</ul></details>;
}

export function StatusText({ instance, compact = false }: { instance: Instance; compact?: boolean }) {
  if (instance.status === "pending") return <span className="inline-flex items-start gap-1.5"><Clock3 className="mt-0.5 size-3.5 shrink-0" /><span>Pending{!compact && (instance.lastReport ? ` · last received ${ago(instance.lastReport)}; usage shown is from that report` : " · never reported")}</span></span>;
  if (instance.status === "error") return <span className="inline-flex items-start gap-1.5 text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" /><span>Reporting error{!compact && (instance.lastReport ? ` since ${date(instance.lastReport)}` : " · never reported")}</span></span>;
  return <span className="inline-flex items-start gap-1.5 text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /><span>{instance.status === "zero" ? "Confirmed 0" : "Reported"}{!compact && (instance.lastReport ? ` · ${ago(instance.lastReport)}` : " · timestamp unavailable")}</span></span>;
}

export function SubscriptionUsage({ subscription, persona }: { subscription: Subscription; persona: Persona }) {
  const summary = summarize(subscription, persona.instances);
  return <div className="mt-4 text-sm">{summary.used === null ? "Usage unavailable" : `${fmt(summary.used)} ${subscription.metric === "instances" ? "instances" : "billable executions"} used`}{summary.incomplete.length > 0 && <span className="ml-2 text-muted-foreground">Incomplete reporting</span>}</div>;
}

export function EmptySubscription({ persona }: { persona: Persona }) {
  return <section className="max-w-2xl border-t border-border py-6"><h2 className="font-semibold">No subscription linked</h2>
    <p className="mt-2 text-muted-foreground">Your account is ready. Once n8n links your agreement, its allowance and licenses will appear here. Instance usage appears after the first report.</p>
    <Button variant="link" asChild className="mt-4 h-auto p-0"><Link to="/contact">Contact n8n <ArrowRight /></Link></Button>
  </section>;
}
