import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus,
  ArrowRightLeft,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./ui/dialog";
import { ActionMenu, ActionMenuItem } from "./action-menu";
import { useManagement, usePersona } from "./portal-shell";
import { type Instance, type License, subscriptionStatus } from "@/lib/portal-data";
import {
  formatMemberScope,
  isRole,
  ROLE_LABELS,
  ROLES,
  type ManagementAction,
  type Member,
  type MemberScope,
  type LicenseRequest,
  type Role,
} from "@/lib/portal-management";
import { DataTable, type DataColumn } from "./data-table";
export { ActionMenu, ActionMenuItem } from "./action-menu";
const value = (data: FormData, name: string) => String(data.get(name) ?? "");
const newId = () => crypto.randomUUID();

function readScope(data: FormData): MemberScope {
  if (value(data, "scope-kind") !== "selected") return "all";
  return data.getAll("scope").map(String);
}

function readRole(data: FormData): Role {
  const role = value(data, "role");
  return isRole(role) ? role : "viewer";
}

function RoleScopeFields({ member }: { member?: Member }) {
  const persona = usePersona();
  const initialKind = member && member.scope !== "all" ? "selected" : "all";
  const [scopeKind, setScopeKind] = useState<"all" | "selected">(initialKind);
  const selected = Array.isArray(member?.scope) ? member.scope : [];
  return (
    <>
      <label>
        Role
        <select name="role" defaultValue={member?.role ?? "viewer"}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="choice-group">
        <legend>Scope</legend>
        <label className="choice">
          <input
            type="radio"
            name="scope-kind"
            value="all"
            checked={scopeKind === "all"}
            onChange={() => setScopeKind("all")}
          />
          <span>
            All subscriptions
            <small>Access every subscription on this account.</small>
          </span>
        </label>
        <label className="choice">
          <input
            type="radio"
            name="scope-kind"
            value="selected"
            checked={scopeKind === "selected"}
            onChange={() => setScopeKind("selected")}
          />
          <span>
            Selected subscriptions
            <small>Limit access to one or more subscriptions.</small>
          </span>
        </label>
        {scopeKind === "selected" && (
          <div className="scope-options">
            {persona.subscriptions.map((subscription) => (
              <label key={subscription.id} className="choice">
                <input
                  type="checkbox"
                  name="scope"
                  value={subscription.id}
                  defaultChecked={selected.includes(subscription.id)}
                />
                <span>{subscription.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}

const DELETE_CONFIRM = "Delete";

function ActionDialog({
  title,
  description,
  label,
  submit,
  action,
  children,
  icon,
  variant = "secondary",
  danger = false,
  disabled = false,
  review,
  onSuccess,
}: {
  title: string;
  description: string;
  label: string;
  submit: string;
  action: (data: FormData) => ManagementAction;
  children?: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "menu";
  danger?: boolean;
  disabled?: boolean;
  review?: (data: FormData) => ReactNode;
  onSuccess?: (data: FormData) => void;
}) {
  const { perform } = useManagement();
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [draft, setDraft] = useState<FormData | null>(null),
    [confirmText, setConfirmText] = useState("");
  const deleteConfirmed = !danger || confirmText === DELETE_CONFIRM;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setError("");
        setDraft(null);
        setConfirmText("");
      }}
    >
      <DialogTrigger asChild>
        {variant === "menu" ? (
          <ActionMenuItem label={label} icon={icon} danger={danger} disabled={disabled} />
        ) : (
          <Button
            type="button"
            disabled={disabled}
            variant={variant === "primary" ? "default" : "outline"}
            size="lg"
          >
            {icon}
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="management-dialog">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (danger && confirmText !== DELETE_CONFIRM) return;
            const data = draft ?? new FormData(e.currentTarget);
            if (review && !draft) {
              setDraft(data);
              return;
            }
            const failure = perform(action(data));
            setError(failure ?? "");
            if (!failure) {
              setOpen(false);
              setDraft(null);
              setConfirmText("");
              onSuccess?.(data);
            }
          }}
        >
          <div className="management-fields" hidden={Boolean(draft)}>
            {children}
            {danger && (
              <label>
                Type Delete to confirm
                <input
                  name="delete-confirm"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Delete"
                  aria-required="true"
                />
              </label>
            )}
          </div>
          {draft && review && (
            <div className="request-review">{review(draft)}</div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {draft ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setDraft(null)}
              >
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant={danger ? "destructive" : "default"}
              size="lg"
              disabled={!deleteConfirmed}
            >
              {review && !draft ? "Review request" : submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function CreateInstance({
  subscriptionId,
}: {
  subscriptionId?: string | undefined;
}) {
  const persona = usePersona(),
    { role } = useManagement();
  const navigate = useNavigate();
  if (role !== "admin") return null;
  const available = persona.licenses.filter((l) => {
    const s = persona.subscriptions.find((s) => s.id === l.subscriptionId);
    return l.status === "Active" && s && subscriptionStatus(s) === "Running";
  });
  const initial =
    available.find((l) => l.subscriptionId === subscriptionId) ?? available[0];
  return (
    <ActionDialog
      title="Create instance"
      description="Register an instance against an active license. Self-hosted infrastructure must be deployed separately."
      label="Create instance"
      submit="Create instance"
      icon={<Plus size={16} />}
      variant="primary"
      disabled={!initial}
      onSuccess={(d) => {
        const l = available.find((l) => l.id === value(d, "license"));
        void navigate({
          to: "/instances",
          search: {
            subscription: l?.subscriptionId,
            query: value(d, "name").trim(),
          },
        });
      }}
      action={(d) => ({
        type: "create-instance",
        id: newId(),
        name: value(d, "name"),
        license: value(d, "license"),
      })}
    >
      <label>
        Instance name
        <input
          name="name"
          required
          maxLength={80}
          placeholder="e.g. production-eu-02"
        />
      </label>
      <label>
        License
        <select name="license" defaultValue={initial?.id}>
          {available.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label} ·{" "}
              {
                persona.subscriptions.find((s) => s.id === l.subscriptionId)
                  ?.name
              }
            </option>
          ))}
        </select>
      </label>
      <p className="field-hint">
        The license sets the subscription and environment. Usage appears after the
        first report.
      </p>
    </ActionDialog>
  );
}
export function InstanceActions({ instance: i }: { instance: Instance }) {
  const persona = usePersona(),
    { role } = useManagement();
  if (role !== "admin") return null;
  return (
    <ActionMenu label={`Manage ${i.name}`}>
      <ActionDialog
        title="Edit instance"
        description="Rename this instance or move it to another license within the same subscription. This does not redeploy the instance."
        label="Edit"
        icon={<Pencil size={16} />}
        variant="menu"
        submit="Save changes"
        action={(d) => ({
          type: "edit-instance",
          id: i.id,
          name: value(d, "name"),
          license: value(d, "license"),
        })}
      >
        <label>
          Instance name
          <input name="name" required maxLength={80} defaultValue={i.name} />
        </label>
        <label>
          License
          <select name="license" defaultValue={i.license}>
            {persona.licenses
              .filter(
                (l) =>
                  l.subscriptionId === i.subscriptionId &&
                  l.status === "Active",
              )
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} · {l.environment}
                </option>
              ))}
          </select>
        </label>
        <p className="field-hint">
          Reported usage stays in this subscription. The destination license
          determines the environment.
        </p>
      </ActionDialog>
      <ActionDialog
        title={`Remove ${i.name}?`}
        description="Remove this instance from the portal inventory. Its reported usage is retained. This does not shut down or delete a self-hosted server."
        label="Remove instance"
        icon={<Trash2 size={16} />}
        variant="menu"
        submit="Remove instance"
        danger
        action={() => ({ type: "remove-instance", id: i.id })}
      />
    </ActionMenu>
  );
}
export function LicenseActions({ license: l }: { license: License }) {
  const persona = usePersona(),
    { role } = useManagement();
  if (role !== "admin") return null;
  const used = persona.instances.some((i) => i.license === l.id);
  return (
    <ActionMenu label={`Manage license ${l.label}`}>
      <ActionDialog
        title="Edit license"
        description="Rename a license, or move an unused license to another running subscription."
        label="Edit / move"
        icon={<ArrowRightLeft size={16} />}
        variant="menu"
        submit="Save changes"
        action={(d) => ({
          type: "edit-license",
          id: l.id,
          label: value(d, "label"),
          subscriptionId: value(d, "subscription") || l.subscriptionId,
        })}
      >
        <label>
          License name
          <input name="label" defaultValue={l.label} required maxLength={80} />
        </label>
        <label>
          Subscription
          <select
            name="subscription"
            defaultValue={l.subscriptionId}
            disabled={used}
          >
            {persona.subscriptions
              .filter(
                (s) =>
                  subscriptionStatus(s) === "Running" ||
                  s.id === l.subscriptionId,
              )
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        {used && (
          <p className="field-hint">
            This license has activations or usage history, so its subscription
            cannot change.
          </p>
        )}
      </ActionDialog>
      <ActionDialog
        title={`Remove ${l.label}?`}
        description="Remove this unused license from the demo account. The subscription quota and commercial terms do not change."
        label="Remove unused license"
        icon={<Trash2 size={16} />}
        variant="menu"
        submit="Remove license"
        danger
        disabled={used}
        action={() => ({ type: "delete-license", id: l.id })}
      />
      {used && (
        <p className="menu-hint">
          Licenses with activations or reported history are retained.
        </p>
      )}
    </ActionMenu>
  );
}
export function RequestLicenses({
  subscriptionId,
}: {
  subscriptionId?: string | undefined;
}) {
  const persona = usePersona(),
    { role } = useManagement();
  if (role !== "admin") return null;
  const running = persona.subscriptions.filter(
    (s) => subscriptionStatus(s) === "Running",
  );
  return (
    <ActionDialog
      title="Request licenses"
      description="Request additional licenses under a running subscription. Pricing, quota, and activation require confirmation from n8n."
      label="Request licenses"
      submit="Save request"
      icon={<Plus size={16} />}
      variant="primary"
      disabled={!running.length}
      action={(d) => ({
        type: "order",
        id: newId(),
        subscriptionId: value(d, "subscription"),
        quantity: Number(value(d, "quantity")),
        environment: value(d, "environment") as Instance["env"],
        note: value(d, "note").trim(),
      })}
      review={(d) => (
        <>
          <h3>Review your request</h3>
          <dl>
            <div>
              <dt>Subscription</dt>
              <dd>
                {
                  persona.subscriptions.find(
                    (s) => s.id === value(d, "subscription"),
                  )?.name
                }
              </dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{value(d, "quantity")} licenses</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>{value(d, "environment")}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{value(d, "note") || "None"}</dd>
            </div>
            <div>
              <dt>Pricing</dt>
              <dd>To be confirmed · no charge in this prototype</dd>
            </div>
          </dl>
          <p>
            Saving this request does not activate licenses or increase your
            quota.
          </p>
        </>
      )}
    >
      <label>
        Subscription
        <select name="subscription" defaultValue={subscriptionId}>
          {running
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <div className="form-columns">
        <label>
          Quantity
          <input
            name="quantity"
            type="number"
            min={1}
            max={100}
            step={1}
            defaultValue={1}
            required
          />
        </label>
        <label>
          Environment
          <select name="environment">
            <option>Production</option>
            <option>Non-production</option>
          </select>
        </label>
      </div>
      <label>
        Notes <span className="field-optional">optional</span>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          placeholder="What do you need these licenses for?"
        />
      </label>
    </ActionDialog>
  );
}
export function OrderRequests() {
  const { account, role } = useManagement();
  if (!account.orders.length) return null;
  const columns: DataColumn<LicenseRequest>[] = [
    {
      id: "subscription",
      header: "Subscription",
      accessor: (o) =>
        account.persona.subscriptions.find((s) => s.id === o.subscriptionId)?.name ?? o.subscriptionId,
      cell: (o) =>
        account.persona.subscriptions.find((s) => s.id === o.subscriptionId)?.name ?? o.subscriptionId,
    },
    {
      id: "request",
      header: "Request",
      accessor: (o) =>
        `${o.quantity} ${o.environment.toLowerCase()} ${o.quantity === 1 ? "license" : "licenses"}${o.note ? ` — ${o.note}` : ""}`,
      cell: (o) => (
        <>
          {o.quantity} {o.environment.toLowerCase()}{" "}
          {o.quantity === 1 ? "license" : "licenses"}
          {o.note && <small className="cell-caption">{o.note}</small>}
        </>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: (o) => o.status,
      cell: (o) => (
        <span className={`status-badge ${o.status === "Cancelled" ? "neutral-badge" : "pending-badge"}`}>
          {o.status}
        </span>
      ),
    },
  ];
  return (
    <section className="workspace-panel order-requests">
      <div className="panel-heading">
        <div>
          <h2>License requests ({account.orders.length})</h2>
          <span className="supporting">
            Pending requests do not change your active licenses or quota.
          </span>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={account.orders}
        rowKey={(o) => o.id}
        searchPlaceholder="Search requests…"
        csvFilename="license-requests.csv"
        empty="No license requests."
        {...(role === "admin"
          ? { rowActions: (o: LicenseRequest) => (o.status === "Pending" ? <CancelOrder order={o} /> : null) }
          : {})}
      />
    </section>
  );
}
function CancelOrder({ order }: { order: LicenseRequest }) {
  return (
    <ActionDialog
      title="Cancel license request?"
      description="This request will remain in the demo history as cancelled."
      label="Cancel request"
      submit="Cancel request"
      danger
      action={() => ({ type: "cancel-order", id: order.id })}
    />
  );
}
export function InviteUser() {
  const { role } = useManagement();
  if (role !== "admin") return null;
  return (
    <ActionDialog
      title="Invite a person"
      description="Give someone access to this customer portal. This does not grant access to workflows or instances in n8n."
      label="Invite"
      submit="Create invitation"
      icon={<UserPlus size={16} />}
      variant="primary"
      action={(d) => ({
        type: "invite",
        id: newId(),
        name: value(d, "name"),
        email: value(d, "email"),
        role: readRole(d),
        scope: readScope(d),
      })}
    >
      <label>
        Name
        <input name="name" required maxLength={80} placeholder="Full name" />
      </label>
      <label>
        Email address
        <input
          name="email"
          type="email"
          placeholder="name@example.com"
          required
          maxLength={254}
        />
      </label>
      <RoleScopeFields />
    </ActionDialog>
  );
}
export function MemberActions({ member: m }: { member: Member }) {
  const { role } = useManagement();
  const persona = usePersona();
  if (role !== "admin") return null;
  const invited = m.status === "Invited";
  const isSelf = m.id === "self";
  return (
    <ActionMenu label={`${invited ? "Manage invitation for" : "Manage access for"} ${m.email}`}>
      {isSelf ? (
        <>
          <ActionMenuItem label="Manage access" icon={<Pencil size={16} />} disabled />
          <ActionMenuItem label="Remove" icon={<Trash2 size={16} />} danger disabled />
        </>
      ) : (
        <>
          <ActionDialog
            title="Manage access"
            description={`Change the role and subscription scope for ${m.email}. Changes apply only in this demo session.`}
            label="Manage access"
            variant="menu"
            icon={<Pencil size={16} />}
            submit="Save changes"
            action={(d) => ({
              type: "edit-member",
              id: m.id,
              role: readRole(d),
              scope: readScope(d),
            })}
          >
            <p className="role-guidance">
              Current access: {ROLE_LABELS[m.role]} · {formatMemberScope(m.scope, persona)}
            </p>
            <RoleScopeFields member={m} />
          </ActionDialog>
          <ActionDialog
            title={invited ? "Cancel invitation?" : `Remove ${m.name || m.email}?`}
            description={`${m.email} ${invited ? "will no longer have a pending invitation." : "will no longer have access to this customer portal."}`}
            label={invited ? "Cancel invitation" : "Remove"}
            variant="menu"
            icon={<Trash2 size={16} />}
            submit={invited ? "Cancel invitation" : "Remove"}
            danger
            action={() => ({ type: "remove-member", id: m.id })}
          />
        </>
      )}
    </ActionMenu>
  );
}
export function RemovedInstances() {
  const { account, role, perform } = useManagement();
  const [error, setError] = useState("");
  const rows = account.persona.instances.filter((i) => i.archived);
  if (!rows.length) return null;
  const columns: DataColumn<(typeof rows)[number]>[] = [
    { id: "name", header: "Instance", accessor: (i) => i.name, cell: (i) => i.name },
    { id: "license", header: "License", accessor: (i) => i.license, cell: (i) => i.license },
  ];
  return (
    <details className="removed-instances">
      <summary>Removed instances ({rows.length})</summary>
      <p className="field-hint">
        Removed from inventory. Previously reported executions remain in
        subscription usage.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(i) => i.id}
        searchPlaceholder="Search removed instances…"
        csvFilename="removed-instances.csv"
        empty="No removed instances."
        {...(role === "admin"
          ? {
              rowActions: (i: (typeof rows)[number]) => (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setError(perform({ type: "restore-instance", id: i.id }) ?? "")}
                >
                  Restore
                </Button>
              ),
            }
          : {})}
      />
    </details>
  );
}
