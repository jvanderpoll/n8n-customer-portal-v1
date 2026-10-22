import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Download, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeading } from "@/components/portal-shared";
import { usePersona } from "@/components/portal-shell";
import { portalHead } from "@/lib/portal-format";
import { contactFor } from "@/lib/portal-views";

const topics = [
  { id: "subscription", label: "Subscription & quota" },
  { id: "reporting", label: "Usage reporting" },
  { id: "access", label: "Account access" },
  { id: "other", label: "Other" },
] as const;

export const Route = createFileRoute("/contact")({
  validateSearch: z.object({ topic: z.enum(["subscription", "reporting", "access", "other"]).optional().catch(undefined), instance: z.string().optional().catch(undefined) }),
  head: () => portalHead("Contact n8n", "Customer success contact and local enquiry drafts for n8n Enterprise subscription and reporting questions."),
  component: Contact,
});

function Contact() {
  const persona = usePersona();
  const search = Route.useSearch();
  const contact = contactFor(persona);
  const linkedInstance = persona.instances.find((i) => i.id === search.instance);
  const [topic, setTopic] = useState<string>(search.topic ?? "subscription");
  const [message, setMessage] = useState(linkedInstance ? `I have a question about usage reporting for ${linkedInstance.name} (${linkedInstance.license}).\n\n` : "");
  const [downloaded, setDownloaded] = useState(false);

  const downloadDraft = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    const topicName = topics.find((item) => item.id === topic)?.label ?? "Other";
    const text = ["n8n Customer Portal · Prototype enquiry draft · NOT SENT", "", `Account: ${persona.company}`, `From: ${persona.user}`, `Contact: ${contact.name ?? "Unassigned — fallback destination not yet decided"}`, `Topic: ${topicName}`, ...(linkedInstance ? [`Instance: ${linkedInstance.name}`, `License reference: ${linkedInstance.license}`] : []), "", message.trim(), ""].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "n8n-enquiry-draft.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  };

  return <>
    <PageHeading title="Contact n8n" description="Questions about your subscription, usage reports or account." />
    <section className="border-t border-border py-5">
      <div className="flex items-start gap-3"><UserRound className="mt-0.5 size-5 text-muted-foreground" /><div>
        <h2 className="font-semibold">{contact.name ?? "No customer success manager assigned"}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{contact.kind === "assigned" ? "Your customer success manager" : "The contact destination for unassigned accounts is still to be decided."}</p>
        <p className="mt-3 text-muted-foreground">{contact.kind === "assigned" ? "For subscription questions, quota concerns and usage-reporting follow-up." : "Your account is available, but there is no named contact to show yet."}</p>
      </div></div>
    </section>
    <section className="max-w-2xl border-t border-border pt-5">
      <h2 className="flex items-center gap-2 font-semibold"><Mail className="size-4 text-muted-foreground" />Enquiry draft</h2>
      <p className="mt-2 border-l-2 border-dashed border-proto pl-3 text-xs text-proto">Prototype only — this draft stays in your browser. Downloading it does not send a message to n8n.</p>
      <form onSubmit={downloadDraft} className="mt-5 space-y-4">
        <div><span className="mb-1.5 block text-xs font-medium">Topic</span><Select value={topic} onValueChange={(value) => { setTopic(value); setDownloaded(false); }}><SelectTrigger aria-label="Enquiry topic"><SelectValue /></SelectTrigger><SelectContent>{topics.map((item) => <SelectItem value={item.id} key={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
        {linkedInstance && <p className="text-xs text-muted-foreground">Instance: <span className="font-mono text-foreground">{linkedInstance.name}</span> · {linkedInstance.license}</p>}
        <div><label htmlFor="enquiry-message" className="mb-1.5 block text-xs font-medium">Message</label><Textarea id="enquiry-message" required rows={6} value={message} onChange={(e) => { setMessage(e.target.value); setDownloaded(false); }} placeholder="Your question" className="resize-y" /></div>
        <Button type="submit" variant="outline" disabled={!message.trim()}><Download />Download draft</Button>
        {downloaded && <p role="status" className="text-xs text-muted-foreground">Draft downloaded. No message was sent.</p>}
      </form>
    </section>
  </>;
}