import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, List, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { personas, type Persona } from "@/lib/portal-data";
import { cn } from "@/lib/utils";

const PersonaContext = createContext<Persona | null>(null);
export function usePersona() {
  const persona = useContext(PersonaContext);
  if (!persona) throw new Error("Portal screens require the shared persona context.");
  return persona;
}

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/subscriptions", label: "Subscriptions & licenses", icon: ClipboardList },
  { to: "/instances", label: "Instances", icon: List },
  { to: "/users", label: "Users", icon: Users },
  { to: "/contact", label: "Contact n8n", icon: Mail },
] as const;

export function PortalShell({ children }: { children: ReactNode }) {
  const [pid, setPid] = useState("full");
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const persona = personas.find((p) => p.id === pid) ?? personas[0];
  if (!persona) return null;

  return <PersonaContext.Provider value={persona}>
    <div className="min-h-screen bg-background text-sm text-foreground md:flex">
      <aside className="flex flex-col border-b border-border bg-card px-3 py-4 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="mb-5 flex items-center gap-2 px-2">
          <svg viewBox="0 0 40 28" className="h-7 w-10 shrink-0 text-primary" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M7 14h9l6-8h11M16 14l6 8h11" /><circle cx="5" cy="14" r="3.5" fill="currentColor" /><circle cx="24" cy="6" r="3.5" fill="currentColor" /><circle cx="34" cy="6" r="3.5" fill="currentColor" /><circle cx="24" cy="22" r="3.5" fill="currentColor" /><circle cx="34" cy="22" r="3.5" fill="currentColor" />
          </svg>
          <span><span className="text-lg font-semibold">n8n</span><span className="block text-xs text-muted-foreground">Customer Portal</span></span>
        </div>
        <nav aria-label="Main navigation" className="flex flex-wrap gap-1 md:block md:space-y-1">
          {navigation.map(({ to, label, icon: Icon }) => <Button key={to} variant="ghost" asChild className={cn("h-auto min-h-9 justify-start whitespace-normal px-2 py-2 text-xs md:w-full", activeRouteId === to && "bg-accent font-semibold text-accent-foreground")}>
            <Link to={to} aria-current={activeRouteId === to ? "page" : undefined}><Icon />{label}</Link>
          </Button>)}
        </nav>
        <div className="mt-6 border-t border-border px-2 pt-4 text-xs md:mt-auto">
          <div className="truncate font-medium" title={persona.company}>{persona.company}</div>
          <details className="mt-4 text-muted-foreground">
            <summary className="cursor-pointer py-2 text-xs hover:text-foreground">Prototype</summary>
            <div className="pb-2 pt-1">
              <label htmlFor="prototype-persona" className="sr-only">Prototype scenario</label>
              <select id="prototype-persona" value={pid} onChange={(e) => setPid(e.target.value)} className="w-full rounded border border-input bg-background px-2 py-2 text-xs text-foreground">
                {personas.map((p) => <option key={p.id} value={p.id}>{p.label.replace(/^\d+ · /, "")}</option>)}
              </select>
              <p className="mt-2 text-xs">Synthetic data · resets on refresh</p>
            </div>
          </details>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8"><div className="mx-auto max-w-6xl" key={pid}>{children}</div></main>
    </div>
  </PersonaContext.Provider>;
}