import { cleanup, render, screen, within } from "@testing-library/react";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
import { afterEach, describe, expect, it, vi } from "vitest";
import { personas, personasNew } from "@/lib/portal-data";
import { fmt } from "@/lib/portal-format";
import { accountMonthlyExecutions } from "@/lib/portal-billing";
import { OverviewDashboard } from "./portal-workspace";

const state = vi.hoisted(() => ({
  mode: "new" as "new" | "old",
  source: "new" as "new" | "old",
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useNavigate: () => () => {},
}));

vi.mock("@/components/portal-shell", () => ({
  usePersona: () => {
    const list = state.source === "new" ? personasNew : personas;
    return list.find((persona) => persona.id === "full")!;
  },
  usePrototypeMode: () => state.mode,
  useManagement: () => ({ refreshUsage: () => {} }),
}));

afterEach(() => {
  cleanup();
  state.mode = "new";
  state.source = "new";
});

describe("New-mode Overview", () => {
  it("shows active subscriptions, instances, total executions, and the monthly chart", () => {
    const persona = personasNew.find((row) => row.id === "full")!;
    const chart = accountMonthlyExecutions(persona.subscriptions, persona.instances);
    render(<OverviewDashboard />);

    expect(screen.getByText("Active subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Instances")).toBeInTheDocument();
    expect(screen.getByText("Total executions")).toBeInTheDocument();
    expect(screen.getByText(String(persona.subscriptions.length))).toBeInTheDocument();
    expect(screen.getByText(String(persona.instances.filter((instance) => !instance.archived).length))).toBeInTheDocument();
    expect(screen.getByText(fmt(chart.totalExecutions))).toBeInTheDocument();
    expect(screen.getByText(chart.windowLabel)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Monthly executions/ })).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Monthly executions")).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Subscriptions" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Enterprise – EU expansion");
    expect(rows[0]).toHaveTextContent("over quota");
    expect(rows[0]).toHaveTextContent(/Ends /);
    expect(rows[1]).toHaveTextContent(/^Enterprise/);
    expect(rows[1]).toHaveTextContent(/Ends /);

    expect(screen.queryByText(/subscriptions ·/)).not.toBeInTheDocument();
    expect(screen.queryByText("Renewal date")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan end date")).not.toBeInTheDocument();
    expect(screen.queryByText("Executions this term")).not.toBeInTheDocument();
    expect(screen.queryByText("Annual quota")).not.toBeInTheDocument();
    expect(screen.queryByText(/LIC-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/not this term/)).not.toBeInTheDocument();
    expect(screen.queryByText(/billable/i)).not.toBeInTheDocument();
  });

  it("draws a single subscription line when the account has one subscription", () => {
    state.source = "old";
    render(<OverviewDashboard />);
    expect(screen.getByText("Total executions")).toBeInTheDocument();
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
    expect(screen.getAllByText("Enterprise").length).toBeGreaterThan(0);
    expect(screen.queryByText(/not this term/)).not.toBeInTheDocument();
  });
});

describe("Old-mode Overview", () => {
  it("keeps subscription, renewal date, then instances", () => {
    state.mode = "old";
    state.source = "old";
    render(<OverviewDashboard />);
    expect(screen.getByText("Subscription")).toBeInTheDocument();
    expect(screen.getByText("Renewal date")).toBeInTheDocument();
    expect(screen.getByText("Instances")).toBeInTheDocument();
    expect(screen.getByText("Executions this term")).toBeInTheDocument();
    expect(screen.getByText("LIC-NW-PRD-01")).toBeInTheDocument();
    expect(screen.queryByText("Active subscriptions")).not.toBeInTheDocument();
    expect(screen.queryByText("Total executions")).not.toBeInTheDocument();
    expect(screen.getByText(/not this term/)).toBeInTheDocument();
  });
});
