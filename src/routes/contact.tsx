import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";

/** Legacy /contact URL: Contact n8n lives in the sidebar dialog only. */
export const Route = createFileRoute("/contact")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: ContactRedirect,
});

function ContactRedirect() {
  return <Navigate to="/" replace />;
}
