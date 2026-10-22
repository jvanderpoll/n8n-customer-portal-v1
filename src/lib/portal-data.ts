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
}

export interface Subscription {
  id: string;
  name: string;
  quota: number;
  start: string;
  end: string;
  renewal: string;
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
}

export interface SubscriptionSummary {
  used: number;
  remaining: number; // negative = over quota
  pct: number;
  incomplete: Instance[];
  zero: Instance[];
  reportedCount: number;
}

export function summarize(sub: Subscription, instances: Instance[]): SubscriptionSummary {
  const mine = instances.filter((i) => i.subscriptionId === sub.id);
  const used = mine.reduce((s, i) => s + (i.executions ?? 0), 0);
  return {
    used,
    remaining: sub.quota - used,
    pct: sub.quota ? used / sub.quota : 0,
    incomplete: mine.filter((i) => i.status === "pending" || i.status === "error"),
    zero: mine.filter((i) => i.status === "zero"),
    reportedCount: mine.filter((i) => i.status === "reported" || i.status === "zero").length,
  };
}

const NOW = "2026-10-22T06:00:00Z";
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
  { id: "s1", name: "Enterprise – Production", quota: 6_000_000, start: "2025-11-01", end: "2026-10-31", renewal: "2026-11-01" },
  { id: "s2", name: "Enterprise – Non-production", quota: 1_200_000, start: "2025-11-01", end: "2026-10-31", renewal: "2026-11-01" },
  { id: "s3", name: "Enterprise – EU region expansion", quota: 2_000_000, start: "2026-03-15", end: "2027-03-14", renewal: "2027-03-15" },
];

export const personas: Persona[] = [
  {
    id: "full",
    label: "1 · Full validated customer",
    hint: "Mid-size enterprise, 40 instances, 3 subscriptions, all reports current.",
    company: "Northwind Logistics B.V.",
    user: "Sanne de Vries · System admin",
    csm: "Lukas Weber",
    usageUpdated: hoursAgo(2),
    requirements: [],
    subscriptions: subsFull,
    instances: genInstances([
      { id: "s1", license: "LIC-NW-PRD-01", env: "Production", count: 18, target: 4_812_340 },
      { id: "s2", license: "LIC-NW-NPR-01", env: "Non-production", count: 14, target: 640_120 },
      { id: "s3", license: "LIC-NW-EU-01", env: "Production", count: 8, target: 912_480 },
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
    requirements: ["Usage reports must be sent at least every 7 days for each licensed instance (contract §4.2)."],
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

export const openQuestions = [
  { t: "Scale UX for ~1000-instance customers", d: "Does a flat instance list hold up, or do we need grouping, search and paging from day one?" },
  { t: "Quota-threshold notifications & over-quota grace period", d: "Do we notify at e.g. 80/100%? What happens contractually after quota is exceeded?" },
  { t: "CSM fallback when none is assigned", d: "Who does 'Contact n8n' route to — shared support inbox, sales, or a named team?" },
  { t: "Can a user ever hold several accounts?", d: "v0 assumes one user = one account context, no switcher." },
  { t: "Subscription vs Purchase naming", d: "Prototype uses 'Subscription'. Does this match contract and billing language?" },
  { t: "Out of v0: OEM, air-gapped, Business, Cloud", d: "Which of these follow first, and does their data model fit this view?" },
];

export const NOW_ISO = NOW;
