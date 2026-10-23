import { type Instance, type Persona, summarize } from "./portal-data";

export type InstanceFilter = {
  subscription: string;
  license: string;
  status: "all" | "incomplete" | "reported" | "zero" | "pending" | "error";
  environment: "all" | Instance["env"];
  query: string;
  sort: "usage" | "name" | "report";
};

export const defaultInstanceFilter: InstanceFilter = {
  subscription: "all", license: "all", status: "all", environment: "all", query: "", sort: "usage",
};

export function filterInstances(persona: Persona, filter: InstanceFilter) {
  const query = filter.query.trim().toLowerCase();
  return persona.instances.filter((i) => {
    const subscription = persona.subscriptions.find((s) => s.id === i.subscriptionId);
    return (filter.subscription === "all" || i.subscriptionId === filter.subscription)
      && (filter.license === "all" || i.license === filter.license)
      && (filter.environment === "all" || i.env === filter.environment)
      && (filter.status === "all" || (filter.status === "incomplete"
        ? i.status === "pending" || i.status === "error" : i.status === filter.status))
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

export function licensesFor(persona: Persona, subscriptionId: string) {
  const subscription = persona.subscriptions.find((s) => s.id === subscriptionId);
  if (!subscription) return [];
  const instances = persona.instances.filter((i) => i.subscriptionId === subscriptionId);
  return persona.licenses.filter((l) => l.subscriptionId === subscriptionId).map((license) => {
    const rows = instances.filter((i) => i.license === license.id);
    return { ...license, instances: rows, summary: summarize(subscription, rows) };
  });
}

export function contactFor(persona: Persona) {
  return persona.csm ? { kind: "assigned" as const, name: persona.csm } : { kind: "unassigned" as const, name: null };
}

export function memberFor(persona: Persona) {
  const [name, role] = persona.user.split(" · ");
  return { id: `${persona.id}-admin`, name, role: role ?? "System admin", company: persona.company };
}