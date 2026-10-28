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
  createEmptyAccount,
  formatMemberScope,
  type ManagementAction,
  type Role,
} from "./portal-management";
const account = (id = "full") =>
  createAccount(personas.find((p) => p.id === id)!);
/** Unused license for reducer cases. The demo account itself has one license. */
const withSpareLicense = (state = account()) => ({
  ...state,
  persona: {
    ...state.persona,
    licenses: [
      ...state.persona.licenses,
      {
        id: "LIC-NW-DR-01",
        subscriptionId: "s1",
        environment: "Non-production" as const,
        label: "Disaster recovery",
        status: "Active" as const,
      },
    ],
  },
});
const admin: Role = "admin";
describe("session-only account management", () => {
  it("empty portal keeps only the signed-in member and has no subscriptions or instances", () => {
    const persona = personas.find((p) => p.id === "full")!;
    const empty = createEmptyAccount(persona);
    expect(empty.members).toHaveLength(1);
    expect(empty.members[0]).toMatchObject({
      id: "self",
      name: persona.user.split(" · ")[0],
      status: "Active",
      role: "admin",
    });
    expect(empty.persona.subscriptions).toEqual([]);
    expect(empty.persona.licenses).toEqual([]);
    expect(empty.persona.instances).toEqual([]);
    expect(empty.orders).toEqual([]);
    expect(empty.persona.company).toBe(persona.company);
    expect(empty.persona.user).toBe(persona.user);
    expect(activeInstances(empty.persona)).toHaveLength(0);
  });
  it("creates an unreported instance on its license, without inventing executions", () => {
    const before = withSpareLicense();
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
    expect(before.persona.instances).toHaveLength(13);
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances).used,
    ).toBe(
      summarize(before.persona.subscriptions[0]!, before.persona.instances)
        .used,
    );
  });
  it("rejects duplicate names and unknown licenses", () => {
    const s = withSpareLicense(),
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
    const s = withSpareLicense(),
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
    const over = account("over"),
      overInstance = over.persona.instances[0]!;
    expect(() =>
      applyManagement(
        over,
        {
          type: "edit-instance",
          id: overInstance.id,
          name: overInstance.name,
          license: "LIC-HR-NPR-01",
        },
        admin,
      ),
    ).toThrow("same subscription");
  });
  it("removes inventory entries while retaining billable history and allows restoration", () => {
    const s = account(),
      id = s.persona.instances[0]!.id;
    const next = applyManagement(s, { type: "remove-instance", id }, admin);
    expect(activeInstances(next.persona)).toHaveLength(12);
    expect(
      summarize(next.persona.subscriptions[0]!, next.persona.instances).used,
    ).toBe(summarize(s.persona.subscriptions[0]!, s.persona.instances).used);
    expect(
      activeInstances(
        applyManagement(next, { type: "restore-instance", id }, admin)
          .persona,
      ),
    ).toHaveLength(13);
  });
  it("renames and removes only unused licenses, protecting history", () => {
    const s = withSpareLicense();
    const renamed = applyManagement(
      s,
      {
        type: "edit-license",
        id: "LIC-NW-DR-01",
        label: "Standby recovery",
        subscriptionId: "s1",
      },
      admin,
    );
    expect(
      renamed.persona.licenses.find((l) => l.id === "LIC-NW-DR-01"),
    ).toMatchObject({ label: "Standby recovery", subscriptionId: "s1" });
    expect(
      applyManagement(
        renamed,
        { type: "delete-license", id: "LIC-NW-DR-01" },
        admin,
      ).persona.licenses,
    ).toHaveLength(1);
    expect(() =>
      applyManagement(
        s,
        { type: "delete-license", id: "LIC-NW-PRD-01" },
        admin,
      ),
    ).toThrow("history");
    const over = account("over");
    expect(() =>
      applyManagement(
        over,
        {
          type: "edit-license",
          id: "LIC-HR-PRD-01",
          label: "Production",
          subscriptionId: "s2",
        },
        admin,
      ),
    ).toThrow("without activations");
  });
  it("requests a brand-new subscription when none exists yet, without requiring one", () => {
    const empty = createEmptyAccount(personas.find((p) => p.id === "full")!);
    const next = applyManagement(
      empty,
      { type: "order", id: "new-sub", subscriptionId: null, plan: "Enterprise", quantity: 2, environment: "Production", note: "" },
      admin,
    );
    expect(next.orders[0]).toMatchObject({ subscriptionId: null, plan: "Enterprise", status: "Pending" });
    expect(next.notice).toContain("Subscription request saved");
    expect(() =>
      applyManagement(empty, { type: "order", id: "no-plan", subscriptionId: null, quantity: 1, environment: "Production", note: "" }, admin),
    ).toThrow("Choose a plan");
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
      applyManagement(s, { type: "order", id: "old", subscriptionId: "missing", quantity: 1, environment: "Production", note: "" }, admin),
    ).toThrow();
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
      { type: "edit-member", id: "billing", role: "viewer", scope: ["s1"] },
      admin,
    );
    expect(next.members.find((m) => m.id === "billing")).toMatchObject({
      role: "viewer",
      scope: ["s1"],
    });
    expect(formatMemberScope(["s1"], next.persona)).toBe("Enterprise");
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
      description: "Tom Bakker will no longer have access to this Admin Console.",
    });
    expect(
      memberDestructiveDialogCopy({
        name: "",
        email: "billing@example.com",
        status: "Active",
      }),
    ).toEqual({
      title: "Remove?",
      description: "billing@example.com will no longer have access to this Admin Console.",
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
