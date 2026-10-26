import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";
import { useNavigate } from "@tanstack/react-router";
import {
  MoreHorizontal,
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useManagement, usePersona } from "./portal-shell";
import { type Instance, type License, subscriptionStatus } from "@/lib/portal-data";
import {
  roleDescriptions,
  type ManagementAction,
  type Member,
  type Role,
  type LicenseRequest,
  type Scope,
} from "@/lib/portal-management";
const value = (data: FormData, name: string) => String(data.get(name) ?? "");
const newId = () => crypto.randomUUID();

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
    [draft, setDraft] = useState<FormData | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setError("");
        setDraft(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          disabled={disabled}
          variant={
            variant === "primary"
              ? "default"
              : variant === "menu"
                ? "ghost"
                : "outline"
          }
          size={variant === "menu" ? "default" : "lg"}
          className={`${variant === "menu" ? "management-menu-action" : ""} ${danger ? "danger-text" : ""}`}
        >
          {icon}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="management-dialog">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
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
              onSuccess?.(data);
            }
          }}
        >
          <div className="management-fields" hidden={Boolean(draft)}>
            {children}
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
            >
              {review && !draft ? "Review request" : submit}
            </Button>
          </div>
          <p className="demo-disclaimer">
            Prototype only · session changes. Nothing is sent, purchased, or
            provisioned.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ActionMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="icon-action"
          aria-label={label}
        >
          <MoreHorizontal size={20} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="action-menu">
        {children}
      </PopoverContent>
    </Popover>
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
  if (role !== "Write") return null;
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
  if (role !== "Write") return null;
  return (
    <ActionMenu label={`Manage ${i.name}`}>
      <ActionDialog
        title="Edit instance"
        description="Rename this instance or move it to another license within the same subscription. This does not redeploy the instance."
        label="Edit / move"
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
  if (role !== "Write") return null;
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
  if (role !== "Write") return null;
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
  return (
    <section className="workspace-panel order-requests">
      <div className="panel-heading">
        <div>
          <h2>
            License requests{" "}
            <span className="count-pill">{account.orders.length}</span>
          </h2>
          <span className="supporting">
            Pending requests do not change your active licenses or quota.
          </span>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Subscription</th>
              <th>Request</th>
              <th>Status</th>
              {role === "Write" && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {account.orders.map((o) => (
              <tr key={o.id}>
                <td>
                  {
                    account.persona.subscriptions.find(
                      (s) => s.id === o.subscriptionId,
                    )?.name
                  }
                </td>
                <td>
                  {o.quantity} {o.environment.toLowerCase()}{" "}
                  {o.quantity === 1 ? "license" : "licenses"}
                  {o.note && <small className="cell-caption">{o.note}</small>}
                </td>
                <td>
                  <span
                    className={`status-badge ${o.status === "Cancelled" ? "neutral-badge" : "pending-badge"}`}
                  >
                    {o.status}
                  </span>
                </td>
                {role === "Write" && (
                  <td>{o.status === "Pending" && <CancelOrder order={o} />}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
function AccessFields() {
  const persona = usePersona();
  const [scope, setScope] = useState<"all" | "selected">("all");
  return (
    <>
      <fieldset className="choice-group">
        <legend>Role</legend>
        {(Object.keys(roleDescriptions) as Role[]).map((role) => (
          <label key={role} className="choice">
            <input type="radio" name="role" value={role} defaultChecked={role === "Read"} />
            <span>
              <strong>{role}</strong>
              <small>{roleDescriptions[role]}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="choice-group">
        <legend>Subscriptions</legend>
        <label className="choice">
          <input type="radio" name="scope" value="all" checked={scope === "all"} onChange={() => setScope("all")} />
          <span><strong>All subscriptions</strong></span>
        </label>
        <label className="choice">
          <input type="radio" name="scope" value="selected" checked={scope === "selected"} onChange={() => setScope("selected")} />
          <span><strong>Only selected subscriptions</strong></span>
        </label>
        {scope === "selected" && (
          <div className="scope-options">
            {persona.subscriptions.map((s) => (
              <label key={s.id} className="choice">
                <input type="checkbox" name="subscriptions" value={s.id} />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}
const scopeFrom = (d: FormData): Scope =>
  value(d, "scope") === "selected" ? d.getAll("subscriptions").map(String) : "all";
export function InviteUser() {
  const { role } = useManagement();
  if (role !== "Write") return null;
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
        role: value(d, "role") as Role,
        scope: scopeFrom(d),
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
      <AccessFields />
    </ActionDialog>
  );
}
export function MemberActions({ member: m }: { member: Member }) {
  const { role } = useManagement();
  if (role !== "Write" || m.id === "self") return null;
  const invited = m.status === "Invited";
  return (
    <ActionMenu label={`${invited ? "Manage invitation for" : "Manage access for"} ${m.email}`}>
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
    </ActionMenu>
  );
}
export function RemovedInstances() {
  const { account, role, perform } = useManagement();
  const [error, setError] = useState("");
  const rows = account.persona.instances.filter((i) => i.archived);
  if (!rows.length) return null;
  return (
    <details className="removed-instances">
      <summary>
        Removed instances <span className="count-pill">{rows.length}</span>
      </summary>
      <p className="field-hint">
        Removed from inventory. Previously reported executions remain in
        subscription usage.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Instance</th>
              <th>License</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.license}</td>
                <td>
                  {role === "Write" && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        setError(
                          perform({ type: "restore-instance", id: i.id }) ?? "",
                        )
                      }
                    >
                      Restore {i.name}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
