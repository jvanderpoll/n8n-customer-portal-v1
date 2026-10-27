import { createFileRoute } from "@tanstack/react-router";
import { usePersona } from "@/components/portal-shell";
import { AllLicensesList, LastUpdate, WorkspaceTitle } from "@/components/portal-workspace";
import { RequestLicenses } from "@/components/portal-management";
import { portalHead } from "@/lib/portal-format";
import { runningFirst } from "@/lib/portal-views";

export const Route = createFileRoute("/licenses")({
  head: () => portalHead("Licenses", "Licenses across your purchases, grouped by subscription."),
  component: Licenses,
});

function Licenses() {
  const persona = usePersona();
  const { running } = runningFirst(persona);
  return (
    <>
      <WorkspaceTitle
        title="Licenses"
        trailing={<div className="page-actions"><LastUpdate persona={persona} />{running.length ? <RequestLicenses /> : null}</div>}
      />
      <AllLicensesList />
    </>
  );
}
