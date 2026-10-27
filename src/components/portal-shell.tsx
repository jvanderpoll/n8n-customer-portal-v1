import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Layers3, Server, Users, RotateCcw, X, MessageCircle, Settings } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { personas, type Persona } from "@/lib/portal-data";
import { applyManagement, createAccount, createEmptyAccount, type AccountState, type ManagementAction, type Role } from "@/lib/portal-management";
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
] as const;

const contactTopics = [
  { id: "quota", label: "Quota" },
  { id: "renewal", label: "Renewal" },
  { id: "reporting", label: "Usage reporting" },
  { id: "access", label: "Portal access" },
  { id: "other", label: "Other" },
] as const;
type ContactTopic = (typeof contactTopics)[number]["id"];

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
        <DialogDescription>Write your feedback and download a draft to share with n8n.</DialogDescription>
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
          {downloaded && <p role="status" className="muted-text">Draft downloaded.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({
  open,
  onOpenChange,
  company,
  user,
  csm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: string;
  user: string;
  csm: string;
}) {
  const [topic, setTopic] = useState<ContactTopic | "">("");
  const [message, setMessage] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const topicLabel = contactTopics.find((item) => item.id === topic)?.label ?? "";
  const reset = () => { setTopic(""); setMessage(""); setDownloaded(false); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || !topic || !topicLabel) return;
    const text = ["n8n Customer Portal · Prototype enquiry draft · NOT SENT", "", `Account: ${company}`, `From: ${user}`, `To: ${csm} (customer success manager)`, `Topic: ${topicLabel}`, "", message.trim(), ""].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "n8n-enquiry-draft.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="management-dialog">
        <DialogTitle>Contact n8n</DialogTitle>
        <DialogDescription>
          Your message will be prepared for {csm}, your customer success manager. Download a local draft — nothing is sent.
        </DialogDescription>
        <form onSubmit={submit}>
          <div className="management-fields">
            <label>
              Topic
              <Select value={topic || undefined} onValueChange={(value) => { setTopic(value as ContactTopic); setDownloaded(false); }}>
                <SelectTrigger aria-label="Topic">
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {contactTopics.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label>
              Message
              <Textarea
                required
                rows={5}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setDownloaded(false); }}
                placeholder="Your question"
                className="resize-y"
              />
            </label>
          </div>
          <div className="dialog-actions">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={!message.trim() || !topic}>Download draft</Button>
          </div>
          {downloaded && <p role="status" className="muted-text">Draft downloaded.</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function selectedPersona(id: string) {
  return personas.find((p) => p.id === id) ?? personas[0]!;
}

function PrototypeSettings({
  pid,
  emptyPortal,
  onScenarioChange,
  onEmptyChange,
  onReset,
}: {
  pid: string;
  emptyPortal: boolean;
  onScenarioChange: (id: string) => void;
  onEmptyChange: (empty: boolean) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="prototype-settings" ref={rootRef}>
      {open && (
        <div className="prototype-settings-panel" role="dialog" aria-label="Prototype settings">
          <label className="prototype-empty-toggle" htmlFor="prototype-empty-portal">
            <input
              id="prototype-empty-portal"
              type="checkbox"
              checked={emptyPortal}
              onChange={(e) => onEmptyChange(e.target.checked)}
            />
            Empty portal
          </label>
          <label htmlFor="prototype-persona">Scenario</label>
          <select
            id="prototype-persona"
            value={pid}
            onChange={(e) => onScenarioChange(e.target.value)}
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button type="button" className="prototype-reset" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset demo
          </button>
        </div>
      )}
      <button
        type="button"
        className="prototype-settings-trigger"
        aria-label="Prototype settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const [pid, setPid] = useState("full");
  const [emptyPortal, setEmptyPortal] = useState(false);
  const [revision, setRevision] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const navigate = useNavigate();
  const [account, setAccount] = useState(() => createAccount(personas[0]!));
  const role: Role = "admin";
  const perform = (action: ManagementAction) => { try { setAccount(applyManagement(account, action, role)); return null; } catch (error) { return error instanceof Error ? error.message : "Unable to complete this action."; } };
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const persona = account.persona;
  if (!persona) return null;
  const userName = persona.user.split(" · ")[0]!;
  const initials = userInitials(userName);

  const loadScenario = (id: string, empty: boolean) => {
    const next = selectedPersona(id);
    setAccount(empty ? createEmptyAccount(next) : createAccount(next));
  };

  const onScenarioChange = (id: string) => {
    setPid(id);
    loadScenario(id, emptyPortal);
    void navigate({ to: "/", replace: true });
  };

  const onEmptyChange = (empty: boolean) => {
    setEmptyPortal(empty);
    loadScenario(pid, empty);
    void navigate({ to: "/", replace: true });
  };

  const onReset = () => {
    setEmptyPortal(false);
    loadScenario(pid, false);
    setRevision((r) => r + 1);
    void navigate({ to: "/", replace: true });
  };

  return <ManagementContext.Provider value={{ account, role, perform }}><PersonaContext.Provider value={persona}>
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <Link to="/" className="portal-brand" aria-label="n8n Customer Portal"><img src={`${import.meta.env.BASE_URL}n8n-logo.svg`} alt="n8n" width="120" height="24" /><span>Customer portal</span></Link>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation" className="portal-navigation">{navigation.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={activeRouteId === to ? "page" : undefined} className={cn("portal-nav-item", activeRouteId === to && "is-active")}><Icon size={17} />{label}</Link>)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-contact">
            <Button type="button" variant="ghost" className="sidebar-contact-trigger" onClick={() => setContactOpen(true)}>
              <MessageCircle size={17} />
              Contact n8n
            </Button>
          </div>
          <div className="sidebar-user">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="sidebar-avatar" aria-label={`${userName} account menu`}>{initials}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="sidebar-user-menu">
                <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>Give feedback</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { void navigate({ to: "/" }); }}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
      <div className="portal-main">
        <main className="portal-content">
          <div key={`${pid}-${emptyPortal}-${revision}`}>
            {account.notice && <div className="management-notice" role="status"><span>{account.notice}</span><Button variant="ghost" size="icon" aria-label="Dismiss notification" onClick={() => setAccount({ ...account, notice: "" })}><X size={16} /></Button></div>}
            {children}
          </div>
        </main>
      </div>
    </div>
    <PrototypeSettings
      pid={pid}
      emptyPortal={emptyPortal}
      onScenarioChange={onScenarioChange}
      onEmptyChange={onEmptyChange}
      onReset={onReset}
    />
    <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} company={persona.company} user={persona.user} csm={persona.csm} />
    <ContactDialog
      open={contactOpen}
      onOpenChange={setContactOpen}
      company={persona.company}
      user={persona.user}
      csm={persona.csm}
    />
  </PersonaContext.Provider></ManagementContext.Provider>;
}
