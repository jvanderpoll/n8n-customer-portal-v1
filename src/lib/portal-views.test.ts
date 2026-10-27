import { describe, expect, it } from "vitest";
import { personas, type Persona } from "./portal-data";
import { contactFor, defaultInstanceFilter, filterInstances, licensesFor, memberFor, paginateInstances, quotaColor, quotaTextColor, runningFirst, subscriptionShare, subscriptionView } from "./portal-views";

function persona(id: string): Persona {
  const result = personas.find((p) => p.id === id);
  if (!result) throw new Error(`Missing fixture ${id}`);
  return result;
}
const hue = (color: string) => Number(color.match(/^hsl\((\d+)/)![1]);

describe("read-only portal selectors", () => {
  it("formats an instance's share of subscription used total", () => {
    expect(subscriptionShare(null, 1_000_000)).toBe("—");
    expect(subscriptionShare(250_000, 1_000_000)).toBe("25%");
    expect(subscriptionShare(0, 0)).toBe("0%");
  });
  it("filters instances by subscription and license", () => {
    const p = persona("full");
    expect(filterInstances(p, { ...defaultInstanceFilter, subscription: "s1" })).toHaveLength(52);
    expect(filterInstances(p, { ...defaultInstanceFilter, subscription: "s1", license: "LIC-NW-NPR-01" })).toHaveLength(12);
  });
  it("search matches license references without case sensitivity", () => {
    expect(filterInstances(persona("full"), { ...defaultInstanceFilter, query: "lic-nw-eu-01" })).toHaveLength(10);
  });
  it("splits reporting and non-reporting instances", () => {
    const p = persona("full");
    const changed = { ...p, instances: p.instances.map((i, n) => n === 0 ? { ...i, status: "pending" as const } : i) };
    expect(filterInstances(changed, { ...defaultInstanceFilter, status: "attention" })).toHaveLength(1);
    expect(filterInstances(changed, { ...defaultInstanceFilter, status: "reporting" })).toHaveLength(51);
  });
  it("pagination presents all fifty-two instances without duplication", () => {
    const rows = filterInstances(persona("full"), defaultInstanceFilter);
    const first = paginateInstances(rows, 1);
    const second = paginateInstances(rows, 2);
    const last = paginateInstances(rows, 99);
    expect(first.rows).toHaveLength(20);
    expect(second.rows).toHaveLength(20);
    expect(last.page).toBe(3);
    expect(last.rows).toHaveLength(12);
    expect(new Set([...first.rows, ...second.rows, ...last.rows].map((i) => i.id)).size).toBe(52);
    expect(paginateInstances([], 99)).toEqual({ rows: [], page: 1, pages: 1 });
  });
  it("licenses roll up their instances' executions and carry no quota", () => {
    const p = persona("full");
    const licenses = licensesFor(p, "s1");
    expect(licenses.map((l) => l.id)).toEqual([
      "LIC-NW-PRD-01",
      "LIC-NW-NPR-01",
      "LIC-NW-DR-01",
      "LIC-NW-EU-01",
      "LIC-NW-BATCH-01",
    ]);
    const prd = licenses[0]!;
    expect(prd.executions).toBe(prd.instances.reduce((sum, i) => sum + (i.executions ?? 0), 0));
    expect(prd).not.toHaveProperty("quota");
    expect(licenses.find((l) => l.id === "LIC-NW-DR-01")).toMatchObject({ instances: [], executions: null });
  });
  it("lists the single running Northwind subscription", () => {
    const { running, expired } = runningFirst(persona("full"));
    expect(running.map((s) => s.id)).toEqual(["s1"]);
    expect(expired).toEqual([]);
  });
  it("the account's own CSM is the contact", () => {
    expect(contactFor(persona("full"))).toEqual({ kind: "assigned", name: "Lukas Weber" });
    expect(memberFor(persona("full"))).toEqual({ id: "full-admin", name: "Sanne de Vries", role: "System admin", company: "Northwind Logistics B.V." });
  });
});

describe("quota color", () => {
  it("stays green through 70% and reaches red at 100%", () => {
    expect(quotaColor(0)).toBe(quotaColor(0.7));
    expect(hue(quotaColor(0.7))).toBeGreaterThan(100);
    expect(hue(quotaColor(1))).toBe(0);
    expect(quotaColor(1.4)).toBe(quotaColor(1));
  });
  it("shifts continuously through yellow and orange", () => {
    const hues = [0.75, 0.8, 0.85, 0.9, 0.95].map((p) => hue(quotaColor(p)));
    expect(hues).toEqual([...hues].sort((a, b) => b - a));
    expect(hues.some((h) => h >= 45 && h <= 60)).toBe(true);
    expect(hues.some((h) => h >= 20 && h < 45)).toBe(true);
  });
  it("keeps text colors on the same hue scale, darkened for readability", () => {
    expect(hue(quotaTextColor(0.8))).toBe(hue(quotaColor(0.8)));
    expect(hue(quotaTextColor(1))).toBe(0);
    const bar = quotaColor(0.8).match(/(\d+)%\)$/)?.[1];
    const text = quotaTextColor(0.8).match(/(\d+)%\)$/)?.[1];
    expect(Number(text)).toBeLessThan(Number(bar));
  });
});

describe("contact your CSM prompts", () => {
  it("asks for contact when quota is high or over", () => {
    const full = persona("full"), over = persona("over");
    expect(subscriptionView(full, full.subscriptions[0]!).quotaPrompt).toBeNull();
    expect(subscriptionView(over, over.subscriptions[0]!).quotaPrompt).toBe("over");
  });
  it("asks for contact when renewal is close, never for expired subscriptions", () => {
    const full = persona("full");
    const over = persona("over");
    expect(subscriptionView(full, full.subscriptions[0]!).renewalPrompt).toBe(false);
    expect(subscriptionView(over, over.subscriptions[0]!).renewalPrompt).toBe(false);
  });
});
