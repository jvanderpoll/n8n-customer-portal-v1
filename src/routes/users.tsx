import { createFileRoute } from "@tanstack/react-router";
import { useManagement } from "@/components/portal-shell";
import { CsvExport, WorkspaceTitle } from "@/components/portal-workspace";
import { InviteUser, MemberActions } from "@/components/portal-management";
import { portalHead } from "@/lib/portal-format";

export const Route = createFileRoute("/users")({
  head: () => portalHead("Users", "People with access to this customer portal."),
  component: Users,
});

function Users() {
  const { account } = useManagement();
  const active = account.members.filter((m) => m.status === "Active"),
    pending = account.members.filter((m) => m.status === "Invited");
  return (
    <>
      <WorkspaceTitle title="Users" trailing={<InviteUser />} />
      <section className="workspace-panel">
        <div className="panel-heading">
          <h2>People with access <span className="count-pill">{active.length}</span></h2>
          <CsvExport
            filename="users.csv"
            headers={["Name", "Email"]}
            rows={active.map((m) => [m.name, m.email])}
          />
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {active.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.name}</strong>{m.id === "self" && <span className="count-pill member-you">You</span>}</td>
                  <td>{m.email}</td>
                  <td className="row-menu"><MemberActions member={m} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="workspace-panel invitations-panel">
        <div className="panel-heading">
          <h2>Pending invites <span className="count-pill">{pending.length}</span></h2>
          <CsvExport
            filename="pending-invites.csv"
            headers={["Name", "Email"]}
            rows={pending.map((m) => [m.name, m.email])}
          />
        </div>
        {pending.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {pending.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name || "—"}</td>
                    <td>{m.email}</td>
                    <td className="row-menu"><MemberActions member={m} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel-empty">No pending invites.</p>
        )}
      </section>
      <p className="access-note">Prototype: invites stay pending and no email is sent.</p>
    </>
  );
}
