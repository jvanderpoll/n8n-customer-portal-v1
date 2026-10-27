import { describe, expect, it } from "vitest";
import { personas, summarize, type Persona } from "./portal-data";
import { BUSINESS_MONTHLY_EXECUTIONS, BUSINESS_MONTHLY_PRICE_EUR, executionAmountEur, pastMonths } from "./portal-billing";

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

describe("past months", () => {
  it("splits a full year into equal monthly quotas that sum to the contract", () => {
    const sub = persona("full").subscriptions[0]!;
    const months = pastMonths(sub, persona("full").instances);
    expect(months.map((m) => m.id)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
    expect(months.every((m) => m.quota === 500_000)).toBe(true);
    expect(months.reduce((sum, m) => sum + m.quota, 0)).toBe(sub.quota);
  });
  it("keeps monthly executions equal to the subscription total, with the open month unbilled", () => {
    const full = persona("full");
    const sub = full.subscriptions[0]!;
    const months = pastMonths(sub, full.instances);
    expect(months.reduce((sum, m) => sum + m.executions, 0)).toBe(summarize(sub, full.instances).used);
    expect(months.at(-1)).toMatchObject({ id: "2026-10", standing: "in-progress", amountEur: null, delta: 0 });
    expect(months.slice(0, -1).every((m) => m.amountEur != null && m.standing !== "in-progress")).toBe(true);
  });
  it("bills a closed year from its final executions", () => {
    const full = persona("full");
    const sub = full.subscriptions[2]!;
    const months = pastMonths(sub, full.instances);
    expect(months).toHaveLength(12);
    expect(months.every((m) => m.standing !== "in-progress" && m.amountEur != null)).toBe(true);
    expect(months.reduce((sum, m) => sum + m.executions, 0)).toBe(sub.finalExecutions);
    expect(months.reduce((sum, m) => sum + m.quota, 0)).toBe(sub.quota);
  });
  it("gives the partial months of a mid-month contract a share of the quota", () => {
    const full = persona("full");
    const sub = full.subscriptions[1]!;
    const months = pastMonths(sub, full.instances);
    const march = months.find((m) => m.id === "2026-03")!;
    const april = months.find((m) => m.id === "2026-04")!;
    expect(march.quota).toBeLessThan(april.quota);
    expect(months.at(-1)?.standing).toBe("in-progress");
    expect(months.reduce((sum, m) => sum + m.executions, 0)).toBe(summarize(sub, full.instances).used);
  });
  it("shows over-quota on a subscription whose executions exceed the contract", () => {
    const over = persona("over");
    const sub = over.subscriptions[0]!;
    const months = pastMonths(sub, over.instances);
    expect(months.some((m) => m.standing === "over")).toBe(true);
  });
});
