import { describe, it, expect } from "vitest";
import { personas, summarize } from "./portal-data";

const p = (id: string) => personas.find((x) => x.id === id)!;

describe("subscription summary", () => {
  it("over-quota customer shows negative remaining", () => {
    const per = p("over");
    expect(summarize(per.subscriptions[0]!, per.instances).remaining).toBeLessThan(0);
  });
  it("confirmed-zero instances count as reported, not incomplete", () => {
    const per = p("zero");
    const s = summarize(per.subscriptions[0]!, per.instances);
    expect(s.used).toBe(0);
    expect(s.incomplete).toHaveLength(0);
    expect(s.zero.length).toBe(3);
  });
  it("missing-reports customer names incomplete instances", () => {
    const per = p("missing");
    const s = summarize(per.subscriptions[0]!, per.instances);
    expect(s.incomplete.map((i) => i.id).sort()).toEqual(["i2", "i4", "i6"]);
  });
  it("full customer has about 40 instances", () => {
    expect(p("full").instances).toHaveLength(40);
  });
});
