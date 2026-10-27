import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { personas } from "@/lib/portal-data";
import { createAccount, type Member } from "@/lib/portal-management";
import { InstanceActions, MemberActions } from "./portal-management";

const account = createAccount(personas[0]!);
const billing = account.members.find((m) => m.id === "billing")!;
const pending = account.members.find((m) => m.status === "Invited")!;
const instance = account.persona.instances.find((i) => !i.archived)!;

vi.mock("@/components/portal-shell", () => ({
  useManagement: () => ({
    account,
    role: "admin" as const,
    perform: () => null,
  }),
  usePersona: () => account.persona,
}));

afterEach(() => {
  cleanup();
});

describe("destructive management dialogs", () => {
  it("removes a person without typing Delete, using the display name in the body", async () => {
    render(<MemberActions member={billing} />);
    fireEvent.click(screen.getByRole("button", { name: `Manage access for ${billing.email}` }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Remove?" })).toBeInTheDocument();
    expect(
      within(dialog).getByText("Tom Bakker will no longer have access to this customer portal."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Type Delete to confirm")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("cancels an invitation without typing Delete", async () => {
    render(<MemberActions member={pending} />);
    fireEvent.click(
      screen.getByRole("button", { name: `Manage invitation for ${pending.email}` }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Cancel invitation" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Cancel invitation?" })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        `${pending.name} will no longer have a pending invitation.`,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Type Delete to confirm")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel invitation" })).toBeEnabled();
  });

  it("still requires typing Delete when removing an instance", async () => {
    render(<InstanceActions instance={instance} />);
    fireEvent.click(screen.getByRole("button", { name: `Manage ${instance.name}` }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove instance" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: `Remove ${instance.name}?` }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Type Delete to confirm")).toBeInTheDocument();
    const remove = within(dialog).getByRole("button", { name: "Remove instance" });
    expect(remove).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Type Delete to confirm"), {
      target: { value: "Delete" },
    });
    expect(remove).toBeEnabled();
  });

  it("falls back to email in remove copy when the display name is blank", () => {
    const nameless: Member = { ...billing, name: "   " };
    render(<MemberActions member={nameless} />);
    fireEvent.click(screen.getByRole("button", { name: `Manage access for ${nameless.email}` }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(
      screen.getByText(`${nameless.email} will no longer have access to this customer portal.`),
    ).toBeInTheDocument();
  });
});
