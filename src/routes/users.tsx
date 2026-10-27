import { createFileRoute } from "@tanstack/react-router";
import { useManagement } from "@/components/portal-shell";
import { WorkspaceTitle } from "@/components/portal-workspace";
import { InviteUser, MemberActions } from "@/components/portal-management";
import { portalHead } from "@/lib/portal-format";
export const Route = createFileRoute("/users")({
  ssr: import.meta.env.BASE_URL === "/",
  head: () =>
    portalHead(
      "Users & access",
      "Manage customer-account membership and invitations.",
    ),
  component: Users,
});
function Users() {
  const { account, role } = useManagement();
  const active = account.members.filter((m) => m.status === "Active"),
    pending = account.members.filter((m) => m.status === "Invited");
  return (
    <>
      <WorkspaceTitle title="Users & access" trailing={<InviteUser />} />
      <p className="page-intro">
        Account roles apply to this customer portal. Workflow and instance
        permissions are managed separately in n8n.
      </p>
      <section className="workspace-panel">
        <div className="panel-heading">
          <h2>
            Members <span className="count-pill">{active.length}</span>
          </h2>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Account role</th>
                {role === "Admin" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {active.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name || m.email}</strong>
                    {m.id === "self" && (
                      <span className="count-pill member-you">You</span>
                    )}
                    <small className="cell-caption">{m.email}</small>
                  </td>
                  <td>
                    <strong>{m.role}</strong>
                  </td>
                  {role === "Admin" && (
                    <td>
                      {m.id === "self" ? (
                        <span className="muted-text">
                          Account administrator
                        </span>
                      ) : (
                        <MemberActions member={m} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="workspace-panel invitations-panel">
        <div className="panel-heading">
          <h2>
            Pending invitations{" "}
            <span className="count-pill">{pending.length}</span>
          </h2>
        </div>
        {pending.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Account role</th>
                  <th>Status</th>
                  {role === "Admin" && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pending.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}</td>
                    <td>{m.role}</td>
                    <td>
                      <span className="status-badge pending-badge">
                        Pending
                      </span>
                    </td>
                    {role === "Admin" && (
                      <td>
                        <MemberActions member={m} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel-empty">No pending invitations.</p>
        )}
      </section>
      <p className="access-note">
        Roles are proposed for this prototype. Invitations stay pending; no
        email is sent. Your own administrator access is protected.
      </p>
    </>
  );
}
