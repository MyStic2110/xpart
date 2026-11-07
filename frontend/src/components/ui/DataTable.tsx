import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown, Download, Search, Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder?: string;
  onExportCsv?: () => void;
  onRowClick?: (row: TData) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  initialPageSize?: number;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search records...",
  onExportCsv,
  onRowClick,
  filters,
  actions,
  initialPageSize = 10,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination: { pageIndex: 0, pageSize } },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className={cn("w-full space-y-3.5", className)}>
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-9 pr-3 text-sm text-charcoal-900 placeholder-slate-400 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/10 transition-all shadow-sm"
            />
          </div>
          {filters}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs font-semibold text-charcoal-900 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Table Container with Overflow Protection */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm min-w-0">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-200 bg-slate-50/80 text-[11.5px] font-semibold uppercase tracking-wider text-slate-500">
                  {headerGroup.headers.map((header) => {
                    const isSorted = header.column.getIsSorted();
                    return (
                      <th key={header.id} className="px-5 py-3.5 select-none whitespace-nowrap">
                        {header.isPlaceholder ? null : (
                          <div
                            className={cn(
                              "flex items-center gap-1.5",
                              header.column.getCanSort() && "cursor-pointer hover:text-charcoal-900 transition-colors"
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              <span className="shrink-0">
                                {isSorted === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-accent-600" />
                                ) : isSorted === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5 text-accent-600" />
                                ) : (
                                  <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500" />
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={cn(
                      "transition-colors hover:bg-slate-50/80",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-3.5 whitespace-nowrap text-[13.5px] text-charcoal-900">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-14 text-center text-slate-400">
                    <Inbox className="mx-auto h-8 w-8 text-slate-300 stroke-[1.5]" />
                    <p className="mt-2.5 text-sm font-semibold text-charcoal-900">No records found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search terms or filter selection.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Compact Footer Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <p>
              Showing{" "}
              <span className="font-semibold text-charcoal-900">
                {table.getState().pagination.pageIndex * pageSize + (table.getRowModel().rows.length > 0 ? 1 : 0)}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-charcoal-900">
                {Math.min((table.getState().pagination.pageIndex + 1) * pageSize, data.length)}
              </span>{" "}
              of <span className="font-semibold text-charcoal-900">{data.length}</span> entries
            </p>
            <div className="flex items-center gap-1.5">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  table.setPageSize(newSize);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-charcoal-900 focus:outline-none"
              >
                {[10, 20, 50, 100].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-2">
              Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
            </span>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTable;

