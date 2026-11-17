import { describe, expect, it } from "vitest";
import {
  EU_EXPANSION_TERM_EXECUTIONS,
  NORTHWIND_ANNUAL_AMOUNT_EUR,
  NORTHWIND_ANNUAL_QUOTA,
  NORTHWIND_TERM_EXECUTIONS,
  personas,
  personasNew,
  placeholderMonthlyExecutionsEuExpansion,
  placeholderMonthlyExecutionsNorthwind,
  summarize,
  type Persona,
} from "./portal-data";
import {
  BUSINESS_MONTHLY_EXECUTIONS,
  BUSINESS_MONTHLY_PRICE_EUR,
  accountMonthlyExecutions,
  addContractMonths,
  executionAmountEur,
  monthlyChartPoints,
  pastPeriods,
  periodExecutionsLabel,
  cumulativeUsageChart,
  quotaOnChartScale,
  quotaPaceSentence,
  subscriptionInstanceMonths,
} from "./portal-billing";

function persona(id: string): Persona {
  const result = personas.find((p) => p.id === id);
  if (!result) throw new Error(`Missing fixture ${id}`);
  return result;
}

describe("enterprise amount from the published Business rate", () => {
  it("prices 40,000 executions at €667", () => {
    expect(executionAmountEur(BUSINESS_MONTHLY_EXECUTIONS)).toBe(BUSINESS_MONTHLY_PRICE_EUR);
  });
  it("bills the quota when usage is under it, and adds the excess when over", () => {
    expect(executionAmountEur(500_000)).toBe(8337.5);
    expect(executionAmountEur(500_100)).toBe(8339.17);
    expect(executionAmountEur(100)).toBe(1.67);
  });
});

describe("contract anniversary months", () => {
  it("keeps the contract day and clamps short months", () => {
    expect(new Date(addContractMonths(Date.parse("2025-01-31T00:00:00Z"), 1)).toISOString().slice(0, 10)).toBe("2025-02-28");
    expect(new Date(addContractMonths(Date.parse("2024-01-31T00:00:00Z"), 1)).toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(new Date(addContractMonths(Date.parse("2026-03-15T00:00:00Z"), 1)).toISOString().slice(0, 10)).toBe("2026-04-15");
  });
});

describe("past periods", () => {
  it("uses the Northwind placeholder monthly series for the anonymized client term", () => {
    const full = persona("full");
    const sub = full.subscriptions[0]!;
    const series = placeholderMonthlyExecutionsNorthwind();
    expect(series.reduce((a, b) => a + b, 0)).toBe(NORTHWIND_TERM_EXECUTIONS);
    const periods = pastPeriods(sub, full.instances);
    expect(periods).toHaveLength(7);
    expect(periods.map((p) => p.id)).toEqual([
      "2026-04-10", "2026-05-10", "2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10", "2026-10-10",
    ]);
    expect(periods.map((p) => p.executions)).toEqual(series);
    expect(periods.reduce((sum, p) => sum + p.executions, 0)).toBe(NORTHWIND_TERM_EXECUTIONS);
    // Equal share of the full 12-month contract; only 10 months have started.
    expect(periods.every((p) => p.quota === NORTHWIND_ANNUAL_QUOTA / 12)).toBe(true);
    expect(periods.reduce((sum, p) => sum + p.quota, 0)).toBe((NORTHWIND_ANNUAL_QUOTA / 12) * 7);
    expect(sub.annualAmountEur).toBe(NORTHWIND_ANNUAL_AMOUNT_EUR);
    expect(periods.every((p) => p.amountEur === null)).toBe(true);
    expect(periods.at(-1)).toMatchObject({
      id: "2026-10-10",
      standing: "in-progress",
      amountEur: null,
      delta: 0,
    });
    expect(periods.slice(0, -1).every((p) => p.standing === "under")).toBe(true);
  });
  it("keeps Business-rate amounts for personas without an annual amount", () => {
    const over = persona("over");
    const sub = over.subscriptions[0]!;
    const periods = pastPeriods(sub, over.instances);
    expect(periods.reduce((sum, p) => sum + p.executions, 0)).toBe(summarize(sub, over.instances).used);
    expect(periods.at(-1)).toMatchObject({ standing: "in-progress", amountEur: null, delta: 0 });
    expect(periods.slice(0, -1).every((p) => p.amountEur != null && p.standing !== "in-progress")).toBe(true);
  });
  it("shows over-quota on a subscription whose executions exceed the contract", () => {
    const over = persona("over");
    const sub = over.subscriptions[0]!;
    const periods = pastPeriods(sub, over.instances);
    expect(periods.some((p) => p.standing === "over")).toBe(true);
  });
  it("formats executions with quota in one column for the table and CSV", () => {
    const full = persona("full");
    const period = pastPeriods(full.subscriptions[0]!, full.instances)[0]!;
    expect(periodExecutionsLabel(period)).toBe(`${period.executions}/${period.quota}`);
    expect(periodExecutionsLabel({ executions: 120, quota: 200_000 })).toBe("120/200000");
  });
  it("builds overview chart ranges from the monthly rows", () => {
    const full = persona("full");
    const sub = full.subscriptions[0]!;
    const term = monthlyChartPoints(sub, full.instances, "term");
    const last3 = monthlyChartPoints(sub, full.instances, "3m");
    expect(term).toHaveLength(7);
    expect(last3).toHaveLength(3);
    expect(term.reduce((sum, p) => sum + p.executions, 0)).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(term.at(-1)?.cumulativeQuotaPct).toBeCloseTo(NORTHWIND_TERM_EXECUTIONS / NORTHWIND_ANNUAL_QUOTA);
    expect(term.at(-1)?.open).toBe(true);
    expect(term.slice(0, -1).every((point) => point.open === false)).toBe(true);
  });
  it("plots cumulative billable executions by billing month against quota", () => {
    const full = persona("full");
    const sub = full.subscriptions[0]!;
    const { points, series } = cumulativeUsageChart(sub, full.instances, full.licenses, "term", "subscription");
    expect(series).toEqual([{ id: "subscription", name: "Enterprise", executions: NORTHWIND_TERM_EXECUTIONS }]);
    expect(points).toHaveLength(7);
    expect(points.at(-1)?.cumulative).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(points.at(-1)?.quota).toBe(NORTHWIND_ANNUAL_QUOTA);
    expect(points.at(-1)?.values.subscription).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(points.map((point) => point.cumulative)).toEqual([2419, 7219, 18419, 60419, 118419, 202419, 296619]);
    expect(quotaOnChartScale(NORTHWIND_TERM_EXECUTIONS, NORTHWIND_ANNUAL_QUOTA)).toBe(false);
  });
  it("splits the same cumulative total across licenses and instances", () => {
    const full = persona("full");
    const sub = full.subscriptions[0]!;
    const byLicense = cumulativeUsageChart(sub, full.instances, full.licenses, "term", "license");
    expect(byLicense.series.map((item) => item.name)).toEqual(["Production"]);
    expect(byLicense.series.reduce((sum, item) => sum + item.executions, 0)).toBe(NORTHWIND_TERM_EXECUTIONS);
    const lastLicense = byLicense.points.at(-1)!;
    expect(Object.values(lastLicense.values).reduce((sum, value) => sum + value, 0)).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(lastLicense.cumulative).toBe(NORTHWIND_TERM_EXECUTIONS);
    const byInstance = cumulativeUsageChart(sub, full.instances, full.licenses, "3m", "instance");
    expect(byInstance.series).toHaveLength(8);
    expect(byInstance.series.at(-1)?.name).toBe("Other instances");
    const named = byInstance.series.filter((item) => item.id !== "other-instances");
    const busiest = Math.max(...named.map((item) => item.executions));
    const quietest = Math.min(...named.map((item) => item.executions));
    expect(busiest / quietest).toBeGreaterThan(20);
    expect(byInstance.points).toHaveLength(3);
    expect(byInstance.points.at(-1)?.cumulative).toBe(NORTHWIND_TERM_EXECUTIONS);
    for (const item of byInstance.series) {
      expect(byInstance.points.at(-1)?.values[item.id]).toBe(item.executions);
    }
    expect(byInstance.points[0]?.cumulative).toBe(118419);
    const over = persona("over");
    const production = over.subscriptions[0]!;
    const overChart = cumulativeUsageChart(production, over.instances, over.licenses, "term", "subscription");
    const peak = overChart.points.at(-1)?.cumulative ?? 0;
    expect(peak).toBe(summarize(production, over.instances).used);
    expect(quotaOnChartScale(peak, production.quota)).toBe(true);
  });
  it("sums calendar-month executions across running subscriptions, not in-term totals", () => {
    const full = personasNew.find((persona) => persona.id === "full")!;
    const [enterprise, eu] = full.subscriptions;
    const chart = accountMonthlyExecutions(full.subscriptions, full.instances);
    expect(chart.months.map((month) => month.id)).toEqual([
      "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
    expect(chart.windowLabel).toBe("Apr 2026 – Oct 2026");
    expect(chart.series.map((item) => item.name)).toEqual(["Total", "Enterprise", "Enterprise – EU expansion"]);
    const enterpriseLine = chart.months.map((month) => month.values[enterprise!.id]);
    const euLine = chart.months.map((month) => month.values[eu!.id]);
    expect(enterpriseLine).toEqual(placeholderMonthlyExecutionsNorthwind());
    expect(euLine).toEqual([null, null, null, ...placeholderMonthlyExecutionsEuExpansion().slice(0, 4)]);
    for (const month of chart.months) {
      const lineSum = [enterprise!.id, eu!.id].reduce((sum, id) => sum + (month.values[id] ?? 0), 0);
      expect(month.total).toBe(lineSum);
      expect(month.values.total).toBe(lineSum);
    }
    expect(chart.months.map((month) => month.total)).toEqual([2419, 4800, 11200, 60200, 100000, 180000, 234200]);
    expect(chart.totalExecutions).toBe(592_819);
    expect(chart.totalExecutions).not.toBe(NORTHWIND_TERM_EXECUTIONS + EU_EXPANSION_TERM_EXECUTIONS);
    for (const sub of full.subscriptions) {
      const rollup = subscriptionInstanceMonths(sub, full.instances);
      for (const month of rollup) {
        const instanceSum = Object.values(month.byInstance).reduce((sum, value) => sum + value, 0);
        expect(instanceSum).toBe(month.executions);
        expect(chart.months.find((row) => row.id === month.id)!.values[sub.id]).toBe(month.executions);
      }
    }
    expect(subscriptionInstanceMonths(enterprise!, full.instances).reduce((sum, month) => sum + month.executions, 0)).toBe(NORTHWIND_TERM_EXECUTIONS);
    const euMonths = subscriptionInstanceMonths(eu!, full.instances);
    expect(euMonths.reduce((sum, month) => sum + month.executions, 0)).toBe(296_200);
    expect(euMonths.reduce((sum, month) => sum + month.executions, 0)).not.toBe(summarize(eu!, full.instances).used);
    expect(summarize(eu!, full.instances).used).toBe(EU_EXPANSION_TERM_EXECUTIONS);
  });
  it("draws one line when the account has a single subscription", () => {
    const full = personas.find((persona) => persona.id === "full")!;
    const chart = accountMonthlyExecutions(full.subscriptions, full.instances);
    expect(full.subscriptions).toHaveLength(1);
    expect(chart.series).toEqual([{ id: "s1", name: "Enterprise" }]);
    expect(chart.totalExecutions).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(chart.months.every((month) => month.values.s1 === month.total)).toBe(true);
  });
  it("projects quota pace past renewal when usage is far under term elapsed", () => {
    const full = persona("full");
    const sub = full.subscriptions[0]!;
    const sentence = quotaPaceSentence(sub, NORTHWIND_TERM_EXECUTIONS, 0.548);
    expect(sentence).toContain("6.2% of quota used");
    expect(sentence).toContain("not this term");
  });
});
