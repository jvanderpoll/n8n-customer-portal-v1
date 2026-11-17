import { cleanup, render, screen } from "@testing-library/react";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
import { afterEach, describe, expect, it, vi } from "vitest";
import { personas, personasNew } from "@/lib/portal-data";
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
