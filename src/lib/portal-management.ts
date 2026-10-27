import { type Persona, type Instance } from "./portal-data";
export type Role = "Admin" | "Billing" | "Viewer";
export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "Active" | "Invited";
};
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
  | { type: "invite"; id: string; email: string; role: Role }
  | { type: "role"; id: string; role: Role }
  | { type: "remove-member"; id: string };
export const roleDescriptions: Record<Role, string> = {
  Admin: "Manage instances, licenses, orders, and account access.",
  Billing: "View usage and inventory, and request licenses.",
  Viewer: "View usage, agreements, and inventory.",
};
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
        role: "Admin",
        status: "Active",
      },
      {
        id: "billing",
        name: "Alex Morgan",
        email: "billing@example.com",
        role: "Billing",
        status: "Active",
      },
      {
        id: "pending",
        name: "",
        email: "operations@example.com",
        role: "Viewer",
        status: "Invited",
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
  const billingAction =
    action.type === "order" || action.type === "cancel-order";
  if (role !== "Admin" && !(role === "Billing" && billingAction))
    throw new Error("Your preview role does not allow this action.");
  if (
    (action.type === "invite" || action.type === "role") &&
    !Object.hasOwn(roleDescriptions, action.role)
  )
    throw new Error("Choose a valid account role.");
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
    p.subscriptions.find((s) => s.id === id) ?? fail("Agreement not found.");
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
      if (l.status !== "Active" || s.status === "Expired")
        fail("Choose an active license and agreement.");
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
            "Instances can move only between licenses in the same agreement.",
          );
        Object.assign(i, { name, license: l.id, env: l.environment });
        next.notice = `${name} updated. Agreement usage is unchanged.`;
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
            "Only licenses without activations or usage history can move between agreements.",
          );
        if ((from.metric ?? "executions") !== (target.metric ?? "executions"))
          fail("Choose an agreement with the same allowance type.");
        if (target.status === "Expired") fail("Choose an active agreement.");
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
      if (subscription(action.subscriptionId).status === "Expired")
        fail("Choose an active agreement.");
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
      const email = action.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid email address.");
      if (next.members.some((m) => m.email.toLowerCase() === email))
        fail("This person already has access or a pending invitation.");
      next.members.push({
        id: action.id,
        name: "",
        email,
        role: action.role,
        status: "Invited",
      });
      next.notice = "Invitation added to this demo. No email has been sent.";
      break;
    }
    case "role":
    case "remove-member": {
      const member =
        next.members.find((m) => m.id === action.id) ?? fail("User not found.");
      if (member.id === "self")
        fail(
          "Your own administrator access cannot be changed in this prototype.",
        );
      if (
        member.role === "Admin" &&
        member.status === "Active" &&
        next.members.filter((m) => m.role === "Admin" && m.status === "Active")
          .length <= 1
      )
        fail("Keep at least one active administrator.");
      if (action.type === "role") {
        member.role = action.role;
        next.notice = "Account role updated.";
      } else {
        next.members = next.members.filter((m) => m.id !== action.id);
        next.notice =
          member.status === "Invited"
            ? "Invitation cancelled."
            : "Account access removed.";
      }
      break;
    }
  }
  return next;
}
