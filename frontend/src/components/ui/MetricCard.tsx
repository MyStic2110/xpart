import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

export interface MetricCardProps {
  title?: string;
  label?: string;
  value: string | number;
  delta?: {
    value: string | number;
    trend: "up" | "down" | "neutral";
    label?: string;
  };
  icon: LucideIcon;
  subtext?: string;
  info?: string;
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  label,
  value,
  delta,
  icon: Icon,
  subtext,
  info,
  loading = false,
  className,
}: MetricCardProps) {
  const cardTitle = title ?? label ?? "";
  const cardSubtext = subtext ?? info;
  if (loading) {
    return (
      <div className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm animate-pulse", className)}>
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 bg-slate-200 rounded" />
          <div className="h-8 w-8 bg-slate-200 rounded-lg" />
        </div>
        <div className="mt-3.5 h-7 w-32 bg-slate-200 rounded" />
        <div className="mt-2.5 h-3 w-20 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-slate-200/75 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cardTitle}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 text-slate-700 transition-colors group-hover:bg-slate-100 group-hover:text-charcoal-900">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              delta.trend === "up" && "bg-emerald-50 text-emerald-700 border border-emerald-100",
              delta.trend === "down" && "bg-rose-50 text-rose-700 border border-rose-100",
              delta.trend === "neutral" && "bg-slate-100 text-slate-600 border border-slate-200"
            )}
          >
            {delta.trend === "up" && <TrendingUp className="h-3 w-3" />}
            {delta.trend === "down" && <TrendingDown className="h-3 w-3" />}
            {delta.trend === "neutral" && <Minus className="h-3 w-3" />}
            {delta.value}
          </span>
        )}
      </div>

      {(cardSubtext || delta?.label) && (
        <p className="mt-1.5 text-xs text-slate-400">
          {delta?.label ? `${delta.label}` : cardSubtext}
        </p>
      )}
    </div>
  );
}

export default MetricCard;
