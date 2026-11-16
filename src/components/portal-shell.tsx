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
import { NOW, personasFor, type Persona, type PrototypeMode } from "@/lib/portal-data";
import { contactRenewalTopicLabel } from "@/lib/portal-copy";
import { contactFor } from "@/lib/portal-views";
import { applyManagement, createAccount, createEmptyAccount, type AccountState, type ManagementAction, type Role } from "@/lib/portal-management";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PersonaContext = createContext<Persona | null>(null);
export function usePersona() {
  const persona = useContext(PersonaContext);
  if (!persona) throw new Error("Portal screens require the shared persona context.");
  return persona;
}

const PrototypeModeContext = createContext<PrototypeMode>("new");
export function usePrototypeMode() {
  return useContext(PrototypeModeContext);
}

const ManagementContext = createContext<{
  account: AccountState;
  role: Role;
  perform: (action: ManagementAction) => string | null;
  /** Session-only: stamp usageUpdated to the prototype clock (no network). */
  refreshUsage: () => void;
} | null>(null);
export function useManagement() { const value = useContext(ManagementContext); if (!value) throw new Error("Management requires the portal shell"); return value; }

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/subscriptions", label: "Subscriptions", icon: Layers3 },
  { to: "/instances", label: "Instances", icon: Server },
  { to: "/users", label: "Users", icon: Users },
] as const;

const contactTopicIds = ["quota", "renewal", "reporting", "access", "feedback", "other"] as const;
type ContactTopic = (typeof contactTopicIds)[number];

function contactTopicsFor(mode: PrototypeMode): { id: ContactTopic; label: string }[] {
  return [
    { id: "quota", label: "Quota" },
    { id: "renewal", label: contactRenewalTopicLabel(mode) },
    { id: "reporting", label: "Usage reporting" },
    { id: "access", label: "Portal access" },
    { id: "feedback", label: "Give feedback" },
    { id: "other", label: "Other" },
  ];
}

function userInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

function contactRecipient(csm: string | null) {
  return csm ? `${csm} (customer success manager)` : "n8n support";
}

function FeedbackDialog({ open, onOpenChange, company, user, csm }: { open: boolean; onOpenChange: (open: boolean) => void; company: string; user: string; csm: string | null }) {
  const [message, setMessage] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    const text = ["n8n Admin Console · Prototype feedback draft · NOT SENT", "", `Account: ${company}`, `From: ${user}`, `To: ${contactRecipient(csm)}`, "Topic: Feedback", "", message.trim(), ""].join("\n");
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
  contact,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ReturnType<typeof contactFor>;
  mode: PrototypeMode;
}) {
  const [topic, setTopic] = useState<ContactTopic | "">("");
  const [message, setMessage] = useState("");
  const topics = contactTopicsFor(mode);
  const reset = () => { setTopic(""); setMessage(""); };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || !topic) return;
    onOpenChange(false);
    toast.success("Message sent");
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="management-dialog">
        <DialogTitle>Contact n8n</DialogTitle>
        <DialogDescription>
          {contact.kind === "assigned" ? (
            <>
              Your message will be sent to <a className="text-link" href={`mailto:${contact.email}`}>{contact.name}</a>, your customer success manager.
            </>
          ) : (
            <>
              No customer success manager is assigned to this account. Your message will be sent to <a className="text-link" href={`mailto:${contact.email}`}>n8n support</a>.
            </>
          )}
        </DialogDescription>
        <form onSubmit={submit}>
          <div className="management-fields">
            <label>
              Topic
              <Select {...(topic ? { value: topic } : {})} onValueChange={(value) => setTopic(value as ContactTopic)}>
                <SelectTrigger aria-label="Topic">
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((item) => (
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
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your question"
                className="resize-y"
              />
            </label>
          </div>
          <div className="dialog-actions">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" disabled={!message.trim() || !topic}>Send message</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function selectedPersona(id: string, mode: PrototypeMode) {
  const list = personasFor(mode);
  return list.find((p) => p.id === id) ?? list[0]!;
}

function PrototypeSettings({
  pid,
  emptyPortal,
  mode,
  onModeChange,
  onScenarioChange,
  onEmptyChange,
  onReset,
}: {
  pid: string;
  emptyPortal: boolean;
  mode: PrototypeMode;
  onModeChange: (mode: PrototypeMode) => void;
  onScenarioChange: (id: string) => void;
  onEmptyChange: (empty: boolean) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scenarios = personasFor(mode);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: Event) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="prototype-settings" ref={rootRef}>
      {open && (
        <div className="prototype-settings-panel" role="dialog" aria-label="Prototype settings">
          <fieldset className="prototype-mode-fieldset">
            <legend>Prototype</legend>
            <div className="prototype-mode-switch" role="radiogroup" aria-label="Prototype version">
              <label className={cn("prototype-mode-option", mode === "old" && "is-active")}>
                <input
                  type="radio"
                  name="prototype-mode"
                  value="old"
                  checked={mode === "old"}
                  onChange={() => onModeChange("old")}
                />
                Old
              </label>
              <label className={cn("prototype-mode-option", mode === "new" && "is-active")}>
                <input
                  type="radio"
                  name="prototype-mode"
                  value="new"
                  checked={mode === "new"}
                  onChange={() => onModeChange("new")}
                />
                New
              </label>
            </div>
            <p className="prototype-mode-hint">
              {mode === "old"
                ? "Current demo: single-subscription account rollups."
                : "Feedback changes: per-subscription quota, plan-end copy, issued-to keys."}
            </p>
          </fieldset>
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
            {scenarios.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button type="button" className="prototype-reset" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset demo
          </button>
        </div>
      )}
      <div className="prototype-settings-control">
        <span className="prototype-mode-badge" aria-hidden="true">{mode === "new" ? "New" : "Old"}</span>
        <button
          type="button"
          className={cn("prototype-settings-trigger", mode === "new" && "is-new-mode")}
          aria-label={`Prototype settings (${mode === "new" ? "New" : "Old"} mode)`}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
        >
          <Settings size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const [pid, setPid] = useState("full");
  const [emptyPortal, setEmptyPortal] = useState(false);
  const [mode, setMode] = useState<PrototypeMode>("new");
  const [revision, setRevision] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const navigate = useNavigate();
  const [account, setAccount] = useState(() => createAccount(personasFor("new")[0]!));
  const role: Role = "admin";
  const perform = (action: ManagementAction) => { try { setAccount(applyManagement(account, action, role)); return null; } catch (error) { return error instanceof Error ? error.message : "Unable to complete this action."; } };
  const refreshUsage = () => {
    setAccount((current) => ({
      ...current,
      persona: { ...current.persona, usageUpdated: NOW },
    }));
  };
  const activeRouteId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const persona = account.persona;
  if (!persona) return null;
  const userName = persona.user.split(" · ")[0]!;
  const initials = userInitials(userName);
  const contact = contactFor(persona);

  const loadScenario = (id: string, empty: boolean, nextMode: PrototypeMode) => {
    const next = selectedPersona(id, nextMode);
    setAccount(empty ? createEmptyAccount(next) : createAccount(next));
  };

  const onModeChange = (nextMode: PrototypeMode) => {
    setMode(nextMode);
    loadScenario(pid, emptyPortal, nextMode);
    setRevision((r) => r + 1);
    void navigate({ to: "/", replace: true });
  };

  const onScenarioChange = (id: string) => {
    setPid(id);
    loadScenario(id, emptyPortal, mode);
    void navigate({ to: "/", replace: true });
  };

  const onEmptyChange = (empty: boolean) => {
    setEmptyPortal(empty);
    loadScenario(pid, empty, mode);
    void navigate({ to: "/", replace: true });
  };

  const onReset = () => {
    setEmptyPortal(false);
    loadScenario(pid, false, mode);
    setRevision((r) => r + 1);
    void navigate({ to: "/", replace: true });
  };

  return <ManagementContext.Provider value={{ account, role, perform, refreshUsage }}><PrototypeModeContext.Provider value={mode}><PersonaContext.Provider value={persona}>
    <div className="portal-layout" data-prototype-mode={mode}>
      <aside className="portal-sidebar">
        <Link to="/" className="portal-brand" aria-label="n8n"><img src={`${import.meta.env.BASE_URL}n8n-logo.svg`} alt="" width="120" height="24" /></Link>
        <nav aria-label="Main navigation" className="portal-navigation">{navigation.map(({ to, label, icon: Icon }) => <Link key={to} to={to} aria-current={activeRouteId === to ? "page" : undefined} className={cn("portal-nav-item", activeRouteId === to && "is-active")}><Icon size={17} />{label}</Link>)}</nav>
        <div className="sidebar-bottom">
          <Button type="button" variant="default" size="large" className="sidebar-contact-trigger" onClick={() => setContactOpen(true)}>
            <MessageCircle size={16} />
            Contact n8n
          </Button>
          <div className="sidebar-account-block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="sidebar-account" aria-label={`${userName} account menu`}>
                  <span className="sidebar-avatar" aria-hidden="true">{initials}</span>
                  <span className="sidebar-account-name">{userName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="sidebar-user-menu">
                <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>Give feedback</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { void navigate({ to: "/" }); }}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="sidebar-account-company">{persona.company}</span>
          </div>
        </div>
      </aside>
      <div className="portal-main">
        <main className="portal-content">
          <div key={`${mode}-${pid}-${emptyPortal}-${revision}`}>
            {account.notice && <div className="management-notice" role="status"><span>{account.notice}</span><Button variant="ghost" size="icon" aria-label="Dismiss notification" onClick={() => setAccount({ ...account, notice: "" })}><X size={16} /></Button></div>}
            {children}
          </div>
        </main>
      </div>
    </div>
    <PrototypeSettings
      pid={pid}
      emptyPortal={emptyPortal}
      mode={mode}
      onModeChange={onModeChange}
      onScenarioChange={onScenarioChange}
      onEmptyChange={onEmptyChange}
      onReset={onReset}
    />
    <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} company={persona.company} user={persona.user} csm={persona.csm} />
    <ContactDialog
      open={contactOpen}
      onOpenChange={setContactOpen}
      contact={contact}
      mode={mode}
    />
    <Toaster position="bottom-right" />
  </PersonaContext.Provider></PrototypeModeContext.Provider></ManagementContext.Provider>;
}
