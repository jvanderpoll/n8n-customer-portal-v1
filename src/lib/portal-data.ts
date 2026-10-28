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
  /**
   * OEM-specific cap on concurrently licensed instances. Leave undefined when
   * the contract has no instance limit — Requirements hides the line rather
   * than showing an invented cap.
   */
  instanceLimit?: number;
  /**
   * Annual contract amount in EUR. When set, the summary shows it once and
   * past-period Amount cells stay — (no invented monthly invoices).
   */
  annualAmountEur?: number;
  /**
   * Explicit executions per elapsed billing month. When set, pastPeriods and
   * the overview chart use these instead of the fitted cumulative curve.
   */
  monthlyExecutions?: number[];
  /**
   * Prototype as-of for this subscription's billing story when it must differ
   * from global NOW (see Northwind term comments below).
   */
  billingAsOf?: string;
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
  /** Assigned customer success manager. Null falls back to general support in Contact n8n. */
  csm: string | null;
  /** Mailto address for the assigned CSM. Null when no CSM is assigned. */
  csmEmail: string | null;
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

export function periodProgress(sub: Subscription, now = sub.billingAsOf ?? NOW) {
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

/** Split `target` across `count` weights so the integers sum exactly. */
function splitExact(count: number, target: number, seedBase: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => 0.2 + seeded(seedBase + i * 7));
  const total = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => Math.floor((target * w) / total));
  let assigned = parts.reduce((a, b) => a + b, 0);
  let i = 0;
  while (assigned < target) {
    parts[i % count]! += 1;
    assigned += 1;
    i += 1;
  }
  return parts;
}

function genInstances(
  subs: { id: string; license: string; env: Instance["env"]; count?: number; target?: number; executions?: number[] }[],
  options: { includeVersion?: boolean } = {},
): Instance[] {
  const includeVersion = options.includeVersion ?? true;
  const out: Instance[] = [];
  let k = 1;
  for (const s of subs) {
    const parts = s.executions ?? splitExact(s.count ?? 0, s.target ?? 0, k);
    parts.forEach((executions, i) => {
      const team = teams[(k + i) % teams.length];
      out.push({
        id: `i${k}`,
        name: `${s.env === "Production" ? "prd" : "stg"}-${team}-${String(k).padStart(2, "0")}`,
        env: s.env,
        license: s.license,
        subscriptionId: s.id,
        status: "reported",
        executions,
        lastReport: hoursAgo(2 + Math.floor(seeded(k) * 20)),
        ...(includeVersion ? { version: k % 7 === 1 ? "2.12.1" : "2.13.0" } : {}),
      });
      k++;
    });
  }
  return out;
}

const license = (id: string, subscriptionId: string, environment: Instance["env"], label: string, status: License["status"] = "Active"): License => ({ id, subscriptionId, environment, label, status });

/**
 * Placeholder monthly billable executions for the running term.
 * Quiet start, then a ramp through the recent billing months. Sum = 296,619.
 *
 * Term: 10 Apr 2026 – 9 Apr 2027, renews 10 Apr 2027.
 * billingAsOf is 27 Oct 2026, so anniversary month 7 (10 Oct – 9 Nov) is open:
 * about 55% of the term elapsed and about 6% of quota used.
 */
export function placeholderMonthlyExecutionsNorthwind(): number[] {
  return [2_419, 4_800, 11_200, 42_000, 58_000, 84_000, 94_200];
}

export const NORTHWIND_TERM_EXECUTIONS = 296_619;
export const NORTHWIND_ANNUAL_QUOTA = 4_800_000;
export const NORTHWIND_ANNUAL_AMOUNT_EUR = 111_000;

export const personas: Persona[] = [
  {
    id: "full",
    label: "Enterprise account",
    hint: "One running subscription. Low quota use in month 7; renewal in April.",
    company: "Fieldstone Software B.V.",
    user: "Alexandra Bennett · System admin",
    csm: "Lukas Weber",
    csmEmail: "lukas.weber@n8n.io",
    usageUpdated: hoursAgo(2),
    subscriptions: [
      {
        id: "s1",
        name: "Enterprise",
        plan: "Self-hosted Enterprise",
        // Anonymized client-summary shape (not a real customer account).
        // Term: 10 Apr 2026 – 9 Apr 2027, renews 10 Apr 2027.
        // billingAsOf 27 Oct 2026 → month 7 of 12 is open (anniversary day 10).
        quota: NORTHWIND_ANNUAL_QUOTA,
        start: "2026-04-10",
        end: "2027-04-09",
        renewal: "2027-04-10",
        quotaResetsAtRenewal: true,
        annualAmountEur: NORTHWIND_ANNUAL_AMOUNT_EUR,
        monthlyExecutions: placeholderMonthlyExecutionsNorthwind(),
        billingAsOf: "2026-10-27T00:00:00Z",
      },
    ],
    licenses: [
      license("LIC-NW-PRD-01", "s1", "Production", "Production"),
    ],
    // 13 instances on the single license, summing to 296,619. One production
    // instance carries most of the term; the rest are much quieter.
    // No invented n8n versions.
    instances: genInstances(
      [
        { id: "s1", license: "LIC-NW-PRD-01", env: "Production", executions: [214_000, 2_100, 18_400, 1_200, 42_000, 1_400] },
        { id: "s1", license: "LIC-NW-PRD-01", env: "Non-production", executions: [1_100, 980, 900] },
        { id: "s1", license: "LIC-NW-PRD-01", env: "Production", executions: [8_200, 850] },
        { id: "s1", license: "LIC-NW-PRD-01", env: "Production", executions: [4_600, 889] },
      ],
      { includeVersion: false },
    ),
  },
  {
    id: "over",
    label: "Over quota",
    hint: "Production usage exceeds the quota.",
    company: "Driftline Technologies AS",
    user: "Erik Halvorsen · System admin",
    csm: "Marta Rossi",
    csmEmail: "marta.rossi@n8n.io",
    usageUpdated: hoursAgo(3),
    subscriptions: [
      // Self-hosted production, capped at 15 licensed instances (12 in use — demonstrates "N of M available").
      { id: "s1", name: "Enterprise – Production", plan: "Self-hosted Enterprise", quota: 3_000_000, start: "2026-01-01", end: "2026-12-31", renewal: "2027-01-01", quotaResetsAtRenewal: true, instanceLimit: 15 },
      // n8n Cloud, a second purchase on the same account — demonstrates mixed hosting and "several purchases."
      { id: "s2", name: "Enterprise – Non-production", plan: "n8n Cloud Enterprise", quota: 500_000, start: "2026-01-01", end: "2026-12-31", renewal: "2027-01-01", quotaResetsAtRenewal: true },
    ],
    licenses: [license("LIC-HR-PRD-01", "s1", "Production", "Production"), license("LIC-HR-NPR-01", "s2", "Non-production", "Staging")],
    instances: [
      ...genInstances([
        { id: "s1", license: "LIC-HR-PRD-01", env: "Production", count: 12, target: 3_418_900 },
        { id: "s2", license: "LIC-HR-NPR-01", env: "Non-production", count: 6, target: 211_560 },
      ]),
      // Confirmed zero usage (reported, executions 0) — not missing data. Compare against pending/error instances elsewhere.
      {
        id: "i19",
        name: "stg-sandbox-20",
        env: "Non-production",
        license: "LIC-HR-NPR-01",
        subscriptionId: "s2",
        status: "zero",
        executions: 0,
        lastReport: hoursAgo(5),
        version: "2.13.0",
      },
    ],
  },
];
