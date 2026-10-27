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
  quota: number | null;
  metric?: "executions" | "instances";
  plan?: string;
  status?: "Active" | "Upcoming" | "Expired";
  start: string;
  end: string;
  renewal: string;
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
  csm: string | null;
  usageUpdated: string | null;
  requirements: string[];
  subscriptions: Subscription[];
  instances: Instance[];
  licenses: License[];
}

export interface SubscriptionSummary {
  used: number | null;
  remaining: number | null; // negative = over quota; null = unknown or unlimited
  pct: number | null;
  unlimited: boolean;
  incomplete: Instance[];
  zero: Instance[];
  reportedCount: number;
}

export function summarize(sub: Subscription, instances: Instance[]): SubscriptionSummary {
  const mine = instances.filter((i) => i.subscriptionId === sub.id);
  const known = mine.filter((i) => i.executions !== null);
  const used = sub.metric === "instances" ? mine.filter(i => !i.archived).length : mine.length && !known.length ? null : known.reduce((sum, i) => sum + (i.executions ?? 0), 0);
  const unlimited = sub.quota !== null && sub.quota <= 0;
  const remaining = used === null || sub.quota === null || unlimited ? null : sub.quota - used;
  return {
    used,
    remaining,
    pct: used === null || sub.quota === null || unlimited ? null : used / sub.quota,
    unlimited,
    incomplete: mine.filter((i) => !i.archived && (i.status === "pending" || i.status === "error")),
    zero: mine.filter((i) => i.status === "zero"),
    reportedCount: mine.filter((i) => i.status === "reported" || i.status === "zero").length,
  };
}

export const NOW = "2026-10-22T06:00:00Z";
const hoursAgo = (h: number) => new Date(Date.parse(NOW) - h * 3600_000).toISOString();

const teams = ["finance", "hr", "ops", "sales", "support", "data", "it", "marketing", "legal", "procurement"];

function seeded(n: number) {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function genInstances(
  subs: { id: string; license: string; env: Instance["env"]; count: number; target: number }[],
  overrides: Record<string, Partial<Instance>> = {},
): Instance[] {
  const out: Instance[] = [];
  let k = 1;
  for (const s of subs) {
    const weights = Array.from({ length: s.count }, (_, i) => 0.2 + seeded(k + i * 7));
    const total = weights.reduce((a, b) => a + b, 0);
    weights.forEach((w, i) => {
      const team = teams[(k + i) % teams.length];
      const name = `${s.env === "Production" ? "prd" : "stg"}-${team}-${String(k).padStart(2, "0")}`;
      const base: Instance = {
        id: `i${k}`,
        name,
        env: s.env,
        license: s.license,
        subscriptionId: s.id,
        status: "reported",
        executions: Math.round((s.target * w) / total / 10) * 10,
        lastReport: hoursAgo(2 + Math.floor(seeded(k) * 20)),
      };
      out.push({ ...base, ...overrides[base.id] });
      k++;
    });
  }
  return out;
}

const subsFull: Subscription[] = [
  { id: "s1", name: "Enterprise", plan: "Self-hosted Enterprise", quota: 6_000_000, start: "2025-11-01", end: "2026-10-31", renewal: "2026-11-01" },
  { id: "s2", name: "EU expansion", plan: "Self-hosted Enterprise", quota: 2_000_000, start: "2026-03-15", end: "2027-03-14", renewal: "2027-03-15" },
];

const fixtures: Omit<Persona, "licenses">[] = [
  {
    id: "full",
    label: "Enterprise account",
    hint: "Mid-size enterprise, 40 instances, 2 subscriptions, all reports current.",
    company: "Northwind Logistics B.V.",
    user: "Sanne de Vries · System admin",
    csm: "Lukas Weber",
    usageUpdated: hoursAgo(2),
    requirements: [],
    subscriptions: subsFull,
    instances: genInstances([
      { id: "s1", license: "LIC-NW-PRD-01", env: "Production", count: 18, target: 4_172_220 },
      { id: "s1", license: "LIC-NW-NPR-01", env: "Non-production", count: 14, target: 640_120 },
      { id: "s2", license: "LIC-NW-EU-01", env: "Production", count: 8, target: 912_480 },
    ]),
  },
  {
    id: "over",
    label: "2 · Over-quota customer",
    hint: "Production usage exceeds the included quota.",
    company: "Halvorsen Retail Group AS",
    user: "Erik Halvorsen · System admin",
    csm: "Marta Rossi",
    usageUpdated: hoursAgo(3),
    requirements: [],
    subscriptions: [
      { id: "s1", name: "Enterprise – Production", quota: 3_000_000, start: "2026-01-01", end: "2026-12-31", renewal: "2027-01-01" },
      { id: "s2", name: "Enterprise – Non-production", quota: 500_000, start: "2026-01-01", end: "2026-12-31", renewal: "2027-01-01" },
    ],
    instances: genInstances([
      { id: "s1", license: "LIC-HR-PRD-01", env: "Production", count: 12, target: 3_418_900 },
      { id: "s2", license: "LIC-HR-NPR-01", env: "Non-production", count: 6, target: 211_560 },
    ]),
  },
  {
    id: "missing",
    label: "3 · Missing / outdated reports",
    hint: "Some instances are waiting for a report, one has a reporting error.",
    company: "Castellan Insurance plc",
    user: "Priya Nair · System admin",
    csm: null,
    usageUpdated: hoursAgo(5),
    requirements: [],
    subscriptions: subsFull.slice(0, 2).map((s) => ({ ...s, start: "2026-02-01", end: "2027-01-31", renewal: "2027-02-01" })),
    instances: genInstances(
      [
        { id: "s1", license: "LIC-CI-PRD-01", env: "Production", count: 16, target: 3_104_220 },
        { id: "s2", license: "LIC-CI-NPR-01", env: "Non-production", count: 10, target: 402_880 },
      ],
      {
        "i2": { status: "pending", executions: 182_340, lastReport: hoursAgo(52) },
        "i4": { status: "pending", executions: 96_110, lastReport: hoursAgo(75) },
        "i6": { status: "error", executions: null, lastReport: null },
        "i19": { status: "error", executions: null, lastReport: hoursAgo(310) },
      },
    ),
  },
  {
    id: "zero",
    label: "4 · Confirmed zero usage",
    hint: "License active, instances reporting, but zero executions so far.",
    company: "Brightwater Utilities GmbH",
    user: "Jonas Keller · System admin",
    csm: "Lukas Weber",
    usageUpdated: hoursAgo(1),
    requirements: [],
    subscriptions: [
      { id: "s1", name: "Enterprise – Production", quota: 1_500_000, start: "2026-09-15", end: "2027-09-14", renewal: "2027-09-15" },
    ],
    instances: genInstances([{ id: "s1", license: "LIC-BW-PRD-01", env: "Production", count: 3, target: 0 }]).map((i) => ({
      ...i,
      status: "zero" as const,
      executions: 0,
    })),
  },
  {
    id: "empty",
    label: "5 · New user, empty account",
    hint: "Account just created; no subscription linked yet.",
    company: "Okafor Health Systems Ltd",
    user: "Adaeze Okafor · System admin",
    csm: null,
    usageUpdated: null,
    requirements: [],
    subscriptions: [],
    instances: [],
  },
];

export const NOW_ISO = NOW;

const license = (id: string, subscriptionId: string, environment: Instance["env"], label: string): License => ({ id, subscriptionId, environment, label, status: "Active" });
const fixtureLicenses: Record<string, License[]> = {
  full: [license("LIC-NW-PRD-01", "s1", "Production", "Production"), license("LIC-NW-NPR-01", "s1", "Non-production", "Development & staging"), license("LIC-NW-DR-01", "s1", "Non-production", "Disaster recovery"), license("LIC-NW-EU-01", "s2", "Production", "EU production")],
  over: [license("LIC-HR-PRD-01", "s1", "Production", "Production"), license("LIC-HR-NPR-01", "s2", "Non-production", "Staging")],
  missing: [license("LIC-CI-PRD-01", "s1", "Production", "Production"), license("LIC-CI-NPR-01", "s2", "Non-production", "Staging")],
  zero: [license("LIC-BW-PRD-01", "s1", "Production", "Production")],
  empty: [],
};
export const personas: Persona[] = fixtures.map((p) => ({ ...p, licenses: fixtureLicenses[p.id] ?? [], instances: p.instances.map((i, n) => ({ ...i, version: n % 7 === 0 ? "2.12.1" : "2.13.0" })) }));
const full = personas[0]!;
personas.push({ ...full, id: "oem", label: "OEM · instance allowance", company: "Meridian Software", user: "Alex Morgan · System admin", subscriptions: [{ id: "s1", name: "OEM agreement", plan: "OEM", metric: "instances", quota: 50, start: "2026-01-01", end: "2026-12-31", renewal: "2027-01-01" }], licenses: [license("LIC-MS-OEM-01", "s1", "Production", "Customer deployments")], instances: genInstances([{ id: "s1", license: "LIC-MS-OEM-01", env: "Production", count: 32, target: 200000 }]).map((i) => ({ ...i, version: "2.13.0" })) });
personas.push({ ...full, id: "unknown", label: "Usage unavailable", instances: full.instances.map((i) => ({ ...i, executions: null, status: "error", lastReport: null })) });
personas.push({ ...full, id: "unlimited", label: "Unlimited allowance", subscriptions: full.subscriptions.map((s) => ({ ...s, quota: -1 })) });
