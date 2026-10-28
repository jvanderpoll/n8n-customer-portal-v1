import { createFileRoute } from "@tanstack/react-router";
import { usePersona } from "@/components/portal-shell";
import { AllLicensesList, LastUpdate, WorkspaceTitle } from "@/components/portal-workspace";
import { portalHead } from "@/lib/portal-format";

export const Route = createFileRoute("/licenses")({
  head: () => portalHead("Licenses", "Licenses across your purchases, grouped by subscription."),
  component: Licenses,
});

function Licenses() {
  const persona = usePersona();
  return (
    <>
      <WorkspaceTitle title="Licenses" trailing={<LastUpdate persona={persona} />} />
      <AllLicensesList />
    </>
  );
}
