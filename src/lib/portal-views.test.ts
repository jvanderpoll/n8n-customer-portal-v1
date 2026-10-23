import { describe, expect, it } from "vitest";
import { personas, type Persona, summarize } from "./portal-data";
import { contactFor, defaultInstanceFilter, filterInstances, licensesFor, memberFor, paginateInstances } from "./portal-views";

function persona(id: string): Persona {
  const result = personas.find((p) => p.id === id);
  if (!result) throw new Error(`Missing fixture ${id}`);
  return result;
}

describe("read-only portal selectors", () => {
  it("quota usage includes only instances linked to that subscription", () => {
    const p = persona("full");
    const subscription = p.subscriptions.find((s) => s.id === "s1");
    if (!subscription) throw new Error("Missing subscription");
    expect(summarize(subscription, p.instances).used).toBe(p.instances.filter((i) => i.subscriptionId === "s1").reduce((sum, i) => sum + (i.executions ?? 0), 0));
    expect(filterInstances(p, { ...defaultInstanceFilter, subscription: "s1" })).toHaveLength(32);
  });
  it("confirmed zeros are not missing reports", () => {
    const p = persona("zero");
    expect(filterInstances(p, { ...defaultInstanceFilter, status: "incomplete" })).toHaveLength(0);
    expect(filterInstances(p, { ...defaultInstanceFilter, status: "zero" }).map((i) => i.executions)).toEqual([0, 0, 0]);
  });
  it("pending and error reports both contribute to incomplete coverage", () => {
    expect(filterInstances(persona("missing"), { ...defaultInstanceFilter, status: "incomplete" }).map((i) => i.id).sort()).toEqual(["i19", "i2", "i4", "i6"]);
  });
  it("missing usage stays null and sorts after confirmed zero", () => {
    const p = persona("missing");
    const rows = filterInstances({ ...p, instances: [{ ...p.instances[0], id: "zero", executions: 0, status: "zero" }, { ...p.instances[0], id: "missing", executions: null, status: "error" }] } as Persona, defaultInstanceFilter);
    expect(rows.map((i) => [i.id, i.executions])).toEqual([["zero", 0], ["missing", null]]);
  });
  it("license drill-down stays within its subscription", () => {
    const p = persona("full");
    const licenses = licensesFor(p, "s1");
    expect(licenses.map((l) => l.id)).toEqual(["LIC-NW-PRD-01", "LIC-NW-NPR-01", "LIC-NW-DR-01"]);
    expect(filterInstances(p, { ...defaultInstanceFilter, subscription: "s1", license: "LIC-NW-NPR-01" })).toHaveLength(14);
  });
  it("search matches license references without case sensitivity", () => {
    expect(filterInstances(persona("full"), { ...defaultInstanceFilter, query: "lic-nw-eu-01" })).toHaveLength(8);
  });
  it("pagination presents all forty instances without duplication", () => {
    const rows = filterInstances(persona("full"), defaultInstanceFilter);
    const first = paginateInstances(rows, 1);
    const last = paginateInstances(rows, 99);
    expect(first.rows).toHaveLength(20);
    expect(last.page).toBe(2);
    expect(new Set([...first.rows, ...last.rows].map((i) => i.id)).size).toBe(40);
    expect(paginateInstances([], 99)).toEqual({ rows: [], page: 1, pages: 1 });
  });
  it("one account context exposes only its own system admin", () => {
    expect(memberFor(persona("full"))).toEqual({ id: "full-admin", name: "Sanne de Vries", role: "System admin", company: "Northwind Logistics B.V." });
    expect(memberFor(persona("empty")).company).toBe("Okafor Health Systems Ltd");
  });
  it("assigned customer success manager is retained without inventing a fallback", () => {
    expect(contactFor(persona("full"))).toEqual({ kind: "assigned", name: "Lukas Weber" });
    expect(contactFor(persona("missing"))).toEqual({ kind: "unassigned", name: null });
    expect(contactFor(persona("empty"))).toEqual({ kind: "unassigned", name: null });
  });
});

describe("commercial reporting states", () => {
  it("does not turn unavailable usage into zero or a full remaining allowance", () => {
    const p = persona("unknown");
    expect(summarize(p.subscriptions[0]!, p.instances)).toMatchObject({ used: null, remaining: null, pct: null });
  });
  it("retains confirmed zero with the full allowance remaining", () => {
    const p = persona("zero");
    expect(summarize(p.subscriptions[0]!, p.instances)).toMatchObject({ used: 0, remaining: p.subscriptions[0]!.quota, pct: 0 });
  });
  it("represents unlimited allowance without an artificial percentage or remaining value", () => {
    const p = persona("unlimited");
    expect(summarize(p.subscriptions[0]!, p.instances)).toMatchObject({ unlimited: true, remaining: null, pct: null });
  });
  it("counts OEM instances rather than their execution totals", () => {
    const p = persona("oem");
    expect(summarize(p.subscriptions[0]!, p.instances)).toMatchObject({ used: 32, remaining: 18, pct: 0.64 });
  });
  it("retains purchased licenses with no activations", () => {
    expect(licensesFor(persona("full"), "s1").find((l) => l.id === "LIC-NW-DR-01")?.instances).toEqual([]);
  });
});
