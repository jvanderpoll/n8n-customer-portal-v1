import { NOW, summarize, type Instance, type Subscription } from "./portal-data";
import { date } from "./portal-format";

/**
 * Published n8n Business price, billed annually: €667 per month for 40,000
 * workflow executions. Enterprise is "Contact Sales" with custom executions,
 * so this prototype prices Enterprise at the same rate per execution.
 * A closed period bills max(quota, executions) at that rate. Being under
 * quota does not reduce the amount.
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

export type PeriodStanding = "under" | "over" | "on-quota" | "in-progress";

export interface PastPeriod {
  id: string;
  label: string;
  start: string;
  end: string;
  quota: number;
  executions: number;
  standing: PeriodStanding;
  /** Executions minus quota. Zero while the period is still open. */
  delta: number;
  /** Null while the period is still open. */
  amountEur: number | null;
}

/** @deprecated Prefer PastPeriod; kept for call sites mid-rename. */
export type PastMonth = PastPeriod;
/** @deprecated Prefer PeriodStanding. */
export type MonthStanding = PeriodStanding;

/** Advance by `months`, keeping the contract day and clamping to the last day of a short month. */
export function addContractMonths(startMs: number, months: number): number {
  const base = new Date(startMs);
  const day = base.getUTCDate();
  const monthIndex = base.getUTCMonth() + months;
  const year = base.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(day, lastDay));
}

function periodDays(coveredStart: number, coveredEnd: number) {
  return Math.round((coveredEnd - coveredStart) / DAY);
}

/**
 * One row per contract-anniversary billing period that has already started.
 * Periods start on the contract start day and each next period starts one
 * month later on that same day (clamped on short months). The period ends
 * the day before the next start. Quotas share the contract quota equally
 * across a clean anniversary year; a short final period is weighted by days.
 * Executions follow the usage curve and sum to the subscription total.
 */
export function pastPeriods(sub: Subscription, instances: Instance[], now = NOW): PastPeriod[] {
  const startMs = Date.parse(sub.start);
  const periodEndExclusive = Date.parse(sub.end) + DAY;
  const nowMs = Date.parse(now);
  const spans: { id: string; label: string; start: string; end: string; coveredStart: number; coveredEnd: number; days: number }[] = [];
  let index = 0;

  while (true) {
    const coveredStart = addContractMonths(startMs, index);
    if (coveredStart >= periodEndExclusive) break;
    const nextStart = addContractMonths(startMs, index + 1);
    const coveredEnd = Math.min(nextStart, periodEndExclusive);
    if (coveredEnd <= coveredStart) break;
    const endInclusive = coveredEnd - DAY;
    const startIso = new Date(coveredStart).toISOString().slice(0, 10);
    const endIso = new Date(endInclusive).toISOString().slice(0, 10);
    spans.push({
      id: startIso,
      label: `${date(startIso)} – ${date(endIso)}`,
      start: startIso,
      end: endIso,
      coveredStart,
      coveredEnd,
      days: periodDays(coveredStart, coveredEnd),
    });
    index += 1;
    if (coveredEnd >= periodEndExclusive) break;
  }

  // A clean anniversary year keeps equal quotas even when February is shorter.
  // Weight by days only when the contract truncates the final period early.
  const last = spans.at(-1);
  const naturalLastEnd = addContractMonths(startMs, spans.length);
  const lastShort = Boolean(last && last.coveredEnd < naturalLastEnd);
  const totalDays = spans.reduce((sum, s) => sum + s.days, 0);
  let assigned = 0;
  const quotas = spans.map((span, i) => {
    if (i === spans.length - 1) return sub.quota - assigned;
    const quota = lastShort
      ? Math.round((sub.quota * span.days) / totalDays)
      : Math.round(sub.quota / spans.length);
    assigned += quota;
    return quota;
  });

  const used = summarize(sub, instances).used;
  const elapsedEnd = Math.min(nowMs, periodEndExclusive);
  const elapsed = Math.max(elapsedEnd - startMs, 1);
  const cumulative = (time: number) => Math.round(used * cumulativeExecutionShare((time - startMs) / elapsed));

  return spans
    .map((span, i) => ({ span, quota: quotas[i]! }))
    .filter(({ span }) => span.coveredStart <= nowMs)
    .map(({ span, quota }) => {
      const open = span.coveredEnd > nowMs;
      const executions = cumulative(Math.min(span.coveredEnd, elapsedEnd)) - cumulative(span.coveredStart);
      const delta = open ? 0 : executions - quota;
      const standing: PeriodStanding = open ? "in-progress" : delta > 0 ? "over" : delta < 0 ? "under" : "on-quota";
      return {
        id: span.id,
        label: span.label,
        start: span.start,
        end: span.end,
        quota,
        executions,
        standing,
        delta,
        amountEur: open ? null : executionAmountEur(Math.max(quota, executions)),
      };
    });
}

/** @deprecated Prefer pastPeriods. */
export const pastMonths = pastPeriods;
