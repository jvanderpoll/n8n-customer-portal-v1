import { describe, expect, it } from "vitest";
import { personas, summarize, type Persona } from "./portal-data";
import {
  BUSINESS_MONTHLY_EXECUTIONS,
  BUSINESS_MONTHLY_PRICE_EUR,
  addContractMonths,
  executionAmountEur,
  pastPeriods,
  periodExecutionsLabel,
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
  it("splits a clean anniversary year into equal period quotas that sum to the contract", () => {
    const sub = persona("full").subscriptions[0]!;
    const periods = pastPeriods(sub, persona("full").instances);
    expect(periods.map((p) => p.id)).toEqual([
      "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01",
      "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01",
    ]);
    expect(periods[0]).toMatchObject({ start: "2025-11-01", end: "2025-11-30", label: "1 Nov 2025 – 30 Nov 2025" });
    expect(periods.every((p) => p.quota === 500_000)).toBe(true);
    expect(periods.reduce((sum, p) => sum + p.quota, 0)).toBe(sub.quota);
  });
  it("keeps period executions equal to the subscription total, with the open period unbilled", () => {
    const full = persona("full");
    const sub = full.subscriptions[0]!;
    const periods = pastPeriods(sub, full.instances);
    expect(periods.reduce((sum, p) => sum + p.executions, 0)).toBe(summarize(sub, full.instances).used);
    expect(periods.at(-1)).toMatchObject({
      id: "2026-10-01",
      start: "2026-10-01",
      end: "2026-10-31",
      standing: "in-progress",
      amountEur: null,
      delta: 0,
    });
    expect(periods.slice(0, -1).every((p) => p.amountEur != null && p.standing !== "in-progress")).toBe(true);
  });
  it("bills a closed year from its final executions", () => {
    const full = persona("full");
    const sub = full.subscriptions[2]!;
    const periods = pastPeriods(sub, full.instances);
    expect(periods).toHaveLength(12);
    expect(periods.every((p) => p.standing !== "in-progress" && p.amountEur != null)).toBe(true);
    expect(periods.reduce((sum, p) => sum + p.executions, 0)).toBe(sub.finalExecutions);
    expect(periods.reduce((sum, p) => sum + p.quota, 0)).toBe(sub.quota);
  });
  it("starts mid-month contracts on the anniversary day, not the 1st", () => {
    const full = persona("full");
    const sub = full.subscriptions[1]!;
    const periods = pastPeriods(sub, full.instances);
    expect(periods[0]).toMatchObject({
      id: "2026-03-15",
      start: "2026-03-15",
      end: "2026-04-14",
      label: "15 Mar 2026 – 14 Apr 2026",
      quota: 166_667,
    });
    expect(periods[1]).toMatchObject({
      start: "2026-04-15",
      end: "2026-05-14",
      label: "15 Apr 2026 – 14 May 2026",
      quota: 166_667,
    });
    expect(periods.every((p) => p.quota === 166_667)).toBe(true);
    expect(periods.at(-1)?.standing).toBe("in-progress");
    expect(periods.at(-1)?.start).toBe("2026-10-15");
    expect(periods.reduce((sum, p) => sum + p.executions, 0)).toBe(summarize(sub, full.instances).used);
  });
  it("gives equal period quotas on a clean mid-month anniversary year once complete", () => {
    const full = persona("full");
    const sub = full.subscriptions[1]!;
    const periods = pastPeriods(sub, full.instances, "2027-03-14T12:00:00Z");
    expect(periods).toHaveLength(12);
    expect(periods[0]?.label).toBe("15 Mar 2026 – 14 Apr 2026");
    expect(periods.at(-1)).toMatchObject({ start: "2027-02-15", end: "2027-03-14", quota: 166_663 });
    expect(periods.slice(0, -1).every((p) => p.quota === 166_667)).toBe(true);
    expect(periods.reduce((sum, p) => sum + p.quota, 0)).toBe(sub.quota);
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
    expect(periodExecutionsLabel({ executions: 381_299, quota: 500_000 })).toBe("381299/500000");
  });
});
