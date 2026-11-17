import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { Route as rootRoute } from "@/routes/__root";
import { personasNew } from "@/lib/portal-data";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

const fieldstone = personasNew.find((persona) => persona.id === "full")!;
const enterpriseInstanceCount = fieldstone.instances.filter((instance) => instance.subscriptionId === "s1" && !instance.archived).length;

const documentShell = rootRoute.options.shellComponent;

beforeAll(() => {
  // The document shell renders <html>, which React will not mount inside the test container.
  rootRoute.options.shellComponent = undefined;
});

afterAll(() => {
  rootRoute.options.shellComponent = documentShell;
});

function renderPortal(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  });
  return render(<RouterProvider router={router} />);
}

function navLabels() {
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  return within(nav).getAllByRole("link").map((link) => link.textContent);
}

function openPrototypeSettings() {
  fireEvent.click(screen.getByRole("button", { name: /Prototype settings/ }));
}

function choosePrototype(name: "Old" | "New" | "Single" | "Multiple") {
  fireEvent.click(screen.getByRole("radio", { name }));
}

afterEach(() => {
  cleanup();
});

describe("New mode subscription scope", () => {
  it("Multiple lands on the subscriptions list without account totals and with Back to Subscriptions", async () => {
    renderPortal();
    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
    expect(navLabels()).toEqual(["Subscriptions", "Instances", "Users"]);
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Subscriptions" })).toHaveAttribute("aria-current", "page");

    expect(screen.queryByLabelText("Account totals")).not.toBeInTheDocument();
    expect(screen.queryByText("Total executions")).not.toBeInTheDocument();
    expect(screen.queryByText("592,819")).not.toBeInTheDocument();
    expect(screen.queryByText("Apr 2026 – Oct 2026")).not.toBeInTheDocument();
    expect(screen.queryByText("Active subscriptions")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Monthly executions/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Subscriptions" })).not.toBeInTheDocument();
    expect(screen.queryByText(/over quota/i)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active (2)" })).toBeInTheDocument();
    const enterprise = screen.getByRole("region", { name: "Enterprise" });
    expect(within(enterprise).queryByText("Running")).not.toBeInTheDocument();
    expect(within(enterprise).queryByText(/^Ends /)).not.toBeInTheDocument();
    expect(within(enterprise).queryByRole("link", { name: /View subscription/ })).not.toBeInTheDocument();
    expect(within(enterprise).queryByText(/reporting/i)).not.toBeInTheDocument();
    expect(within(enterprise).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Period",
      "Time left",
      "Annual amount",
      "Instances",
      "Executions",
    ]);
    const instanceTerm = within(enterprise).getAllByRole("term").find((term) => term.textContent === "Instances");
    expect(instanceTerm).toBeTruthy();
    expect(instanceTerm?.closest("a")).toBeNull();
    const enterpriseName = within(enterprise).getByRole("link", { name: "Enterprise" });
    const enterpriseCount = within(enterprise).getByRole("link", { name: String(enterpriseInstanceCount) });
    expect(enterpriseName).toHaveAttribute("href", "/subscriptions?subscription=s1");
    expect(enterpriseCount).toHaveAttribute("href", "/instances?subscription=s1");
    expect(enterpriseName.contains(enterpriseCount)).toBe(false);
    expect(enterprise.contains(enterpriseName)).toBe(true);
    enterpriseName.focus();
    expect(enterpriseName).toHaveFocus();
    expect(within(enterprise).getByText(/remaining$/)).not.toHaveTextContent(/^-/);
    const eu = screen.getByRole("region", { name: "Enterprise – EU expansion" });
    expect(within(eu).queryByText("Running")).not.toBeInTheDocument();
    expect(within(eu).queryByText(/^Ends /)).not.toBeInTheDocument();
    expect(within(eu).getByText(/remaining$/)).toHaveTextContent(/^-/);
    const euName = within(eu).getByRole("link", { name: "Enterprise – EU expansion" });
    const euCount = within(eu).getByRole("link", { name: /^\d+$/ });
    expect(euName).toHaveAttribute("href", "/subscriptions?subscription=s2");
    expect(euCount).toHaveAttribute("href", "/instances?subscription=s2");
    expect(euName.contains(euCount)).toBe(false);
    expect(screen.getByRole("link", { name: "Enterprise – EU expansion" })).toBeInTheDocument();

    openPrototypeSettings();
    expect(screen.getByRole("radio", { name: "Multiple" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Single" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("link", { name: String(enterpriseInstanceCount) }));
    expect(await screen.findByRole("heading", { name: /^Instances \(/ })).toBeInTheDocument();
    expect(screen.queryByText("LIC-NW-EU-01")).not.toBeInTheDocument();
    expect(screen.getAllByText("LIC-NW-PRD-01").length).toBeGreaterThan(0);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Subscriptions" }));
    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /^Enterprise$/ }));
    expect(await screen.findByRole("heading", { name: "Subscription: Enterprise" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Monthly executions for Enterprise/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Subscriptions" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Subscriptions" })).toHaveAttribute("href", "/subscriptions");
    fireEvent.click(screen.getByRole("link", { name: "Back to Subscriptions" }));
    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Account totals")).not.toBeInTheDocument();
    expect(screen.queryByText("592,819")).not.toBeInTheDocument();
    expect(screen.queryByText("Apr 2026 – Oct 2026")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Monthly executions/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enterprise – EU expansion" })).toBeInTheDocument();
  });

  it("opens the subscriptions list directly without account totals", async () => {
    renderPortal("/subscriptions");
    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(navLabels()).toEqual(["Subscriptions", "Instances", "Users"]);
    expect(screen.queryByLabelText("Account totals")).not.toBeInTheDocument();
    expect(screen.queryByText("Total executions")).not.toBeInTheDocument();
    expect(screen.queryByText("592,819")).not.toBeInTheDocument();
    expect(screen.queryByText("Apr 2026 – Oct 2026")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active (2)" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Monthly executions/ })).not.toBeInTheDocument();
  });

  it("Single opens the Enterprise detail, hides Overview and the back link, and omits EU instances", async () => {
    renderPortal();
    await screen.findByRole("heading", { name: "Subscriptions" });
    openPrototypeSettings();
    choosePrototype("Single");

    expect(await screen.findByRole("heading", { name: "Subscription: Enterprise" })).toBeInTheDocument();
    expect(navLabels()).toEqual(["Subscription", "Instances", "Users"]);
    expect(screen.queryByRole("link", { name: "Back to Subscriptions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Overview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
    expect(screen.queryByText("Total executions")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Account totals")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Monthly executions for Enterprise/ })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Instances" }));
    expect(await screen.findByRole("heading", { name: `Instances (${enterpriseInstanceCount})` })).toBeInTheDocument();
    expect(screen.queryByText("LIC-NW-EU-01")).not.toBeInTheDocument();
    expect(screen.queryByText("LIC-NW-EU-STG-01")).not.toBeInTheDocument();
    expect(screen.getAllByText("LIC-NW-PRD-01").length).toBeGreaterThan(0);
    expect(screen.queryByRole("option", { name: "Enterprise – EU expansion" })).not.toBeInTheDocument();

    choosePrototype("Multiple");
    expect(navLabels()).toEqual(["Subscriptions", "Instances", "Users"]);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Subscriptions" }));
    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /^Enterprise$/ }));
    expect(await screen.findByRole("heading", { name: "Subscription: Enterprise" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Subscriptions" })).toBeInTheDocument();

    choosePrototype("Single");
    expect(screen.queryByRole("link", { name: "Back to Subscriptions" })).not.toBeInTheDocument();
    expect(navLabels()).toEqual(["Subscription", "Instances", "Users"]);
    expect(screen.getByRole("heading", { name: "Subscription: Enterprise" })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Subscription" })).toHaveAttribute("href", "/subscriptions?subscription=s1");

    choosePrototype("Multiple");
    expect(screen.getByRole("heading", { name: "Subscription: Enterprise" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Subscriptions" })).toBeInTheDocument();
    expect(navLabels()).toEqual(["Subscriptions", "Instances", "Users"]);
  });

  it("Old mode keeps its Overview and ignores Single", async () => {
    renderPortal();
    await screen.findByRole("heading", { name: "Subscriptions" });
    openPrototypeSettings();
    choosePrototype("Single");
    await screen.findByRole("heading", { name: "Subscription: Enterprise" });

    choosePrototype("Old");
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(navLabels()).toEqual(["Overview", "Subscriptions", "Instances", "Users"]);
    expect(screen.getByText("Renewal date")).toBeInTheDocument();
    expect(screen.getByText("Executions this term")).toBeInTheDocument();
    expect(screen.getByText("LIC-NW-PRD-01")).toBeInTheDocument();
    expect(screen.queryByText("Active subscriptions")).not.toBeInTheDocument();
    expect(screen.queryByText("Total executions")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Single" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Multiple" })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("link", { name: "Subscriptions" }));
    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Active (1)" })).toBeInTheDocument();
    const oldEnterprise = screen.getByRole("region", { name: "Enterprise" });
    expect(within(oldEnterprise).queryByText("Running")).not.toBeInTheDocument();
    expect(within(oldEnterprise).queryByText(/^Renews /)).not.toBeInTheDocument();
    expect(screen.queryByText("Total executions")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Account totals")).not.toBeInTheDocument();

    choosePrototype("New");
    expect(await screen.findByRole("heading", { name: "Subscription: Enterprise" })).toBeInTheDocument();
    expect(navLabels()).toEqual(["Subscription", "Instances", "Users"]);
    expect(screen.queryByRole("link", { name: "Back to Subscriptions" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Single" })).toBeChecked();
  });
});
