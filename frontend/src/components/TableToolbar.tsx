import { Search, Download } from "lucide-react";
import { ReactNode } from "react";

export default function TableToolbar({
  search,
  onSearch,
  placeholder = "Search...",
  filters,
  onDownload,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  filters?: ReactNode;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px] max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13.5px] text-charcoal-900 placeholder-slate-400 focus:border-accent-500 focus:outline-none"
        />
      </div>
      {filters}
      <button
        onClick={onDownload}
        className="ml-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-charcoal-900 transition-colors hover:bg-slate-50"
      >
        <Download size={14} />
        Export CSV
      </button>
    </div>
  );
}
