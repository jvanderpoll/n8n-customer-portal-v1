import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersona } from "@/components/portal-shell";
import { EmptySubscription, Freshness, PageHeading, Requirements, SubscriptionUsage } from "@/components/portal-shared";
import { date, portalHead } from "@/lib/portal-format";

export const Route = createFileRoute("/")({
  head: () => portalHead("Overview", "Subscription quota, usage and data completeness for n8n self-hosted Enterprise customers."),
  component: Index,
});

function Index() {
  const persona = usePersona();
  return <>
    <PageHeading title="Overview" description="Execution quota and usage over each subscription’s contract period." />
    {!persona.subscriptions.length ? <EmptySubscription persona={persona} /> : <>
      <Freshness persona={persona} /><Requirements persona={persona} />
      <div className="space-y-5">{persona.subscriptions.map((s) => <section key={s.id} className="rounded border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">{s.name}</h2><span className="text-xs text-muted-foreground">Contract {date(s.start)} – {date(s.end)} · Renews {date(s.renewal)}</span></div>
        <SubscriptionUsage subscription={s} persona={persona} />
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Button variant="link" size="sm" asChild className="h-auto whitespace-normal p-0 text-xs"><Link to="/instances" search={{ subscription: s.id }}>See which instances used this subscription ({persona.instances.filter((i) => i.subscriptionId === s.id).length}) <ArrowRight /></Link></Button>
          <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs"><Link to="/subscriptions" search={{ subscription: s.id }}>Subscription & licenses <ArrowRight /></Link></Button>
        </div>
      </section>)}</div>
    </>}
  </>;
}
