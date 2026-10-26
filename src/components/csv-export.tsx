import { Button } from "@/components/ui/button";

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const body = [headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([`${body}\n`], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shared outline CSV control for every portal data table. */
export function CsvExport({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!rows.length}
      onClick={() => downloadCsv(filename, headers, rows)}
    >
      CSV
    </Button>
  );
}
