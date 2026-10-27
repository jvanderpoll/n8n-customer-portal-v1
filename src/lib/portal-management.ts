import { type Persona, type Instance, NOW, subscriptionStatus } from "./portal-data";

export type Role = "admin" | "billing" | "viewer";
export type MemberScope = "all" | string[];

export type Member = {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Invited";
  role: Role;
  scope: MemberScope;
  /** ISO timestamp when the invite was created (session-only; Invited members). */
  invitedAt?: string;
};

/** Deterministic invite time relative to the prototype clock. */
const invitedHoursAgo = (hours: number) =>
  new Date(Date.parse(NOW) - hours * 3600_000).toISOString();

export type LicenseRequest = {
  id: string;
  subscriptionId: string;
  quantity: number;
  environment: Instance["env"];
  note: string;
  status: "Pending" | "Cancelled";
};

export type AccountState = {
  persona: Persona;
  members: Member[];
  orders: LicenseRequest[];
  notice: string;
};

export type ManagementAction =
  | { type: "create-instance"; id: string; name: string; license: string }
  | { type: "edit-instance"; id: string; name: string; license: string }
  | { type: "remove-instance" | "restore-instance"; id: string }
  | { type: "edit-license"; id: string; label: string; subscriptionId: string }
  | { type: "delete-license"; id: string }
  | {
      type: "order";
      id: string;
      subscriptionId: string;
      quantity: number;
      environment: Instance["env"];
      note: string;
    }
  | { type: "cancel-order"; id: string }
  | { type: "invite"; id: string; name: string; email: string; role: Role; scope: MemberScope }
  | { type: "edit-member"; id: string; role: Role; scope: MemberScope }
  | { type: "remove-member"; id: string };

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  billing: "Billing",
  viewer: "Viewer",
};

export const ROLES: Role[] = ["admin", "billing", "viewer"];

export function isRole(value: string): value is Role {
  return (ROLES as string[]).includes(value);
}

export function formatMemberScope(scope: MemberScope, persona: Persona) {
  if (scope === "all") return "All subscriptions";
  const names = scope
    .map((id) => persona.subscriptions.find((s) => s.id === id)?.name ?? id)
    .filter(Boolean);
  return names.length ? names.join(", ") : "No subscriptions";
}

function normalizeScope(scope: MemberScope, persona: Persona): MemberScope {
  if (scope === "all") return "all";
  const ids = [...new Set(scope.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) throw new Error("Choose at least one subscription, or all subscriptions.");
  for (const id of ids) {
    if (!persona.subscriptions.some((s) => s.id === id)) throw new Error("Subscription not found.");
  }
  return ids;
}

export function createAccount(persona: Persona): AccountState {
  return {
    persona: structuredClone(persona),
    orders: [],
    notice: "",
    members: [
      {
        id: "self",
        name: persona.user.split(" · ")[0]!,
        email: "admin@example.com",
        status: "Active",
        role: "admin",
        scope: "all",
      },
      {
        id: "billing",
        name: "Tom Bakker",
        email: "billing@example.com",
        status: "Active",
        role: "billing",
        scope: "all",
      },
      {
        id: "pending",
        name: "Operations team",
        email: "operations@example.com",
        status: "Invited",
        role: "viewer",
        scope: persona.subscriptions[0] ? [persona.subscriptions[0].id] : "all",
        invitedAt: invitedHoursAgo(72),
      },
      {
        id: "pending-finance",
        name: "Finance partner",
        email: "finance-partner@example.com",
        status: "Invited",
        role: "billing",
        scope: "all",
        invitedAt: invitedHoursAgo(6),
      },
    ],
  };
}

export function activeInstances(persona: Persona) {
  return persona.instances.filter((i) => !i.archived);
}

export function applyManagement(
  state: AccountState,
  action: ManagementAction,
  role: Role,
): AccountState {
  // Only admins may mutate the account in this prototype.
  if (role !== "admin") throw new Error("Only admins can change this account.");
  const next = structuredClone(state),
    p = next.persona;
  const fail = (message: string): never => {
    throw new Error(message);
  };
  const instance = (id: string) =>
    p.instances.find((i) => i.id === id) ?? fail("Instance not found.");
  const license = (id: string) =>
    p.licenses.find((l) => l.id === id) ?? fail("License not found.");
  const subscription = (id: string) =>
    p.subscriptions.find((s) => s.id === id) ?? fail("Subscription not found.");
  switch (action.type) {
    case "create-instance":
    case "edit-instance": {
      const name = action.name.trim(),
        l = license(action.license),
        s = subscription(l.subscriptionId);
      if (!name || name.length > 80)
        fail("Enter an instance name of 1–80 characters.");
      if (
        p.instances.some(
          (i) =>
            !i.archived &&
            i.name.toLowerCase() === name.toLowerCase() &&
            i.id !== action.id,
        )
      )
        fail("An instance with this name already exists.");
      if (l.status !== "Active" || subscriptionStatus(s) === "Expired")
        fail("Choose an active license on a running subscription.");
      if (action.type === "create-instance") {
        if (p.instances.some((i) => i.id === action.id))
          fail("Instance reference already exists.");
        p.instances.unshift({
          id: action.id,
          name,
          license: l.id,
          subscriptionId: l.subscriptionId,
          env: l.environment,
          status: "pending",
          executions: null,
          lastReport: null,
        });
        next.notice = `${name} created in this demo. Waiting for its first report.`;
      } else {
        const i = instance(action.id);
        if (i.archived) fail("Restore the instance before editing it.");
        if (i.subscriptionId !== l.subscriptionId)
          fail(
            "Instances can move only between licenses in the same subscription.",
          );
        Object.assign(i, { name, license: l.id, env: l.environment });
        next.notice = `${name} updated. Subscription usage is unchanged.`;
      }
      break;
    }
    case "remove-instance":
      instance(action.id).archived = true;
      next.notice =
        "Instance removed from inventory. Reported usage is retained.";
      break;
    case "restore-instance":
      instance(action.id).archived = false;
      next.notice = "Instance restored.";
      break;
    case "edit-license": {
      const l = license(action.id),
        from = subscription(l.subscriptionId),
        target = subscription(action.subscriptionId);
      if (!action.label.trim() || action.label.trim().length > 80)
        fail("Enter a license name of 1–80 characters.");
      if (from.id !== target.id) {
        if (p.instances.some((i) => i.license === l.id))
          fail(
            "Only licenses without activations or usage history can move between subscriptions.",
          );
        if (subscriptionStatus(target) === "Expired") fail("Choose a running subscription.");
      }
      l.label = action.label.trim();
      l.subscriptionId = target.id;
      next.notice = "License updated.";
      break;
    }
    case "delete-license": {
      license(action.id);
      if (p.instances.some((i) => i.license === action.id))
        fail(
          "Move or remove activations first. Licenses with reported history must be retained.",
        );
      p.licenses = p.licenses.filter((l) => l.id !== action.id);
      next.notice = "Unused license removed in this demo.";
      break;
    }
    case "order": {
      if (subscriptionStatus(subscription(action.subscriptionId)) === "Expired")
        fail("Choose a running subscription.");
      if (
        !Number.isInteger(action.quantity) ||
        action.quantity < 1 ||
        action.quantity > 100
      )
        fail("Choose between 1 and 100 licenses.");
      next.orders.unshift({ ...action, status: "Pending" });
      next.notice =
        "License request saved in this demo. Nothing has been ordered or sent.";
      break;
    }
    case "cancel-order": {
      const request =
        next.orders.find((o) => o.id === action.id) ??
        fail("Request not found.");
      if (request.status !== "Pending")
        fail("This request is already cancelled.");
      request.status = "Cancelled";
      next.notice = "License request cancelled.";
      break;
    }
    case "invite": {
      const email = action.email.trim().toLowerCase(),
        name = action.name.trim();
      if (!name || name.length > 80) fail("Enter a name of 1–80 characters.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid email address.");
      if (!isRole(action.role)) fail("Choose a role.");
      if (next.members.some((m) => m.email.toLowerCase() === email))
        fail("This person already has access or a pending invitation.");
      next.members.push({
        id: action.id,
        name,
        email,
        status: "Invited",
        role: action.role,
        scope: normalizeScope(action.scope, p),
        invitedAt: NOW,
      });
      break;
    }
    case "edit-member": {
      const member =
        next.members.find((m) => m.id === action.id) ?? fail("User not found.");
      if (member.id === "self")
        fail("Your own role and scope cannot be changed in this prototype.");
      if (!isRole(action.role)) fail("Choose a role.");
      member.role = action.role;
      member.scope = normalizeScope(action.scope, p);
      next.notice = "Access updated in this demo.";
      break;
    }
    case "remove-member": {
      const member =
        next.members.find((m) => m.id === action.id) ?? fail("User not found.");
      if (member.id === "self")
        fail("Your own access cannot be removed in this prototype.");
      next.members = next.members.filter((m) => m.id !== action.id);
      next.notice =
        member.status === "Invited"
          ? "Invitation cancelled."
          : "Access removed.";
      break;
    }
  }
  return next;
}
