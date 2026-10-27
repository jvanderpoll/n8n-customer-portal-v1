import { useState } from "react";
import { Clipboard, Download } from "lucide-react";
import { ActionMenu, ActionMenuItem } from "@/components/action-menu";
import { Button } from "@/components/ui/button";

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: string[][]) {
  return `${[headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n")}\n`;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyCsv(headers: string[], rows: string[][]) {
  const text = toCsv(headers, rows);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

/** Shared download menu: copy the current rows, or download them as CSV. */
export function CsvExport({
  filename,
  headers,
  rows,
  label = "Download data",
}: {
  filename: string;
  headers: string[];
  rows: string[][];
  label?: string;
}) {
  const disabled = !rows.length;
  const [open, setOpen] = useState(false);
  return (
    <ActionMenu
      label={label}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={label}>
          <Download size={16} />
        </Button>
      }
    >
      <ActionMenuItem
        label="Copy to clipboard"
        icon={<Clipboard size={16} />}
        disabled={disabled}
        onClick={() => {
          void copyCsv(headers, rows);
          setOpen(false);
        }}
      />
      <ActionMenuItem
        label="Download as CSV"
        icon={<Download size={16} />}
        disabled={disabled}
        onClick={() => {
          downloadCsv(filename, headers, rows);
          setOpen(false);
        }}
      />
    </ActionMenu>
  );
}
