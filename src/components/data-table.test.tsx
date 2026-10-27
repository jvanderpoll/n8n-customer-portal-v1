import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DataTable, type DataColumn } from "./data-table";

afterEach(() => {
  cleanup();
});

type Row = { id: string; name: string };

const columns: DataColumn<Row>[] = [
  { id: "name", header: "Name", accessor: (r) => r.name, cell: (r) => r.name },
];

const people: Row[] = [
  { id: "self", name: "You" },
  { id: "billing", name: "Tom Bakker" },
  { id: "ops", name: "Operations" },
];

const manyRows: Row[] = Array.from({ length: 45 }, (_, i) => ({
  id: `r${i + 1}`,
  name: `Row ${String(i + 1).padStart(2, "0")}`,
}));

describe("DataTable bulk selection", () => {
  it("shows how many rows are selected on the current view", () => {
    render(
      <DataTable
        columns={columns}
        rows={people}
        rowKey={(r) => r.id}
        csvFilename="people.csv"
        isRowSelectable={(r) => r.id !== "self"}
        bulkActions={() => <button type="button">Remove</button>}
      />,
    );

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    // header + 3 rows
    expect(checkboxes).toHaveLength(4);

    fireEvent.click(checkboxes[2]!); // Tom
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();

    fireEvent.click(checkboxes[3]!); // Operations
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it("disables the signed-in user checkbox and excludes them from select-all", () => {
    render(
      <DataTable
        columns={columns}
        rows={people}
        rowKey={(r) => r.id}
        csvFilename="people.csv"
        isRowSelectable={(r) => r.id !== "self"}
        bulkActions={() => <button type="button">Remove</button>}
      />,
    );

    const rows = screen.getAllByRole("row");
    const selfRow = rows.find((row) => within(row).queryByText("You"));
    expect(selfRow).toBeTruthy();
    const selfCheckbox = within(selfRow!).getByRole("checkbox");
    expect(selfCheckbox).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(selfCheckbox).not.toBeChecked();
  });

  it("paginates at 20 rows and limits select-all to the current page", () => {
    render(
      <DataTable
        columns={columns}
        rows={manyRows}
        rowKey={(r) => r.id}
        csvFilename="rows.csv"
        pageSize={20}
        bulkActions={({ selectedRows }) => (
          <span data-testid="bulk-count">{selectedRows.length}</span>
        )}
      />,
    );

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByText("Row 01")).toBeInTheDocument();
    expect(screen.queryByText("Row 21")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect(screen.getByText("20 selected")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-count")).toHaveTextContent("20");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Row 21")).toBeInTheDocument();
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect(screen.getByText("20 selected")).toBeInTheDocument();
  });

  it("offers copy and download for tables without custom bulk actions", () => {
    render(
      <DataTable columns={columns} rows={people} rowKey={(r) => r.id} csvFilename="people.csv" />,
    );
    fireEvent.click(screen.getAllByRole("checkbox")[1]!);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy to clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download as CSV/i })).toBeInTheDocument();
  });
});
