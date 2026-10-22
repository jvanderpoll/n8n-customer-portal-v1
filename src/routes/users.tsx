import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/portal-shared";
import { usePersona } from "@/components/portal-shell";
import { portalHead } from "@/lib/portal-format";
import { memberFor } from "@/lib/portal-views";

export const Route = createFileRoute("/users")({
  head: () => portalHead("Users", "Read-only account membership for the n8n self-hosted Enterprise customer portal."),
  component: Users,
});

function Users() {
  const persona = usePersona();
  const member = memberFor(persona);
  return <>
    <PageHeading title="Users" description="People linked to this customer account." />
    <section className="border-t border-border py-5"><h2 className="font-semibold">{persona.company}</h2>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[400px] text-left"><thead><tr className="border-y border-border text-xs text-muted-foreground"><th className="py-3 pr-4 font-medium">Name</th><th className="p-3 font-medium">Account role</th><th className="p-3 font-medium">Status</th></tr></thead><tbody><tr className="border-b border-border"><td className="py-4 pr-4">{member.name}<span className="ml-2 text-xs text-muted-foreground">You</span></td><td className="p-3">{member.role}</td><td className="p-3">Active</td></tr></tbody></table></div>
      <Button variant="link" asChild className="mt-6 h-auto p-0"><Link to="/contact">Contact n8n about account access <ArrowRight /></Link></Button>
    </section>
  </>;
}