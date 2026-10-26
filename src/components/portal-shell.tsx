import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Layers3, Server, CircleHelp, ChevronRight, Users, RotateCcw, X, MessageCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/subscriptions", label: "Subscriptions", icon: Layers3 },
  { to: "/instances", label: "Instances", icon: Server },
  { to: "/users", label: "Users", icon: Users },
  { to: "/contact", label: "Contact n8n", icon: MessageCircle },
] as const;

function userInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

function FeedbackDialog({ open, onOpenChange, company, user, csm }: { open: boolean; onOpenChange: (open: boolean) => void; company: string; user: string; csm: string }) {
  const [message, setMessage] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    const text = ["n8n Customer Portal · Prototype feedback draft · NOT SENT", "", `Account: ${company}`, `From: ${user}`, `To: ${csm} (customer success manager)`, "Topic: Feedback", "", message.trim(), ""].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "n8n-feedback-draft.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setMessage(""); setDownloaded(false); } }}>
      <DialogContent className="management-dialog">
        <DialogTitle>Give feedback</DialogTitle>
        <DialogDescription>Prototype only. Your note downloads as a local draft. Nothing is sent.</DialogDescription>
        <form onSubmit={submit}>
          <div className="management-fields">
            <label>
              Feedback
              <Textarea
                required
                rows={5}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setDownloaded(false); }}
                placeholder="What should we improve?"
                className="resize-y"
              />
            </label>
          </div>
          <div className="dialog-actions">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={!message.trim()}>Download draft</Button>
          </div>
          {downloaded && <p role="status" className="demo-disclaimer">Draft downloaded. No message was sent.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const [pid, setPid] = useState("full");
  const [revision, setRevision] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const navigate = useNavigate();
  const [account, setAccount] = useState(() => createAccount(personas[0]!));
  const role: Role = "admin";
  const perform = (action: ManagementAction) => { try { setAccount(applyManagement(account, action, role)); return null; } catch (error) { return error instanceof Error ? error.message : "Unable to complete this action."; } };
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const persona = account.persona;
  if (!persona) return null;
  const userName = persona.user.split(" · ")[0]!;
  const initials = userInitials(userName);

  return <ManagementContext.Provider value={{ account, role, perform }}><PersonaContext.Provider value={persona}>
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <Link to="/" className="portal-brand" aria-label="n8n Customer Portal"><img src={`${import.meta.env.BASE_URL}n8n-logo.svg`} alt="n8n" width="120" height="24" /><span>Customer portal</span></Link>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation" className="portal-navigation">{navigation.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={activeRouteId === to ? "page" : undefined} className={cn("portal-nav-item", activeRouteId === to && "is-active")}><Icon size={17} />{label}</Link>)}</nav>
        <div className="sidebar-bottom">
          <details className="prototype-menu">
            <summary>Prototype <ChevronRight size={12} /></summary>
            <label htmlFor="prototype-persona">Scenario</label>
            <select id="prototype-persona" value={pid} onChange={(e) => { setPid(e.target.value); setAccount(createAccount(personas.find(p => p.id === e.target.value)!)); void navigate({ to: "/", replace: true }); }}>{personas.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <Button variant="ghost" size="sm" className="reset-demo" onClick={() => { setAccount(createAccount(personas.find(p => p.id === pid)!)); setRevision(r => r + 1); void navigate({ to: "/", replace: true }); }}><RotateCcw size={14} />Reset demo</Button>
          </details>
          <div className="sidebar-user">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="sidebar-avatar" aria-label={`${userName} account menu`}>{initials}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="sidebar-user-menu">
                <DropdownMenuItem asChild>
                  <Link to="/contact">Message {persona.csm}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>Give feedback</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar">
          <span>Customer account <ChevronRight size={12} /> <strong>{persona.company}</strong></span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="help-button"><CircleHelp size={15} />Help</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="text-sm">
              <strong>{persona.csm}</strong>
              <p className="mt-1 text-muted-foreground">Your customer success manager</p>
              <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/contact">Contact {persona.csm}</Link></Button>
            </PopoverContent>
          </Popover>
        </header>
        <main className="portal-content">
          <div key={`${pid}-${revision}`}>
            {account.notice && <div className="management-notice" role="status"><span>{account.notice}</span><Button variant="ghost" size="icon" aria-label="Dismiss notification" onClick={() => setAccount({ ...account, notice: "" })}><X size={16} /></Button></div>}
            {children}
          </div>
        </main>
      </div>
    </div>
    <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} company={persona.company} user={persona.user} csm={persona.csm} />
  </PersonaContext.Provider></ManagementContext.Provider>;
}
