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
      "Admin",
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
        "Admin",
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
        "Admin",
      ),
    ).toThrow("not found");
  });
  it("moves an instance within an agreement without changing agreement usage", () => {
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
      "Admin",
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
        "Admin",
      ),
    ).toThrow("same agreement");
  });
  it("removes inventory entries while retaining billable history and allows restoration", () => {
    const s = account(),
      id = s.persona.instances[0]!.id;
    const next = applyManagement(s, { type: "remove-instance", id }, "Admin");
    expect(activeInstances(next.persona)).toHaveLength(39);
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances).used,
    ).toBe(summarize(s.persona.subscriptions[0]!, s.persona.instances).used);
    expect(
      activeInstances(
        applyManagement(next, { type: "restore-instance", id }, "Admin")
          .persona,
      ),
    ).toHaveLength(40);
  });
  it("releases active OEM capacity when an instance is removed", () => {
    const s = account("oem");
    const next = applyManagement(
      s,
      { type: "remove-instance", id: s.persona.instances[0]!.id },
      "Admin",
    );
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances),
    ).toMatchObject({ used: 31, remaining: 19 });
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
      "Admin",
    );
    expect(
      moved.persona.licenses.find((l) => l.id === "LIC-NW-DR-01")
        ?.subscriptionId,
    ).toBe("s2");
    expect(
      applyManagement(
        moved,
        { type: "delete-license", id: "LIC-NW-DR-01" },
        "Admin",
      ).persona.licenses,
    ).toHaveLength(3);
    expect(() =>
      applyManagement(
        s,
        { type: "delete-license", id: "LIC-NW-PRD-01" },
        "Admin",
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
        "Admin",
      ),
    ).toThrow("without activations");
  });
  it("keeps commercial requests separate from purchased licenses and allowances", () => {
    const s = account();
    const next = applyManagement(
      s,
      {
        type: "order",
        id: "req",
        subscriptionId: "s1",
        quantity: 3,
        environment: "Production",
        note: "",
      },
      "Billing",
    );
    expect(next.orders[0]).toMatchObject({ quantity: 3, status: "Pending" });
    expect(next.persona.licenses).toEqual(s.persona.licenses);
    expect(next.persona.subscriptions).toEqual(s.persona.subscriptions);
    expect(
      applyManagement(next, { type: "cancel-order", id: "req" }, "Billing")
        .orders[0]?.status,
    ).toBe("Cancelled");
  });
  it("enforces preview permissions at the state boundary", () => {
    const action: ManagementAction = {
      type: "remove-instance",
      id: account().persona.instances[0]!.id,
    };
    for (const role of ["Billing", "Viewer"] as const)
      expect(() => applyManagement(account(), action, role)).toThrow(
        "does not allow",
      );
    expect(() =>
      applyManagement(
        account(),
        {
          type: "order",
          id: "req",
          subscriptionId: "s1",
          quantity: 1,
          environment: "Production",
          note: "",
        },
        "Viewer",
      ),
    ).toThrow("does not allow");
  });
  it("invites users locally, rejects case-insensitive duplicates, and cancels invitations", () => {
    const s = account();
    const next = applyManagement(
      s,
      {
        type: "invite",
        id: "invite",
        email: " NEW@example.com ",
        role: "Viewer",
      },
      "Admin",
    );
    expect(next.members.find((m) => m.id === "invite")).toMatchObject({
      email: "new@example.com",
      status: "Invited",
      role: "Viewer",
    });
    expect(() =>
      applyManagement(
        next,
        {
          type: "invite",
          id: "duplicate",
          email: "NEW@example.com",
          role: "Admin",
        },
        "Admin",
      ),
    ).toThrow("already has");
    expect(
      applyManagement(next, { type: "remove-member", id: "invite" }, "Admin")
        .members,
    ).toHaveLength(s.members.length);
  });
  it("supports role changes and protects the current administrator", () => {
    expect(
      applyManagement(
        account(),
        { type: "role", id: "billing", role: "Viewer" },
        "Admin",
      ).members.find((m) => m.id === "billing")?.role,
    ).toBe("Viewer");
    expect(() =>
      applyManagement(
        account(),
        { type: "remove-member", id: "self" },
        "Admin",
      ),
    ).toThrow("own administrator");
    expect(() =>
      applyManagement(
        account(),
        { type: "role", id: "self", role: "Viewer" },
        "Admin",
      ),
    ).toThrow("own administrator");
  });
  it("rejects invalid quantities and email addresses", () => {
    expect(() =>
      applyManagement(
        account(),
        {
          type: "order",
          id: "req",
          subscriptionId: "s1",
          quantity: 0,
          environment: "Production",
          note: "",
        },
        "Admin",
      ),
    ).toThrow("1 and 100");
    expect(() =>
      applyManagement(
        account(),
        { type: "invite", id: "invite", email: "invalid", role: "Viewer" },
        "Admin",
      ),
    ).toThrow("valid email");
  });
});
