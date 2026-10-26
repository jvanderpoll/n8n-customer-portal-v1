import { type Instance, type Persona, type Subscription, periodProgress, subscriptionStatus, summarize } from "./portal-data";

export type InstanceFilter = {
  subscription: string;
  license: string;
  status: "all" | "reporting" | "attention";
  environment: "all" | Instance["env"];
  query: string;
  sort: "usage" | "name" | "report";
};

export const defaultInstanceFilter: InstanceFilter = {
  subscription: "all", license: "all", status: "all", environment: "all", query: "", sort: "usage",
};

export const isReporting = (i: Instance) => i.status === "reported" || i.status === "zero";

export function filterInstances(persona: Persona, filter: InstanceFilter) {
  const query = filter.query.trim().toLowerCase();
  return persona.instances.filter((i) => {
    const subscription = persona.subscriptions.find((s) => s.id === i.subscriptionId);
    return !i.archived && (filter.subscription === "all" || i.subscriptionId === filter.subscription)
      && (filter.license === "all" || i.license === filter.license)
      && (filter.environment === "all" || i.env === filter.environment)
      && (filter.status === "all" || (filter.status === "reporting" ? isReporting(i) : !isReporting(i)))
      && (!query || `${i.name} ${i.license} ${subscription?.name ?? ""}`.toLowerCase().includes(query));
  }).sort((a, b) => {
    if (filter.sort === "name") return a.name.localeCompare(b.name);
    if (filter.sort === "report") return (Date.parse(b.lastReport ?? "") || 0) - (Date.parse(a.lastReport ?? "") || 0) || a.name.localeCompare(b.name);
    return (b.executions ?? -1) - (a.executions ?? -1) || a.name.localeCompare(b.name);
  });
}

export function paginateInstances(rows: Instance[], requestedPage: number, pageSize = 20) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, requestedPage));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pages };
}

// Licenses carry no quota: their usage is only the sum of their instances.
export function licensesFor(persona: Persona, subscriptionId: string) {
  const instances = persona.instances.filter((i) => i.subscriptionId === subscriptionId);
  return persona.licenses.filter((l) => l.subscriptionId === subscriptionId).map((license) => {
    const rows = instances.filter((i) => i.license === license.id);
    const active = rows.filter((i) => !i.archived);
    return {
      ...license,
      instances: active,
      executions: rows.length ? rows.reduce((sum, i) => sum + (i.executions ?? 0), 0) : null,
      reportingCount: active.filter(isReporting).length,
    };
  });
}

export const QUOTA_HIGH = 0.7;
export const RENEWAL_ATTENTION_DAYS = 60;

// Green through 70%, then a continuous hue shift via yellow and orange to red at 100%.
const QUOTA_STOPS: [pct: number, hue: number, lightness: number][] = [[QUOTA_HIGH, 135, 36], [0.8, 48, 46], [0.9, 28, 48], [1, 0, 42]];
export function quotaColor(pct: number) {
  const p = Math.max(QUOTA_HIGH, Math.min(1, pct));
  const i = Math.max(1, QUOTA_STOPS.findIndex(([at]) => at >= p));
  const [a, ha, la] = QUOTA_STOPS[i - 1]!, [b, hb, lb] = QUOTA_STOPS[i]!;
  const t = (p - a) / (b - a);
  return `hsl(${Math.round(ha + (hb - ha) * t)} 78% ${Math.round(la + (lb - la) * t)}%)`;
}

export function subscriptionView(persona: Persona, sub: Subscription) {
  const status = subscriptionStatus(sub);
  const summary = summarize(sub, persona.instances);
  const period = status === "Expired" ? { pct: 1, daysLeft: 0 } : periodProgress(sub);
  const daysToRenewal = sub.renewal ? Math.ceil((Date.parse(sub.renewal) - Date.parse(persona.usageUpdated)) / 86_400_000) : null;
  return {
    status,
    summary,
    period,
    daysToRenewal,
    quotaPrompt: status === "Running" && summary.pct > QUOTA_HIGH ? (summary.pct >= 1 ? "over" as const : "high" as const) : null,
    renewalPrompt: status === "Running" && daysToRenewal !== null && daysToRenewal <= RENEWAL_ATTENTION_DAYS,
  };
}

export function runningFirst(persona: Persona) {
  const running = persona.subscriptions.filter((s) => subscriptionStatus(s) === "Running");
  const expired = persona.subscriptions.filter((s) => subscriptionStatus(s) === "Expired");
  return { running, expired };
}

export function contactFor(persona: Persona) {
  return { kind: "assigned" as const, name: persona.csm };
}

export function memberFor(persona: Persona) {
  const [name, role] = persona.user.split(" · ");
  return { id: `${persona.id}-admin`, name, role: role ?? "System admin", company: persona.company };
}
