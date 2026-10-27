import { NOW, summarize, type Instance, type Subscription } from "./portal-data";

/**
 * Published n8n Business price, billed annually: €667 per month for 40,000
 * workflow executions. Enterprise is "Contact Sales" with custom executions,
 * so this prototype prices Enterprise at the same rate per execution.
 * A closed month bills its quota. Executions over that quota are added at
 * the same rate. Being under quota does not reduce the amount.
 */
export const BUSINESS_MONTHLY_PRICE_EUR = 667;
export const BUSINESS_MONTHLY_EXECUTIONS = 40_000;

const DAY = 86_400_000;

/** Cumulative share of a period's executions at progress p (0–1). Same curve as the usage chart. */
export function cumulativeExecutionShare(p: number) {
  const x = Math.min(1, Math.max(0, p));
  return 0.68 * x ** 1.5 + 0.32 * x;
}

export function executionAmountEur(executions: number) {
  return Math.round((executions * BUSINESS_MONTHLY_PRICE_EUR * 100) / BUSINESS_MONTHLY_EXECUTIONS) / 100;
}

export type MonthStanding = "under" | "over" | "on-quota" | "in-progress";

export interface PastMonth {
  id: string;
  label: string;
  start: string;
  quota: number;
  executions: number;
  standing: MonthStanding;
  /** Executions minus quota. Zero while the month is still open. */
  delta: number;
  /** Null while the month is still open. */
  amountEur: number | null;
}

function monthWeight(year: number, month: number, coveredStart: number, coveredEnd: number) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const coveredDays = Math.round((coveredEnd - coveredStart) / DAY);
  return coveredDays / daysInMonth;
}

/**
 * One row per calendar month of the contract that has already started.
 * Monthly quotas share the contract quota in proportion to the days of
 * each month that fall inside the contract, and sum to the contract quota.
 * Monthly executions follow the usage curve and sum to the executions
 * already shown for the subscription.
 */
export function pastMonths(sub: Subscription, instances: Instance[], now = NOW): PastMonth[] {
  const startMs = Date.parse(sub.start);
  const periodEndExclusive = Date.parse(sub.end) + DAY;
  const nowMs = Date.parse(now);
  const spans: { id: string; label: string; start: string; coveredStart: number; coveredEnd: number; weight: number }[] = [];
  let year = new Date(startMs).getUTCFullYear();
  let month = new Date(startMs).getUTCMonth();
  const end = new Date(periodEndExclusive - DAY);
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthStart = Date.UTC(year, month, 1);
    const nextMonth = Date.UTC(year, month + 1, 1);
    const coveredStart = Math.max(monthStart, startMs);
    const coveredEnd = Math.min(nextMonth, periodEndExclusive);
    spans.push({
      id: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: new Date(monthStart).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
      start: new Date(coveredStart).toISOString().slice(0, 10),
      coveredStart,
      coveredEnd,
      weight: monthWeight(year, month, coveredStart, coveredEnd),
    });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }

  const totalWeight = spans.reduce((sum, span) => sum + span.weight, 0);
  let assigned = 0;
  const quotas = spans.map((span, index) => {
    if (index === spans.length - 1) return sub.quota - assigned;
    const quota = Math.round((sub.quota * span.weight) / totalWeight);
    assigned += quota;
    return quota;
  });

  const used = summarize(sub, instances).used;
  const elapsedEnd = Math.min(nowMs, periodEndExclusive);
  const elapsed = Math.max(elapsedEnd - startMs, 1);
  const cumulative = (time: number) => Math.round(used * cumulativeExecutionShare((time - startMs) / elapsed));

  return spans
    .map((span, index) => ({ span, quota: quotas[index]! }))
    .filter(({ span }) => span.coveredStart <= nowMs)
    .map(({ span, quota }) => {
      const open = span.coveredEnd > nowMs;
      const executions = cumulative(Math.min(span.coveredEnd, elapsedEnd)) - cumulative(span.coveredStart);
      const delta = open ? 0 : executions - quota;
      const standing: MonthStanding = open ? "in-progress" : delta > 0 ? "over" : delta < 0 ? "under" : "on-quota";
      return {
        id: span.id,
        label: span.label,
        start: span.start,
        quota,
        executions,
        standing,
        delta,
        amountEur: open ? null : executionAmountEur(Math.max(quota, executions)),
      };
    });
}
