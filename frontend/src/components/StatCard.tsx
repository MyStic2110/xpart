import { LucideIcon, Info } from "lucide-react";
import Skeleton from "./Skeleton";

export default function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  info,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  loading?: boolean;
  info?: string;
}) {
  return (
    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400">
          {label}
          {info && (
            <span className="group relative inline-flex">
              <Info size={13} className="text-slate-300 hover:text-slate-500 cursor-help" />
              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 hidden w-52 -translate-x-1/2 rounded-lg bg-charcoal-900 px-3 py-2 text-[11px] font-normal leading-snug text-white shadow-elevated group-hover:block">
                {info}
              </span>
            </span>
          )}
        </span>
        <Icon size={16} strokeWidth={1.75} className="text-slate-300" />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <p className="mt-3 text-2xl font-semibold text-charcoal-900 tracking-tight">{value}</p>
      )}
    </div>
  );
}
