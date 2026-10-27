import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useManagement, usePersona } from "@/components/portal-shell";
import { DataTable, WorkspaceTitle, type DataColumn } from "@/components/portal-workspace";
import { BulkRemoveMembers, InviteUser, MemberActions } from "@/components/portal-management";
import { portalHead, timestamp } from "@/lib/portal-format";
import {
  formatMemberScope,
  isRole,
  ROLE_LABELS,
  ROLES,
  type Member,
  type Role,
} from "@/lib/portal-management";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/users")({
  head: () => portalHead("Users", "People with access to this Admin Console."),
  component: Users,
});

type RoleFilter = "all" | Role;
/** "" = no filter; "all" = All subscriptions; otherwise a subscription id. */
type ScopeFilter = "" | "all" | string;

function matchesScope(member: Member, scopeFilter: ScopeFilter) {
  if (!scopeFilter) return true;
  if (scopeFilter === "all") return member.scope === "all";
  return Array.isArray(member.scope) && member.scope.includes(scopeFilter);
}

function Users() {
  const { account } = useManagement();
  const persona = usePersona();
  const active = account.members.filter((m) => m.status === "Active");
  const pending = account.members.filter((m) => m.status === "Invited");
  const [tab, setTab] = useState<"people" | "invites">("people");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("");

  const filtersActive = roleFilter !== "all" || scopeFilter !== "";
  const clearFilters = () => {
    setRoleFilter("all");
    setScopeFilter("");
  };

  const filterMembers = (members: Member[]) =>
    members.filter(
      (m) => (roleFilter === "all" || m.role === roleFilter) && matchesScope(m, scopeFilter),
    );

  const filterContent = (
    <>
      <label>
        Role
        <select
          value={roleFilter}
          onChange={(e) => {
            const value = e.target.value;
            setRoleFilter(value === "all" || isRole(value) ? value : "all");
          }}
        >
          <option value="all">All</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Scope
        <select
          value={scopeFilter || "any"}
          onChange={(e) => setScopeFilter(e.target.value === "any" ? "" : e.target.value)}
        >
          <option value="any">All</option>
          <option value="all">All subscriptions</option>
          {persona.subscriptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  const peopleColumns: DataColumn<Member>[] = [
    {
      id: "name",
      header: "Name",
      accessor: (m) => m.name,
      cell: (m) => (
        <>
          <strong>{m.name}</strong>
          {m.id === "self" && <span className="member-you">You</span>}
        </>
      ),
      csv: (m) => m.name,
    },
    { id: "email", header: "Email", accessor: (m) => m.email, cell: (m) => m.email },
    {
      id: "role",
      header: "Role",
      accessor: (m) => ROLE_LABELS[m.role],
      cell: (m) => ROLE_LABELS[m.role],
    },
    {
      id: "scope",
      header: "Scope",
      accessor: (m) => formatMemberScope(m.scope, persona),
      cell: (m) => formatMemberScope(m.scope, persona),
    },
  ];

  const inviteColumns: DataColumn<Member>[] = [
    { id: "name", header: "Name", accessor: (m) => m.name || "—", cell: (m) => m.name || "—", csv: (m) => m.name },
    { id: "email", header: "Email", accessor: (m) => m.email, cell: (m) => m.email },
    {
      id: "role",
      header: "Role",
      accessor: (m) => ROLE_LABELS[m.role],
      cell: (m) => ROLE_LABELS[m.role],
    },
    {
      id: "scope",
      header: "Scope",
      accessor: (m) => formatMemberScope(m.scope, persona),
      cell: (m) => formatMemberScope(m.scope, persona),
    },
    {
      id: "invited",
      header: "Invited",
      accessor: (m) => (m.invitedAt ? Date.parse(m.invitedAt) : null),
      cell: (m) => (m.invitedAt ? timestamp(m.invitedAt) : "—"),
      csv: (m) => (m.invitedAt ? timestamp(m.invitedAt) : ""),
    },
  ];

  return (
    <>
      <WorkspaceTitle title="Users" trailing={<InviteUser />} />
      <div className="subscription-tabs" role="tablist" aria-label="Users">
        <button type="button" role="tab" aria-selected={tab === "people"} className={cn("subscription-tab", tab === "people" && "is-active")} onClick={() => setTab("people")}>
          People with access ({active.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === "invites"} className={cn("subscription-tab", tab === "invites" && "is-active")} onClick={() => setTab("invites")}>
          Pending invites ({pending.length})
        </button>
      </div>
      {tab === "people" ? (
        <section className="workspace-panel">
          <DataTable
            key="people"
            columns={peopleColumns}
            rows={filterMembers(active)}
            rowKey={(m) => m.id}
            searchPlaceholder="Search people…"
            csvFilename="users.csv"
            rowActions={(m) => <MemberActions member={m} />}
            isRowSelectable={(m) => m.id !== "self"}
            bulkActions={({ selectedRows, clearSelection }) => (
              <BulkRemoveMembers members={selectedRows} onDone={clearSelection} />
            )}
            empty="No people with access."
            filterContent={filterContent}
            filtersActive={filtersActive}
            onClearFilters={clearFilters}
          />
        </section>
      ) : (
        <section className="workspace-panel">
          <DataTable
            key="invites"
            columns={inviteColumns}
            rows={filterMembers(pending)}
            rowKey={(m) => m.id}
            searchPlaceholder="Search invites…"
            csvFilename="pending-invites.csv"
            rowActions={(m) => <MemberActions member={m} />}
            bulkActions={({ selectedRows, clearSelection }) => (
              <BulkRemoveMembers members={selectedRows} onDone={clearSelection} />
            )}
            empty="No pending invites."
            initialSort={{ id: "invited", dir: "desc" }}
            filterContent={filterContent}
            filtersActive={filtersActive}
            onClearFilters={clearFilters}
          />
        </section>
      )}
    </>
  );
}
