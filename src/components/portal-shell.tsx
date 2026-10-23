import { createContext, useContext, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, ClipboardList, LayoutDashboard, List, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openQuestions, personas, type Persona } from "@/lib/portal-data";
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
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [personasOpen, setPersonasOpen] = useState(true);
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const persona = personas.find((p) => p.id === pid) ?? personas[0];
  if (!persona) return null;

  return <PersonaContext.Provider value={persona}>
    <div className="min-h-screen bg-background text-sm text-foreground md:flex">
      <aside className="border-b border-border bg-card px-3 py-4 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
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
        <div className="mt-6 border-t border-border px-2 pt-4 text-xs md:mt-10">
          <div className="font-medium">{persona.company}</div><div className="mt-1 text-muted-foreground">{persona.user}</div>
        </div>
        <div className="mt-7 border-t-2 border-dashed border-proto px-2 pt-3 text-xs">
          <div className="mb-2 font-semibold text-proto">Prototype controls</div>
          <Button variant="ghost" size="sm" onClick={() => setPersonasOpen(!personasOpen)} aria-expanded={personasOpen} className="h-7 w-full justify-between px-0 text-xs">Persona / state {personasOpen ? <ChevronUp /> : <ChevronDown />}</Button>
          {personasOpen && <div className="mt-1 space-y-2">
            {personas.map((p) => <label key={p.id} className="flex cursor-pointer items-start gap-2 text-xs"><input className="mt-0.5 shrink-0 accent-primary" type="radio" name="persona" checked={p.id === pid} onChange={() => setPid(p.id)} /><span>{p.label}</span></label>)}
            <p className="pt-1 text-muted-foreground">{persona.hint}</p>
          </div>}
          <Button variant="ghost" size="sm" onClick={() => setQuestionsOpen(!questionsOpen)} aria-expanded={questionsOpen} className="mt-3 h-7 w-full justify-between px-0 text-xs">Open questions {questionsOpen ? <ChevronUp /> : <ChevronDown />}</Button>
          {questionsOpen && <ol className="mt-2 max-h-64 list-decimal space-y-3 overflow-auto pl-4">
            {openQuestions.map((q) => <li key={q.t}><span className="font-medium">{q.t}</span><p className="mt-0.5 text-muted-foreground">{q.d}</p></li>)}
          </ol>}
          <p className="mt-4 text-muted-foreground">Synthetic October 2026 data. Read-only exploration; contact drafts are not sent.</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8"><div className="mx-auto max-w-6xl" key={pid}>{children}</div></main>
    </div>
  </PersonaContext.Provider>;
}