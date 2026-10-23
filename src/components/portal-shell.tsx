import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChartNoAxesCombined, Layers3, Server, CircleHelp, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personas, type Persona } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

const PersonaContext = createContext<Persona | null>(null);
export function usePersona() {
  const persona = useContext(PersonaContext);
  if (!persona) throw new Error("Portal screens require the shared persona context.");
  return persona;
}

const navigation = [
  { to: "/", label: "Usage", icon: ChartNoAxesCombined },
  { to: "/subscriptions", label: "Subscriptions", icon: Layers3 },
  { to: "/instances", label: "Instances", icon: Server },
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const [pid, setPid] = useState("full");
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const persona = personas.find((p) => p.id === pid) ?? personas[0];
  if (!persona) return null;

  return <PersonaContext.Provider value={persona}>
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <Link to="/" className="portal-brand" aria-label="n8n Customer Portal"><img src={`${import.meta.env.BASE_URL}n8n-logo.svg`} alt="n8n" width="120" height="24" /><span>Customer portal</span></Link>
        <div className="sidebar-account"><span className="account-monogram">{persona.company.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div><strong title={persona.company}>{persona.company}</strong><span>Customer account</span></div></div>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation" className="portal-navigation">{navigation.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={activeRouteId === to ? "page" : undefined} className={cn("portal-nav-item", activeRouteId === to && "is-active")}><Icon size={17} />{label}</Link>)}</nav>
        <div className="sidebar-bottom"><details className="prototype-menu"><summary>Prototype <ChevronRight size={12} /></summary><label htmlFor="prototype-persona">Scenario</label><select id="prototype-persona" value={pid} onChange={(e) => setPid(e.target.value)}>{personas.map((p) => <option key={p.id} value={p.id}>{p.label.replace(/^\d+ · /, "")}</option>)}</select><p>Illustrative data, not a customer record. Chart history is simulated.</p></details><span className="prototype-caption">Visual prototype · sample data</span></div>
      </aside>
      <div className="portal-main"><header className="portal-topbar"><span>Customer account <ChevronRight size={12} /> <strong>{persona.company}</strong></span><Popover><PopoverTrigger asChild><button className="help-button"><CircleHelp size={15} />Help</button></PopoverTrigger><PopoverContent align="end" className="text-xs"><strong>{persona.csm ?? "Contact n8n"}</strong><p className="mt-2 text-muted-foreground">{persona.csm ? "Your Customer Success Manager" : "A contact has not been assigned to this account."}</p><p className="mt-3 text-muted-foreground">Contact delivery is not connected in this visual prototype.</p></PopoverContent></Popover></header><main className="portal-content"><div key={pid}>{children}</div></main></div>
    </div>
  </PersonaContext.Provider>;
}
