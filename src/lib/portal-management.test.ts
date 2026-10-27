import { describe, expect, it } from "vitest";
import {
  memberDestructiveDialogCopy,
  memberDisplayName,
} from "@/components/portal-management";
import { NOW, personas, summarize } from "./portal-data";
import { timestamp } from "./portal-format";
import {
  activeInstances,
  applyManagement,
  createAccount,
  formatMemberScope,
  type ManagementAction,
  type Role,
} from "./portal-management";
const account = (id = "full") =>
  createAccount(personas.find((p) => p.id === id)!);
const admin: Role = "admin";
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
      admin,
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
        admin,
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
        admin,
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
      admin,
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
        admin,
      ),
    ).toThrow("same subscription");
  });
  it("removes inventory entries while retaining billable history and allows restoration", () => {
    const s = account(),
      id = s.persona.instances[0]!.id;
    const next = applyManagement(s, { type: "remove-instance", id }, admin);
    expect(activeInstances(next.persona)).toHaveLength(39);
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances).used,
    ).toBe(summarize(s.persona.subscriptions[0]!, s.persona.instances).used);
    expect(
      activeInstances(
        applyManagement(next, { type: "restore-instance", id }, admin)
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
      admin,
    );
    expect(
      moved.persona.licenses.find((l) => l.id === "LIC-NW-DR-01")
        ?.subscriptionId,
    ).toBe("s2");
    expect(
      applyManagement(
        moved,
        { type: "delete-license", id: "LIC-NW-DR-01" },
        admin,
      ).persona.licenses,
    ).toHaveLength(4);
    expect(() =>
      applyManagement(
        s,
        { type: "delete-license", id: "LIC-NW-PRD-01" },
        admin,
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
        admin,
      ),
    ).toThrow("without activations");
  });
  it("keeps license requests separate from licenses and quota", () => {
    const s = account();
    const next = applyManagement(
      s,
      { type: "order", id: "req", subscriptionId: "s1", quantity: 3, environment: "Production", note: "" },
      admin,
    );
    expect(next.orders[0]).toMatchObject({ quantity: 3, status: "Pending" });
    expect(next.persona.licenses).toEqual(s.persona.licenses);
    expect(next.persona.subscriptions).toEqual(s.persona.subscriptions);
    expect(applyManagement(next, { type: "cancel-order", id: "req" }, admin).orders[0]?.status).toBe("Cancelled");
    expect(() =>
      applyManagement(s, { type: "order", id: "old", subscriptionId: "s0", quantity: 1, environment: "Production", note: "" }, admin),
    ).toThrow("running subscription");
  });
  it("rejects non-admin callers", () => {
    const actions: ManagementAction[] = [
      { type: "remove-instance", id: account().persona.instances[0]!.id },
      { type: "order", id: "req", subscriptionId: "s1", quantity: 1, environment: "Production", note: "" },
      { type: "invite", id: "x", name: "X", email: "x@example.com", role: "viewer", scope: "all" },
      { type: "edit-member", id: "billing", role: "viewer", scope: "all" },
      { type: "remove-member", id: "billing" },
    ];
    for (const role of ["billing", "viewer"] as Role[]) {
      for (const action of actions)
        expect(() => applyManagement(account(), action, role)).toThrow("Only admins");
    }
  });
  it("seeds pending invites with distinct invitedAt times", () => {
    const invites = account().members.filter((m) => m.status === "Invited");
    expect(invites.length).toBeGreaterThanOrEqual(2);
    const times = invites.map((m) => m.invitedAt);
    expect(times.every(Boolean)).toBe(true);
    expect(new Set(times).size).toBe(times.length);
  });
  it("invites people with role and scope, rejects duplicates, and cancels invites", () => {
    const s = account();
    const next = applyManagement(
      s,
      { type: "invite", id: "invite", name: "Noor", email: " NEW@example.com ", role: "billing", scope: ["s1"] },
      admin,
    );
    expect(next.members.find((m) => m.id === "invite")).toMatchObject({
      name: "Noor",
      email: "new@example.com",
      status: "Invited",
      role: "billing",
      scope: ["s1"],
      invitedAt: NOW,
    });
    expect(next.notice).toBe("");
    expect(timestamp(NOW)).toMatch(/UTC$/);
    expect(() =>
      applyManagement(next, { type: "invite", id: "duplicate", name: "Noor", email: "NEW@example.com", role: "viewer", scope: "all" }, admin),
    ).toThrow("already has");
    expect(applyManagement(next, { type: "remove-member", id: "invite" }, admin).members).toHaveLength(s.members.length);
  });
  it("edits another person's role and scope, and refuses to edit yourself", () => {
    const s = account();
    const next = applyManagement(
      s,
      { type: "edit-member", id: "billing", role: "viewer", scope: ["s2"] },
      admin,
    );
    expect(next.members.find((m) => m.id === "billing")).toMatchObject({
      role: "viewer",
      scope: ["s2"],
    });
    expect(formatMemberScope(["s2"], next.persona)).toBe("EU expansion");
    expect(formatMemberScope("all", next.persona)).toBe("All subscriptions");
    expect(() =>
      applyManagement(s, { type: "edit-member", id: "self", role: "viewer", scope: "all" }, admin),
    ).toThrow("own role");
    expect(() =>
      applyManagement(s, { type: "edit-member", id: "billing", role: "viewer", scope: [] }, admin),
    ).toThrow("at least one subscription");
    expect(() =>
      applyManagement(s, { type: "edit-member", id: "billing", role: "viewer", scope: ["missing"] }, admin),
    ).toThrow("Subscription not found");
  });
  it("removes people but protects your own access", () => {
    expect(applyManagement(account(), { type: "remove-member", id: "billing" }, admin).members.some((m) => m.id === "billing")).toBe(false);
    expect(() => applyManagement(account(), { type: "remove-member", id: "self" }, admin)).toThrow("own access");
  });
  it("builds remove-person and cancel-invite dialog copy from the display name", () => {
    expect(memberDisplayName({ name: "Tom Bakker", email: "billing@example.com" })).toBe("Tom Bakker");
    expect(memberDisplayName({ name: "  ", email: "billing@example.com" })).toBe("billing@example.com");
    expect(
      memberDestructiveDialogCopy({
        name: "Tom Bakker",
        email: "billing@example.com",
        status: "Active",
      }),
    ).toEqual({
      title: "Remove?",
      description: "Tom Bakker will no longer have access to this customer portal.",
    });
    expect(
      memberDestructiveDialogCopy({
        name: "",
        email: "billing@example.com",
        status: "Active",
      }),
    ).toEqual({
      title: "Remove?",
      description: "billing@example.com will no longer have access to this customer portal.",
    });
    expect(
      memberDestructiveDialogCopy({
        name: "Operations team",
        email: "operations@example.com",
        status: "Invited",
      }),
    ).toEqual({
      title: "Cancel invitation?",
      description: "Operations team will no longer have a pending invitation.",
    });
  });
  it("rejects invalid quantities and email addresses", () => {
    expect(() =>
      applyManagement(account(), { type: "order", id: "req", subscriptionId: "s1", quantity: 0, environment: "Production", note: "" }, admin),
    ).toThrow("1 and 100");
    expect(() =>
      applyManagement(account(), { type: "invite", id: "invite", name: "A", email: "invalid", role: "viewer", scope: "all" }, admin),
    ).toThrow("valid email");
  });
});
