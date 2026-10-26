export type ReportStatus = "reported" | "zero" | "pending" | "error";

export interface Instance {
  id: string;
  name: string;
  env: "Production" | "Non-production";
  license: string;
  subscriptionId: string;
  status: ReportStatus;
  executions: number | null; // null = no usable data
  lastReport: string | null; // ISO
  version?: string;
  archived?: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  plan: string;
  quota: number;
  start: string;
  end: string;
  renewal: string | null;
  quotaResetsAtRenewal: boolean;
  // Closed periods keep their final reported total after instances move on.
  finalExecutions?: number;
  // Contract restrictions. Leave undefined when the data has none.
  requirements?: string[];
}

export interface License {
  id: string;
  subscriptionId: string;
  environment: Instance["env"];
  status: "Active" | "Expired";
  label: string;
}

export interface Persona {
  id: string;
  label: string;
  hint: string;
  company: string;
  user: string;
  csm: string;
  usageUpdated: string;
  subscriptions: Subscription[];
  instances: Instance[];
  licenses: License[];
}

export const NOW = "2026-10-22T06:00:00Z";
export const NOW_ISO = NOW;
const DAY = 86_400_000;

export function subscriptionStatus(sub: Subscription, now = NOW): "Running" | "Expired" {
  return Date.parse(sub.end) + DAY <= Date.parse(now) ? "Expired" : "Running";
}

export interface SubscriptionSummary {
  used: number;
  remaining: number; // negative = over quota
  pct: number;
  instanceCount: number;
  reportingCount: number;
}

export function summarize(sub: Subscription, instances: Instance[]): SubscriptionSummary {
  const mine = instances.filter((i) => i.subscriptionId === sub.id);
  const used = sub.finalExecutions ?? mine.reduce((sum, i) => sum + (i.executions ?? 0), 0);
  const active = mine.filter((i) => !i.archived);
  return {
    used,
    remaining: sub.quota - used,
    pct: sub.quota > 0 ? used / sub.quota : 0,
    instanceCount: active.length,
    reportingCount: active.filter((i) => i.status === "reported" || i.status === "zero").length,
  };
}

export function periodProgress(sub: Subscription, now = NOW) {
  const start = Date.parse(sub.start), end = Date.parse(sub.end) + DAY, at = Date.parse(now);
  const pct = Math.max(0, Math.min(1, (at - start) / (end - start)));
  return { pct, daysLeft: Math.max(0, Math.ceil((end - at) / DAY)) };
}

const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3600_000).toISOString();
const teams = ["finance", "hr", "ops", "sales", "support", "data", "it", "marketing", "legal", "procurement"];

function seeded(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function genInstances(subs: { id: string; license: string; env: Instance["env"]; count: number; target: number }[]): Instance[] {
  const out: Instance[] = [];
  let k = 1;
  for (const s of subs) {
    const weights = Array.from({ length: s.count }, (_, i) => 0.2 + seeded(k + i * 7));
    const total = weights.reduce((a, b) => a + b, 0);
    weights.forEach((w, i) => {
      const team = teams[(k + i) % teams.length];
      out.push({
        id: `i${k}`,
        name: `${s.env === "Production" ? "prd" : "stg"}-${team}-${String(k).padStart(2, "0")}`,
        env: s.env,
        license: s.license,
        subscriptionId: s.id,
        status: "reported",
        executions: Math.round((s.target * w) / total / 10) * 10,
        lastReport: hoursAgo(2 + Math.floor(seeded(k) * 20)),
        version: k % 7 === 1 ? "2.12.1" : "2.13.0",
      });
      k++;
    });
  }
  return out;
}

const license = (id: string, subscriptionId: string, environment: Instance["env"], label: string, status: License["status"] = "Active"): License => ({ id, subscriptionId, environment, label, status });

export const personas: Persona[] = [
  {
    id: "full",
    label: "Enterprise account",
    hint: "Two running subscriptions, one expired. Renewal is close and quota is getting high.",
    company: "Northwind Logistics B.V.",
    user: "Sanne de Vries · System admin",
    csm: "Lukas Weber",
    usageUpdated: hoursAgo(2),
    subscriptions: [
      { id: "s1", name: "Enterprise", plan: "Self-hosted Enterprise", quota: 6_000_000, start: "2025-11-01", end: "2026-10-31", renewal: "2026-11-01", quotaResetsAtRenewal: true },
      { id: "s2", name: "EU expansion", plan: "Self-hosted Enterprise", quota: 2_000_000, start: "2026-03-15", end: "2027-03-14", renewal: "2027-03-15", quotaResetsAtRenewal: true },
      { id: "s0", name: "Enterprise 2024–25", plan: "Self-hosted Enterprise", quota: 5_000_000, start: "2024-11-01", end: "2025-10-31", renewal: null, quotaResetsAtRenewal: true, finalExecutions: 4_412_870 },
    ],
    licenses: [
      license("LIC-NW-PRD-01", "s1", "Production", "Production"),
      license("LIC-NW-NPR-01", "s1", "Non-production", "Development & staging"),
      license("LIC-NW-DR-01", "s1", "Non-production", "Disaster recovery"),
      license("LIC-NW-EU-01", "s2", "Production", "EU production"),
      license("LIC-NW-PRD-00", "s0", "Production", "Production", "Expired"),
    ],
    instances: genInstances([
      { id: "s1", license: "LIC-NW-PRD-01", env: "Production", count: 18, target: 4_172_220 },
      { id: "s1", license: "LIC-NW-NPR-01", env: "Non-production", count: 14, target: 640_120 },
      { id: "s2", license: "LIC-NW-EU-01", env: "Production", count: 8, target: 912_480 },
    ]),
  },
  {
    id: "over",
    label: "Over quota",
    hint: "Production usage exceeds the quota.",
    company: "Halvorsen Retail Group AS",
    user: "Erik Halvorsen · System admin",
    csm: "Marta Rossi",
    usageUpdated: hoursAgo(3),
    subscriptions: [
      { id: "s1", name: "Enterprise – Production", plan: "Self-hosted Enterprise", quota: 3_000_000, start: "2026-01-01", end: "2026-12-31", renewal: "2027-01-01", quotaResetsAtRenewal: true },
      { id: "s2", name: "Enterprise – Non-production", plan: "Self-hosted Enterprise", quota: 500_000, start: "2026-01-01", end: "2026-12-31", renewal: "2027-01-01", quotaResetsAtRenewal: true },
    ],
    licenses: [license("LIC-HR-PRD-01", "s1", "Production", "Production"), license("LIC-HR-NPR-01", "s2", "Non-production", "Staging")],
    instances: genInstances([
      { id: "s1", license: "LIC-HR-PRD-01", env: "Production", count: 12, target: 3_418_900 },
      { id: "s2", license: "LIC-HR-NPR-01", env: "Non-production", count: 6, target: 211_560 },
    ]),
  },
];
