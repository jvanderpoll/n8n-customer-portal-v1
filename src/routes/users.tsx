import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useManagement } from "@/components/portal-shell";
import { DataTable, WorkspaceTitle, type DataColumn } from "@/components/portal-workspace";
import { InviteUser, MemberActions } from "@/components/portal-management";
import { portalHead } from "@/lib/portal-format";
import type { Member } from "@/lib/portal-management";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/users")({
  head: () => portalHead("Users", "People with access to this customer portal."),
  component: Users,
});

function Users() {
  const { account } = useManagement();
  const active = account.members.filter((m) => m.status === "Active");
  const pending = account.members.filter((m) => m.status === "Invited");
  const [tab, setTab] = useState<"people" | "invites">("people");

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
  ];

  const inviteColumns: DataColumn<Member>[] = [
    { id: "name", header: "Name", accessor: (m) => m.name || "—", cell: (m) => m.name || "—", csv: (m) => m.name },
    { id: "email", header: "Email", accessor: (m) => m.email, cell: (m) => m.email },
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
            columns={peopleColumns}
            rows={active}
            rowKey={(m) => m.id}
            searchPlaceholder="Search people…"
            csvFilename="users.csv"
            rowActions={(m) => <MemberActions member={m} />}
            empty="No people with access."
          />
        </section>
      ) : (
        <section className="workspace-panel">
          <DataTable
            columns={inviteColumns}
            rows={pending}
            rowKey={(m) => m.id}
            searchPlaceholder="Search invites…"
            csvFilename="pending-invites.csv"
            rowActions={(m) => <MemberActions member={m} />}
            empty="No pending invites."
          />
        </section>
      )}
    </>
  );
}
