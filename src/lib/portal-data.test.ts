import { describe, it, expect } from "vitest";
import { periodProgress, personas, subscriptionStatus, summarize } from "./portal-data";

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
    expect(summarize(per.subscriptions[0]!, per.instances).used).toBe(per.instances.filter((i) => i.subscriptionId === "s1").reduce((sum, i) => sum + (i.executions ?? 0), 0));
  });
  it("counts reporting instances", () => {
    const per = p("full");
    expect(summarize(per.subscriptions[1]!, per.instances).reportingCount).toBe(8);
  });
  it("expired subscriptions keep their final reported total", () => {
    const per = p("full");
    const expired = per.subscriptions.find((s) => s.id === "s0")!;
    expect(subscriptionStatus(expired)).toBe("Expired");
    expect(summarize(expired, per.instances)).toMatchObject({ used: 4_412_870, reportingCount: 0 });
  });
  it("period progress treats the end date as inclusive", () => {
    const sub = p("full").subscriptions[0]!;
    expect(subscriptionStatus(sub)).toBe("Running");
    expect(periodProgress(sub).daysLeft).toBe(10);
    expect(periodProgress(sub, "2026-11-01T00:00:00Z")).toEqual({ pct: 1, daysLeft: 0 });
  });
  it("full customer has 40 instances", () => {
    expect(p("full").instances).toHaveLength(40);
  });
});
