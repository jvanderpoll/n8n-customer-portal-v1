import { describe, expect, it } from "vitest";
import { personas, summarize } from "./portal-data";
import {
  activeInstances,
  applyManagement,
  createAccount,
  type ManagementAction,
} from "./portal-management";
const account = (id = "full") =>
  createAccount(personas.find((p) => p.id === id)!);
describe("session-only account management", () => {
  it("creates an unreported instance on its license, without inventing executions", () => {
    const before = account();
    const next = applyManagement(
      before,
      {
        type: "create-instance",
        id: "new",
        name: "New instance",
        license: "LIC-NW-DR-01",
      },
      "Write",
    );
    expect(next.persona.instances[0]).toMatchObject({
      id: "new",
      status: "pending",
      executions: null,
      env: "Non-production",
      subscriptionId: "s1",
    });
    expect(before.persona.instances).toHaveLength(40);
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances).used,
    ).toBe(
      summarize(before.persona.subscriptions[0]!, before.persona.instances)
        .used,
    );
  });
  it("rejects duplicate names and unknown licenses", () => {
    const s = account(),
      name = s.persona.instances[0]!.name;
    expect(() =>
      applyManagement(
        s,
        {
          type: "create-instance",
          id: "new",
          name: name.toUpperCase(),
          license: "LIC-NW-DR-01",
        },
        "Write",
      ),
    ).toThrow("already exists");
    expect(() =>
      applyManagement(
        s,
        {
          type: "create-instance",
          id: "new",
          name: "test",
          license: "missing",
        },
        "Write",
      ),
    ).toThrow("not found");
  });
  it("moves an instance within a subscription without changing subscription usage", () => {
    const s = account(),
      i = s.persona.instances[0]!;
    const next = applyManagement(
      s,
      {
        type: "edit-instance",
        id: i.id,
        name: i.name,
        license: "LIC-NW-DR-01",
      },
      "Write",
    );
    expect(next.persona.instances.find((row) => row.id === i.id)?.license).toBe(
      "LIC-NW-DR-01",
    );
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances).used,
    ).toBe(summarize(s.persona.subscriptions[0]!, s.persona.instances).used);
    expect(() =>
      applyManagement(
        s,
        {
          type: "edit-instance",
          id: i.id,
          name: i.name,
          license: "LIC-NW-EU-01",
        },
        "Write",
      ),
    ).toThrow("same subscription");
  });
  it("removes inventory entries while retaining billable history and allows restoration", () => {
    const s = account(),
      id = s.persona.instances[0]!.id;
    const next = applyManagement(s, { type: "remove-instance", id }, "Write");
    expect(activeInstances(next.persona)).toHaveLength(39);
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances).used,
    ).toBe(summarize(s.persona.subscriptions[0]!, s.persona.instances).used);
    expect(
      activeInstances(
        applyManagement(next, { type: "restore-instance", id }, "Write")
          .persona,
      ),
    ).toHaveLength(40);
  });
  it("moves and removes only unused licenses, protecting history", () => {
    const s = account();
    const moved = applyManagement(
      s,
      {
        type: "edit-license",
        id: "LIC-NW-DR-01",
        label: "EU recovery",
        subscriptionId: "s2",
      },
      "Write",
    );
    expect(
      moved.persona.licenses.find((l) => l.id === "LIC-NW-DR-01")
        ?.subscriptionId,
    ).toBe("s2");
    expect(
      applyManagement(
        moved,
        { type: "delete-license", id: "LIC-NW-DR-01" },
        "Write",
      ).persona.licenses,
    ).toHaveLength(4);
    expect(() =>
      applyManagement(
        s,
        { type: "delete-license", id: "LIC-NW-PRD-01" },
        "Write",
      ),
    ).toThrow("history");
    expect(() =>
      applyManagement(
        s,
        {
          type: "edit-license",
          id: "LIC-NW-PRD-01",
          label: "Production",
          subscriptionId: "s2",
        },
        "Write",
      ),
    ).toThrow("without activations");
  });
  it("keeps license requests separate from licenses and quota", () => {
    const s = account();
    const next = applyManagement(
      s,
      { type: "order", id: "req", subscriptionId: "s1", quantity: 3, environment: "Production", note: "" },
      "Write",
    );
    expect(next.orders[0]).toMatchObject({ quantity: 3, status: "Pending" });
    expect(next.persona.licenses).toEqual(s.persona.licenses);
    expect(next.persona.subscriptions).toEqual(s.persona.subscriptions);
    expect(applyManagement(next, { type: "cancel-order", id: "req" }, "Write").orders[0]?.status).toBe("Cancelled");
    expect(() =>
      applyManagement(s, { type: "order", id: "old", subscriptionId: "s0", quantity: 1, environment: "Production", note: "" }, "Write"),
    ).toThrow("running subscription");
  });
  it("read access cannot change anything", () => {
    const actions: ManagementAction[] = [
      { type: "remove-instance", id: account().persona.instances[0]!.id },
      { type: "order", id: "req", subscriptionId: "s1", quantity: 1, environment: "Production", note: "" },
      { type: "invite", id: "x", name: "X", email: "x@example.com", role: "Read", scope: "all" },
      { type: "remove-member", id: "billing" },
    ];
    for (const action of actions)
      expect(() => applyManagement(account(), action, "Read")).toThrow("does not allow");
  });
  it("invites people with a role and scope, rejects duplicates, and cancels invites", () => {
    const s = account();
    const next = applyManagement(
      s,
      { type: "invite", id: "invite", name: "Noor", email: " NEW@example.com ", role: "Write", scope: ["s2"] },
      "Write",
    );
    expect(next.members.find((m) => m.id === "invite")).toMatchObject({
      name: "Noor",
      email: "new@example.com",
      status: "Invited",
      role: "Write",
      scope: ["s2"],
    });
    expect(() =>
      applyManagement(next, { type: "invite", id: "duplicate", name: "Noor", email: "NEW@example.com", role: "Read", scope: "all" }, "Write"),
    ).toThrow("already has");
    expect(applyManagement(next, { type: "remove-member", id: "invite" }, "Write").members).toHaveLength(s.members.length);
  });
  it("requires at least one known subscription for a selected scope", () => {
    const invite = (scope: string[]): ManagementAction => ({ type: "invite", id: "i", name: "A", email: "a@example.com", role: "Read", scope });
    expect(() => applyManagement(account(), invite([]), "Write")).toThrow("at least one");
    expect(() => applyManagement(account(), invite(["nope"]), "Write")).toThrow("not found");
  });
  it("removes people but protects your own access", () => {
    expect(applyManagement(account(), { type: "remove-member", id: "billing" }, "Write").members.some((m) => m.id === "billing")).toBe(false);
    expect(() => applyManagement(account(), { type: "remove-member", id: "self" }, "Write")).toThrow("own access");
  });
  it("rejects invalid quantities and email addresses", () => {
    expect(() =>
      applyManagement(account(), { type: "order", id: "req", subscriptionId: "s1", quantity: 0, environment: "Production", note: "" }, "Write"),
    ).toThrow("1 and 100");
    expect(() =>
      applyManagement(account(), { type: "invite", id: "invite", name: "A", email: "invalid", role: "Read", scope: "all" }, "Write"),
    ).toThrow("valid email");
  });
});
