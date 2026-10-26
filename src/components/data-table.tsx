import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CsvExport } from "@/components/csv-export";
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
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;

  const visible = useMemo(() => {
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

  const csvHeaders = columns.map((c) => c.header);
  const csvRows = visible.map((row) => columns.map((column) => defaultCsv(column, row)));
  const colSpan = columns.length + (rowActions ? 1 : 0);

  const toggleSort = (id: string) => {
    setSort((prev) => {
      if (!prev || prev.id !== id) return { id, dir: "asc" };
      if (prev.dir === "asc") return { id, dir: "desc" };
      return null;
    });
  };

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
              disabled={!filterContent}
            >
              <Filter size={16} />
            </Button>
          </PopoverTrigger>
          {filterContent && (
            <PopoverContent align="start" className="filter-popover">
              <div className="filter-popover-fields">{filterContent}</div>
              {filtersActive && onClearFilters && (
                <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={onClearFilters}>
                  <X size={14} />Clear filters
                </Button>
              )}
            </PopoverContent>
          )}
        </Popover>
        {toolbarExtra}
        <div className="toolbar-spacer" />
        <CsvExport filename={csvFilename} headers={csvHeaders} rows={csvRows} />
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
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
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? "data-table-row-link" : undefined}
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
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={colSpan} className="empty-table">{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
