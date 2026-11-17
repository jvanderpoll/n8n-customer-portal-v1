import { describe, it, expect } from "vitest";
import { monthsAndDaysUntil } from "./portal-format";
import { timestamp } from "./portal-format";
import {
  EU_EXPANSION_ANNUAL_QUOTA,
  EU_EXPANSION_TERM_EXECUTIONS,
  NORTHWIND_ANNUAL_QUOTA,
  NORTHWIND_TERM_EXECUTIONS,
  periodProgress,
  personaForSubscriptionScope,
  personas,
  personasNew,
  placeholderMonthlyExecutionsEuExpansion,
  placeholderMonthlyExecutionsNorthwind,
  subscriptionForSingleScope,
  subscriptionStatus,
  summarize,
} from "./portal-data";

const p = (id: string) => personas.find((x) => x.id === id)!;
const pNew = (id: string) => personasNew.find((x) => x.id === id)!;

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
    expect(Math.round((NORTHWIND_TERM_EXECUTIONS / NORTHWIND_ANNUAL_QUOTA) * 1000) / 10).toBe(6.2);
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
    expect(periodProgress(sub).daysLeft).toBe(165);
    expect(Math.round(periodProgress(sub).pct * 1000) / 10).toBe(54.8);
    expect(monthsAndDaysUntil(sub.renewal!, sub.billingAsOf)).toBe("5 months and 14 days");
    expect(periodProgress(sub, "2027-04-10T00:00:00Z")).toEqual({ pct: 1, daysLeft: 0 });
  });
});

describe("New prototype multi-subscription fixtures", () => {
  it("Enterprise account has different term starts with one over and one under quota", () => {
    const per = pNew("full");
    expect(per.subscriptions).toHaveLength(2);
    const [core, eu] = per.subscriptions;
    expect(core!.start).not.toBe(eu!.start);
    expect(summarize(core!, per.instances).pct).toBeLessThan(1);
    expect(summarize(eu!, per.instances).pct).toBeGreaterThan(1);
    expect(summarize(core!, per.instances).used).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(summarize(eu!, per.instances).used).toBe(EU_EXPANSION_TERM_EXECUTIONS);
    expect(eu!.quota).toBe(EU_EXPANSION_ANNUAL_QUOTA);
    expect(placeholderMonthlyExecutionsEuExpansion().reduce((a, b) => a + b, 0)).toBe(EU_EXPANSION_TERM_EXECUTIONS);
  });

  it("gives each running subscription one instance that has not reported", () => {
    const per = pNew("full");
    for (const sub of per.subscriptions) {
      const quiet = per.instances.filter((instance) => instance.subscriptionId === sub.id && instance.executions === null && instance.status === "pending");
      expect(quiet).toHaveLength(1);
      expect(Date.parse(quiet[0]!.lastReport!)).toBeLessThan(Date.parse("2026-10-21T00:00:00Z"));
    }
    expect(summarize(per.subscriptions[0]!, per.instances).used).toBe(NORTHWIND_TERM_EXECUTIONS);
    expect(summarize(per.subscriptions[1]!, per.instances).used).toBe(EU_EXPANSION_TERM_EXECUTIONS);
    expect(timestamp(per.instances.find((instance) => instance.id === "nr1")!.lastReport!)).toBe("12 Oct 2026, 09:00 UTC");
    expect(timestamp(per.instances.find((instance) => instance.id === "nr2")!.lastReport!)).toBe("4 Oct 2026, 16:30 UTC");
  });

  it("exposes issued-to on multiple license keys", () => {
    const per = pNew("full");
    expect(per.licenses.length).toBeGreaterThan(1);
    expect(per.licenses.every((l) => Boolean(l.issuedTo))).toBe(true);
  });
});

describe("Single and Multiple session views", () => {
  it("keeps both Fieldstone subscriptions in Multiple and in Old mode", () => {
    const per = pNew("full");
    expect(personaForSubscriptionScope(per, "new", "multiple")).toBe(per);
    expect(personaForSubscriptionScope(per, "old", "single")).toBe(per);
    expect(per.subscriptions.map((sub) => sub.name)).toEqual(["Enterprise", "Enterprise – EU expansion"]);
  });

  it("filters Single to the Enterprise subscription without rewriting fixtures", () => {
    const per = pNew("full");
    const before = {
      subscriptions: per.subscriptions.map((sub) => sub.id),
      instances: per.instances.map((instance) => instance.id),
      licenses: per.licenses.map((license) => license.id),
    };
    const single = personaForSubscriptionScope(per, "new", "single");
    expect(subscriptionForSingleScope(per)?.name).toBe("Enterprise");
    expect(single).not.toBe(per);
    expect(single.subscriptions.map((sub) => sub.name)).toEqual(["Enterprise"]);
    expect(single.licenses.map((license) => license.id)).toEqual(["LIC-NW-PRD-01", "LIC-NW-NPR-01"]);
    expect(single.instances.every((instance) => instance.subscriptionId === "s1")).toBe(true);
    expect(single.instances.some((instance) => instance.id === "nr1")).toBe(true);
    expect(single.instances.some((instance) => instance.id.startsWith("eu") || instance.id === "nr2")).toBe(false);
    expect(per.subscriptions.map((sub) => sub.id)).toEqual(before.subscriptions);
    expect(per.instances.map((instance) => instance.id)).toEqual(before.instances);
    expect(per.licenses.map((license) => license.id)).toEqual(before.licenses);
    expect(personaForSubscriptionScope(per, "new", "multiple").subscriptions).toHaveLength(2);
  });

  it("uses the first subscription when the account has no subscription named Enterprise", () => {
    const per = pNew("over");
    const single = personaForSubscriptionScope(per, "new", "single");
    expect(single.subscriptions.map((sub) => sub.id)).toEqual(["s1"]);
    expect(single.instances.every((instance) => instance.subscriptionId === "s1")).toBe(true);
    expect(per.subscriptions).toHaveLength(2);
  });
});
