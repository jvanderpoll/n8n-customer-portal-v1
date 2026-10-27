import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Clipboard, Download, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CsvExport, downloadCsv, toCsv } from "@/components/csv-export";
import { cn } from "@/lib/utils";

export type DataColumn<T> = {
  id: string;
  header: string;
  numeric?: boolean;
  /** Value used for sorting and the default search corpus. */
  accessor: (row: T) => string | number | null | undefined;
  cell: (row: T) => ReactNode;
  /** CSV cell; defaults to String(accessor) with null/undefined → "". */
  csv?: (row: T) => string;
  /** Include this column's accessor in free-text search. Default true. */
  searchable?: boolean;
};

export type BulkActionContext<T> = {
  selectedRows: T[];
  clearSelection: () => void;
};

type SortState = { id: string; dir: "asc" | "desc" };

function defaultCsv<T>(column: DataColumn<T>, row: T) {
  if (column.csv) return column.csv(row);
  const value = column.accessor(row);
  return value == null ? "" : String(value);
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
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

function SelectionDownload({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!rows.length}
        onClick={() => void copyCsv(headers, rows)}
      >
        <Clipboard size={14} />
        Copy to clipboard
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!rows.length}
        onClick={() => downloadCsv(filename, headers, rows)}
      >
        <Download size={14} />
        Download as CSV
      </Button>
    </>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  searchPlaceholder = "Search…",
  search: controlledSearch,
  onSearchChange,
  filterContent,
  filtersActive = false,
  onClearFilters,
  csvFilename,
  empty = "No matching rows.",
  onRowClick,
  rowActions,
  initialSort,
  toolbarExtra,
  bulkActions,
  isRowSelectable,
  pageSize,
  page: controlledPage,
  onPageChange,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  filterContent?: ReactNode;
  filtersActive?: boolean;
  onClearFilters?: () => void;
  csvFilename: string;
  empty?: string;
  onRowClick?: (row: T) => void;
  rowActions?: ((row: T) => ReactNode) | undefined;
  initialSort?: SortState;
  toolbarExtra?: ReactNode;
  /** Custom bulk actions for the current selection. Defaults to copy/download of the selection. */
  bulkActions?: (ctx: BulkActionContext<T>) => ReactNode;
  /** When false, the row checkbox is disabled and excluded from select-all. Default true. */
  isRowSelectable?: (row: T) => boolean;
  /** When set, paginate filtered/sorted rows (bulk select applies to the current page). */
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [internalPage, setInternalPage] = useState(1);
  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let next = rows;
    if (q) {
      next = next.filter((row) =>
        columns.some((column) => {
          if (column.searchable === false) return false;
          const value = column.accessor(row);
          return value != null && String(value).toLowerCase().includes(q);
        }),
      );
    }
    if (sort) {
      const column = columns.find((c) => c.id === sort.id);
      if (column) {
        const dir = sort.dir === "asc" ? 1 : -1;
        next = [...next].sort((a, b) => dir * compareValues(column.accessor(a), column.accessor(b)));
      }
    }
    return next;
  }, [columns, rows, search, sort]);

  const pages = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const page = pageSize
    ? Math.min(pages, Math.max(1, controlledPage ?? internalPage))
    : 1;
  const setPage = (next: number) => {
    const clamped = Math.min(pages, Math.max(1, next));
    if (onPageChange) onPageChange(clamped);
    else setInternalPage(clamped);
  };

  const visible = pageSize
    ? filtered.slice((page - 1) * pageSize, page * pageSize)
    : filtered;

  const selectableKeys = useMemo(
    () =>
      visible
        .filter((row) => (isRowSelectable ? isRowSelectable(row) : true))
        .map((row) => rowKey(row)),
    [visible, isRowSelectable, rowKey],
  );

  // Keep selection to rows on the current view (search, filters, page).
  useEffect(() => {
    const allowed = new Set(visible.map((row) => rowKey(row)));
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const key of prev) {
        if (allowed.has(key)) next.add(key);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visible, rowKey]);

  const selectedRows = useMemo(
    () => visible.filter((row) => selected.has(rowKey(row))),
    [visible, selected, rowKey],
  );
  const selectedCount = selectedRows.length;
  const allSelectableSelected =
    selectableKeys.length > 0 && selectableKeys.every((key) => selected.has(key));
  const someSelectableSelected = selectableKeys.some((key) => selected.has(key));

  const clearSelection = () => setSelected(new Set());

  const toggleRow = (key: string, enabled: boolean) => {
    if (!enabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      if (allSelectableSelected) return new Set();
      return new Set(selectableKeys);
    });
  };

  const csvHeaders = columns.map((c) => c.header);
  const csvRows = visible.map((row) => columns.map((column) => defaultCsv(column, row)));
  const selectedCsvRows = selectedRows.map((row) => columns.map((column) => defaultCsv(column, row)));
  const colSpan = columns.length + 1 + (rowActions ? 1 : 0);

  const toggleSort = (id: string) => {
    setSort((prev) => {
      if (!prev || prev.id !== id) return { id, dir: "asc" };
      if (prev.dir === "asc") return { id, dir: "desc" };
      return null;
    });
  };

  const selectionBarActions = bulkActions
    ? bulkActions({ selectedRows, clearSelection })
    : (
        <SelectionDownload
          filename={csvFilename}
          headers={csvHeaders}
          rows={selectedCsvRows}
        />
      );

  return (
    <div className="data-table-block">
      <div className="table-toolbar data-table-toolbar">
        <label className="compact-search">
          <Search size={15} />
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn("filter-icon-button", filtersActive && "is-active")}
              aria-label="Filters"
            >
              <Filter size={16} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="filter-popover">
            {filterContent ? (
              <>
                <div className="filter-popover-fields">{filterContent}</div>
                {filtersActive && onClearFilters && (
                  <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={onClearFilters}>
                    <X size={14} />Clear filters
                  </Button>
                )}
              </>
            ) : (
              <p className="muted-text">No filters on this list.</p>
            )}
          </PopoverContent>
        </Popover>
        {toolbarExtra}
        <div className="toolbar-spacer" />
        <CsvExport filename={csvFilename} headers={csvHeaders} rows={csvRows} />
      </div>
      {selectedCount > 0 && (
        <div className="data-table-selection-bar" role="status" aria-live="polite">
          <span className="selection-count">{selectedCount} selected</span>
          <div className="selection-actions">{selectionBarActions}</div>
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="select-col">
                <label className="row-select">
                  <span className="sr-only">Select all rows on this page</span>
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    disabled={!selectableKeys.length}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelectableSelected && !allSelectableSelected;
                    }}
                    onChange={toggleAllVisible}
                  />
                </label>
              </th>
              {columns.map((column) => {
                const active = sort?.id === column.id;
                return (
                  <th
                    key={column.id}
                    className={column.numeric ? "numeric" : undefined}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      className={cn("sort-header", active && "is-active")}
                      onClick={() => toggleSort(column.id)}
                    >
                      {column.header}
                      <span className="sort-indicator" aria-hidden="true">
                        {active ? (sort!.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}
                      </span>
                    </button>
                  </th>
                );
              })}
              {rowActions && <th><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const key = rowKey(row);
              const selectable = isRowSelectable ? isRowSelectable(row) : true;
              const isSelected = selected.has(key);
              return (
                <tr
                  key={key}
                  className={cn(
                    onRowClick && "data-table-row-link",
                    isSelected && "selected-row",
                  )}
                  data-state={isSelected ? "selected" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  <td
                    className="select-col"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <label className="row-select">
                      <span className="sr-only">Select row</span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!selectable}
                        onChange={() => toggleRow(key, selectable)}
                      />
                    </label>
                  </td>
                  {columns.map((column) => (
                    <td key={column.id} className={column.numeric ? "numeric" : undefined}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="row-menu" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={colSpan} className="empty-table">{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pageSize && pages > 1 && (
        <div className="data-table-pagination">
          <span className="pagination-status">
            Page {page} of {pages}
          </span>
          <div className="pagination-controls">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              aria-label="Previous page"
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages}
              aria-label="Next page"
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
