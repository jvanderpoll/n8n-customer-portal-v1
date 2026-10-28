import { describe, it, expect } from "vitest";
import { monthsAndDaysUntil } from "./portal-format";
import {
  NORTHWIND_ANNUAL_QUOTA,
  NORTHWIND_TERM_EXECUTIONS,
  periodProgress,
  personas,
  placeholderMonthlyExecutionsNorthwind,
  subscriptionStatus,
  summarize,
} from "./portal-data";

const p = (id: string) => personas.find((x) => x.id === id)!;

describe("subscription summary", () => {
  it("over-quota customer shows negative remaining and more than 100% used", () => {
    const per = p("over");
    const s = summarize(per.subscriptions[0]!, per.instances);
    expect(s.remaining).toBeLessThan(0);
    expect(s.pct).toBeGreaterThan(1);
  });
  it("usage sums the subscription's instances only", () => {
    const per = p("full");
    expect(summarize(per.subscriptions[0]!, per.instances).used).toBe(
      per.instances.filter((i) => i.subscriptionId === "s1").reduce((sum, i) => sum + (i.executions ?? 0), 0),
    );
  });
  it("Northwind term executions and instances match the anonymized client summary", () => {
    const per = p("full");
    const sub = per.subscriptions[0]!;
    expect(sub.quota).toBe(NORTHWIND_ANNUAL_QUOTA);
    expect(summarize(sub, per.instances).used).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(Math.round((NORTHWIND_TERM_EXECUTIONS / NORTHWIND_ANNUAL_QUOTA) * 1000) / 10).toBe(3.7);
    expect(per.instances).toHaveLength(13);
    expect(per.licenses.map((l) => l.id)).toEqual(["LIC-NW-PRD-01"]);
    expect(per.instances.every((i) => i.license === "LIC-NW-PRD-01")).toBe(true);
    expect(per.instances.every((i) => i.version === undefined)).toBe(true);
    expect(placeholderMonthlyExecutionsNorthwind().reduce((a, b) => a + b, 0)).toBe(NORTHWIND_TERM_EXECUTIONS);
  });
  it("counts reporting instances", () => {
    const per = p("full");
    expect(summarize(per.subscriptions[0]!, per.instances).reportingCount).toBe(13);
  });
  it("period progress treats the end date as inclusive and uses billingAsOf for Northwind", () => {
    const sub = p("full").subscriptions[0]!;
    expect(subscriptionStatus(sub)).toBe("Running");
    expect(periodProgress(sub).daysLeft).toBe(90);
    expect(monthsAndDaysUntil(sub.renewal!, sub.billingAsOf)).toBe("2 months and 29 days");
    expect(periodProgress(sub, "2027-01-26T00:00:00Z")).toEqual({ pct: 1, daysLeft: 0 });
  });
});
