import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ChartNoAxesCombined, Layers3, Server, CircleHelp, ChevronRight, Users, RotateCcw, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personas, type Persona } from "@/lib/portal-data";
import { applyManagement, createAccount, type AccountState, type ManagementAction, type Role } from "@/lib/portal-management";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PersonaContext = createContext<Persona | null>(null);
export function usePersona() {
  const persona = useContext(PersonaContext);
  if (!persona) throw new Error("Portal screens require the shared persona context.");
  return persona;
}

const ManagementContext = createContext<{ account: AccountState; role: Role; perform: (action: ManagementAction) => string | null } | null>(null);
export function useManagement() { const value = useContext(ManagementContext); if (!value) throw new Error("Management requires the portal shell"); return value; }

const navigation = [
  { to: "/", label: "Usage", icon: ChartNoAxesCombined },
  { to: "/subscriptions", label: "Subscriptions", icon: Layers3 },
  { to: "/instances", label: "Instances", icon: Server },
  { to: "/users", label: "Users & access", icon: Users },
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const [pid, setPid] = useState("full");
  const [revision, setRevision] = useState(0);
  const navigate = useNavigate();
  const [account, setAccount] = useState(() => createAccount(personas[0]!));
  const [role, setRole] = useState<Role>("Admin");
  const perform = (action: ManagementAction) => { try { setAccount(applyManagement(account, action, role)); return null; } catch (error) { return error instanceof Error ? error.message : "Unable to complete this action."; } };
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const persona = account.persona;
  if (!persona) return null;

  return <ManagementContext.Provider value={{ account, role, perform }}><PersonaContext.Provider value={persona}>
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <Link to="/" className="portal-brand" aria-label="n8n Customer Portal"><img src={`${import.meta.env.BASE_URL}n8n-logo.svg`} alt="n8n" width="120" height="24" /><span>Customer portal</span></Link>
        <div className="sidebar-account"><span className="account-monogram">{persona.company.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div><strong title={persona.company}>{persona.company}</strong><span>Customer account</span></div></div>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation" className="portal-navigation">{navigation.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={activeRouteId === to ? "page" : undefined} className={cn("portal-nav-item", activeRouteId === to && "is-active")}><Icon size={17} />{label}</Link>)}</nav>
        <div className="sidebar-bottom"><details className="prototype-menu"><summary>Prototype <ChevronRight size={12} /></summary><label htmlFor="prototype-persona">Scenario</label><select id="prototype-persona" value={pid} onChange={(e) => { setPid(e.target.value); setAccount(createAccount(personas.find(p => p.id === e.target.value)!)); setRole("Admin"); void navigate({ to: "/", search: {}, replace: true }); }}>{personas.map((p) => <option key={p.id} value={p.id}>{p.label.replace(/^\d+ · /, "")}</option>)}</select><label htmlFor="preview-role">Preview access</label><select id="preview-role" value={role} onChange={e => setRole(e.target.value as Role)}><option>Admin</option><option>Billing</option><option>Viewer</option></select><Button variant="ghost" size="sm" className="reset-demo" onClick={() => { setAccount(createAccount(personas.find(p => p.id === pid)!)); setRole("Admin"); setRevision(r => r + 1); void navigate({ to: "/", search: {}, replace: true }); }}><RotateCcw size={14} />Reset demo</Button><p>Session only. Reloading or changing scenarios resets all changes. Nothing is sent or provisioned.</p></details><span className="prototype-caption">Visual prototype · sample data</span></div>
      </aside>
      <div className="portal-main"><header className="portal-topbar"><span>Customer account <ChevronRight size={12} /> <strong>{persona.company}</strong></span><Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="help-button"><CircleHelp size={15} />Help</Button></PopoverTrigger><PopoverContent align="end" className="text-sm"><strong>{persona.csm ?? "Contact n8n"}</strong><p className="mt-2 text-muted-foreground">{persona.csm ? "Your Customer Success Manager" : "A contact has not been assigned to this account."}</p><p className="mt-3 text-muted-foreground">Contact delivery is not connected in this visual prototype.</p></PopoverContent></Popover></header><main className="portal-content"><div key={`${pid}-${revision}`}>{role !== "Admin" && <div className="access-preview">Previewing {role} access · {role === "Billing" ? "License requests available; other management is disabled." : "Read-only access."}</div>}{account.notice && <div className="management-notice" role="status"><span>{account.notice}</span><Button variant="ghost" size="icon" aria-label="Dismiss notification" onClick={() => setAccount({ ...account, notice: "" })}><X size={16} /></Button></div>}{children}</div></main></div>
    </div>
  </PersonaContext.Provider></ManagementContext.Provider>;
}
