import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Wallet,
  Receipt,
  Users,
  Layers,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { ForecastResponse } from "../api";
import { cn } from "../lib/utils";

type Granularity = "day" | "week" | "month";
type ForecastView = "cashflow" | "revenue" | "expenses" | "customers";

interface Props {
  forecast: ForecastResponse | null;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  loading?: boolean;
}

const GRAN_LABELS: Record<Granularity, string> = {
  day: "Days (12-Day Outlook)",
  week: "Weeks (12-Week Outlook)",
  month: "Months (12-Month Outlook)",
};

const HORIZON_NOUN: Record<Granularity, string> = {
  day: "12 days",
  week: "12 weeks",
  month: "12 months",
};

function rupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function rupeesShort(paise: number) {
  const r = paise / 100;
  if (r >= 10000000) return `₹${(r / 10000000).toFixed(1)}Cr`;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${Math.round(r / 1000)}K`;
  return `₹${Math.round(r)}`;
}

// Smooth Catmull-Rom cubic bezier curve generator
function getCurvePath(points: { x: number; y: number }[], tension = 0.15): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function ExecutiveForecast({
  forecast,
  granularity,
  onGranularityChange,
  loading = false,
}: Props) {
  const [activeView, setActiveView] = useState<ForecastView>("cashflow");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (loading || !forecast) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm animate-pulse space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-8 w-60 bg-slate-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="h-72 w-full bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const { revenue, expenses, acquisitions } = forecast;

  // Executive KPI summary calculations
  const projectedRevenue = revenue.forecastTotal;
  const projectedExpenses = expenses.forecastTotal;
  const projectedProfit = projectedRevenue - projectedExpenses;
  const profitMargin =
    projectedRevenue > 0
      ? Math.round((projectedProfit / projectedRevenue) * 100)
      : 0;
  const isSurplus = projectedProfit >= 0;

  // Timeline length & nodes
  const histLen = revenue.history.length;
  const totalPeriods = histLen + revenue.forecast.length;
  const labels = [
    ...revenue.history.map((h) => h.label),
    ...revenue.forecast.map((f) => f.label),
  ];

  // Canvas bounds
  const width = 800;
  const height = 280;
  const pl = 65;
  const pr = 20;
  const pt = 24;
  const pb = 36;
  const cw = width - pl - pr;
  const ch = height - pt - pb;

  const xAt = (i: number) => pl + (i / Math.max(totalPeriods - 1, 1)) * cw;

  // Max value calculation based on active view
  let maxVal = 1;
  if (activeView === "cashflow" || activeView === "revenue" || activeView === "expenses") {
    maxVal =
      Math.max(
        ...revenue.history.map((h) => h.value),
        ...revenue.forecast.map((f) => f.upper),
        ...expenses.history.map((h) => h.value),
        ...expenses.forecast.map((f) => f.upper),
        100000
      ) * 1.15;
  } else {
    maxVal =
      Math.max(
        ...acquisitions.history.map((h) => h.value),
        ...acquisitions.forecast.map((f) => f.upper),
        10
      ) * 1.2;
  }

  const yAt = (v: number) => height - pb - (Math.max(v, 0) / maxVal) * ch;

  // Build points for Revenue, Expenses, Acquisitions
  const revHistPoints = revenue.history.map((p, i) => ({ x: xAt(i), y: yAt(p.value), val: p.value, label: p.label }));
  const revFcPoints = [
    ...(revHistPoints.length > 0 ? [revHistPoints[revHistPoints.length - 1]] : []),
    ...revenue.forecast.map((p, i) => ({
      x: xAt(histLen + i),
      y: yAt(p.value),
      val: p.value,
      lower: p.lower,
      upper: p.upper,
      label: p.label,
    })),
  ];

  const expHistPoints = expenses.history.map((p, i) => ({ x: xAt(i), y: yAt(p.value), val: p.value, label: p.label }));
  const expFcPoints = [
    ...(expHistPoints.length > 0 ? [expHistPoints[expHistPoints.length - 1]] : []),
    ...expenses.forecast.map((p, i) => ({
      x: xAt(histLen + i),
      y: yAt(p.value),
      val: p.value,
      lower: p.lower,
      upper: p.upper,
      label: p.label,
    })),
  ];

  const acqHistPoints = acquisitions.history.map((p, i) => ({ x: xAt(i), y: yAt(p.value), val: p.value, label: p.label }));
  const acqFcPoints = [
    ...(acqHistPoints.length > 0 ? [acqHistPoints[acqHistPoints.length - 1]] : []),
    ...acquisitions.forecast.map((p, i) => ({
      x: xAt(histLen + i),
      y: yAt(p.value),
      val: p.value,
      lower: p.lower,
      upper: p.upper,
      label: p.label,
    })),
  ];

  // SVG Paths
  const revHistPath = getCurvePath(revHistPoints);
  const revFcPath = getCurvePath(revFcPoints);
  const expHistPath = getCurvePath(expHistPoints);
  const expFcPath = getCurvePath(expFcPoints);
  const acqHistPath = getCurvePath(acqHistPoints);
  const acqFcPath = getCurvePath(acqFcPoints);

  // Revenue Area Fill Path
  const revAllPoints = [...revHistPoints, ...revFcPoints.slice(revHistPoints.length > 0 ? 1 : 0)];
  let revAreaPath = "";
  if (revAllPoints.length > 1) {
    revAreaPath = `${getCurvePath(revAllPoints)} L ${revAllPoints[revAllPoints.length - 1].x} ${height - pb} L ${revAllPoints[0].x} ${height - pb} Z`;
  }

  // Divider X
  const dividerX = histLen > 0 ? xAt(histLen - 1) : pl;

  // Selected hover point details
  const currentHover = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < totalPeriods ? hoverIndex : null;
  const isHoverProjected = currentHover !== null && currentHover >= histLen;
  const hoverRevVal =
    currentHover !== null
      ? currentHover < histLen
        ? revenue.history[currentHover]?.value ?? 0
        : revenue.forecast[currentHover - histLen]?.value ?? 0
      : 0;
  const hoverExpVal =
    currentHover !== null
      ? currentHover < histLen
        ? expenses.history[currentHover]?.value ?? 0
        : expenses.forecast[currentHover - histLen]?.value ?? 0
      : 0;
  const hoverNetProfit = hoverRevVal - hoverExpVal;
  const hoverNetMargin = hoverRevVal > 0 ? Math.round((hoverNetProfit / hoverRevVal) * 100) : 0;
  const hoverAcqVal =
    currentHover !== null
      ? currentHover < histLen
        ? acquisitions.history[currentHover]?.value ?? 0
        : acquisitions.forecast[currentHover - histLen]?.value ?? 0
      : 0;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card transition-all duration-200 hover:border-slate-300">
      {/* Header with Granularity Picker */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold tracking-tight text-charcoal-900">
              Executive Cashflow & Profit Trajectory
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Intelligent trend forecast for the next{" "}
            <span className="font-semibold text-charcoal-800">{HORIZON_NOUN[granularity]}</span> based on verified workshop history
          </p>
        </div>

        {/* Outlook Horizon Toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/50">
          {(["day", "week", "month"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => onGranularityChange(g)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                granularity === g
                  ? "bg-white text-charcoal-900 shadow-sm"
                  : "text-slate-500 hover:text-charcoal-900"
              )}
            >
              {g === "day" ? "12 Days" : g === "week" ? "12 Weeks" : "12 Months"}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Metric KPI Strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Projected Revenue */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
              Projected Revenue
            </span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-emerald-950">
            {rupees(projectedRevenue)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            {revenue.trend === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : revenue.trend === "down" ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            <span>
              {revenue.growthPct > 0 ? "+" : ""}
              {revenue.growthPct}% trajectory
            </span>
          </div>
        </div>

        {/* Projected Operating Expenses */}
        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">
              Projected Expenses
            </span>
            <Receipt className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-rose-950">
            {rupees(projectedExpenses)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
            {expenses.trend === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {expenses.growthPct > 0 ? "+" : ""}
              {expenses.growthPct}% vs average
            </span>
          </div>
        </div>

        {/* Net Bottom Line Cash Surplus / Deficit */}
        <div
          className={cn(
            "rounded-xl border p-4",
            isSurplus
              ? "border-emerald-200/90 bg-white ring-1 ring-emerald-500/10 shadow-sm"
              : "border-amber-200/90 bg-amber-50/40"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-700">
              Net Cashflow
            </span>
            {isSurplus ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <p
            className={cn(
              "mt-2 text-xl font-bold tracking-tight",
              isSurplus ? "text-emerald-700" : "text-amber-700"
            )}
          >
            {isSurplus ? "+" : ""}
            {rupees(projectedProfit)}
          </p>
          <span
            className={cn(
              "mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              isSurplus
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            )}
          >
            {isSurplus ? "Net Surplus Cash" : "Cash Deficit Alert"}
          </span>
        </div>

        {/* Projected Profit Margin */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Expected Margin
            </span>
            <span className="text-xs font-bold text-charcoal-700">{profitMargin}%</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-charcoal-900">
            {profitMargin}%
          </p>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                profitMargin >= 30
                  ? "bg-emerald-500"
                  : profitMargin >= 15
                  ? "bg-blue-500"
                  : "bg-amber-500"
              )}
              style={{ width: `${Math.min(Math.max(profitMargin, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Sub-view switcher tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200/50">
          <button
            onClick={() => setActiveView("cashflow")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              activeView === "cashflow"
                ? "bg-white text-charcoal-900 shadow-sm"
                : "text-slate-500 hover:text-charcoal-900"
            )}
          >
            <Layers className="h-3.5 w-3.5 text-emerald-600" />
            Cashflow Overview (Revenue vs Expense)
          </button>
          <button
            onClick={() => setActiveView("revenue")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              activeView === "revenue"
                ? "bg-white text-charcoal-900 shadow-sm"
                : "text-slate-500 hover:text-charcoal-900"
            )}
          >
            <Wallet className="h-3.5 w-3.5 text-sky-600" />
            Revenue Only
          </button>
          <button
            onClick={() => setActiveView("expenses")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              activeView === "expenses"
                ? "bg-white text-charcoal-900 shadow-sm"
                : "text-slate-500 hover:text-charcoal-900"
            )}
          >
            <Receipt className="h-3.5 w-3.5 text-rose-600" />
            Expenses Only
          </button>
          <button
            onClick={() => setActiveView("customers")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              activeView === "customers"
                ? "bg-white text-charcoal-900 shadow-sm"
                : "text-slate-500 hover:text-charcoal-900"
            )}
          >
            <Users className="h-3.5 w-3.5 text-violet-600" />
            Client Acquisition
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
          {activeView === "cashflow" && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Collections</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Outflow</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-slate-400" />
            <span>Projected</span>
          </div>
        </div>
      </div>

      {/* Main SVG Chart with Smooth Splines */}
      <div className="relative mt-4 h-72 w-full">
        <svg
          className="w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            {/* Revenue Gradient */}
            <linearGradient id="execRevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Expense Gradient */}
            <linearGradient id="execExpGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>

            {/* Acquisition Gradient */}
            <linearGradient id="execAcqGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y-axis scale */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
            const y = height - pb - tick * ch;
            const tickVal = tick * maxVal;
            return (
              <g key={i}>
                <line
                  x1={pl}
                  y1={y}
                  x2={width - pr}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={pl - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontFamily="sans-serif"
                >
                  {activeView === "customers"
                    ? Math.round(tickVal)
                    : rupeesShort(tickVal)}
                </text>
              </g>
            );
          })}

          {/* Forecast Future Zone Tint */}
          <rect
            x={dividerX}
            y={pt}
            width={width - pr - dividerX}
            height={ch}
            fill="#f8fafc"
            opacity={0.8}
          />

          {/* Dividing 'Now' line with glow */}
          <line
            x1={dividerX}
            y1={pt}
            x2={dividerX}
            y2={height - pb}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text
            x={dividerX + 6}
            y={pt + 12}
            fontSize="9"
            fontWeight="bold"
            fill="#64748b"
            letterSpacing="0.05em"
          >
            NOW (PROJECTED →)
          </text>

          {/* VIEW: Cashflow Overview (Revenue vs Expense together) */}
          {activeView === "cashflow" && (
            <>
              {/* Revenue Area Fill */}
              {revAreaPath && (
                <path d={revAreaPath} fill="url(#execRevGradient)" />
              )}

              {/* Historical Solid Lines */}
              {revHistPath && (
                <path
                  d={revHistPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}
              {expHistPath && (
                <path
                  d={expHistPath}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Projected Dashed Lines */}
              {revFcPath && (
                <path
                  d={revFcPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              )}
              {expFcPath && (
                <path
                  d={expFcPath}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              )}

              {/* Data points */}
              {revHistPoints.map((p, i) => (
                <circle
                  key={`rh-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={currentHover === i ? 5 : 2.5}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth="2"
                />
              ))}
              {revFcPoints.map((p, i) => (
                <circle
                  key={`rf-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={currentHover === histLen + i - (histLen > 0 ? 1 : 0) ? 5 : 2.5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              ))}
            </>
          )}

          {/* VIEW: Revenue Detail */}
          {activeView === "revenue" && (
            <>
              {revAreaPath && (
                <path d={revAreaPath} fill="url(#execRevGradient)" />
              )}
              {revHistPath && (
                <path
                  d={revHistPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}
              {revFcPath && (
                <path
                  d={revFcPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              )}
              {revAllPoints.map((p, i) => (
                <circle
                  key={`r-all-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={currentHover === i ? 5.5 : 3}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth="2.5"
                />
              ))}
            </>
          )}

          {/* VIEW: Expenses Detail */}
          {activeView === "expenses" && (
            <>
              {expHistPath && (
                <path
                  d={expHistPath}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}
              {expFcPath && (
                <path
                  d={expFcPath}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="3"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              )}
              {[...expHistPoints, ...expFcPoints.slice(expHistPoints.length > 0 ? 1 : 0)].map((p, i) => (
                <circle
                  key={`e-all-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={currentHover === i ? 5.5 : 3}
                  fill="#ffffff"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                />
              ))}
            </>
          )}

          {/* VIEW: Customer Acquisition */}
          {activeView === "customers" && (
            <>
              {acqHistPath && (
                <path
                  d={acqHistPath}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}
              {acqFcPath && (
                <path
                  d={acqFcPath}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              )}
              {[...acqHistPoints, ...acqFcPoints.slice(acqHistPoints.length > 0 ? 1 : 0)].map((p, i) => (
                <circle
                  key={`a-all-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={currentHover === i ? 5.5 : 3}
                  fill="#ffffff"
                  stroke="#8b5cf6"
                  strokeWidth="2.5"
                />
              ))}
            </>
          )}

          {/* X-axis labels (sparse for cleanliness) */}
          {labels.map((label, i) => {
            const show = i % 2 === 0 || i === totalPeriods - 1;
            if (!show) return null;
            return (
              <text
                key={`lbl-${i}`}
                x={xAt(i)}
                y={height - 10}
                textAnchor="middle"
                fontSize="9.5"
                fill="#64748b"
                fontWeight={i === histLen - 1 ? "bold" : "normal"}
              >
                {label}
              </text>
            );
          })}

          {/* Hover Crosshair */}
          {currentHover !== null && (
            <line
              x1={xAt(currentHover)}
              y1={pt}
              x2={xAt(currentHover)}
              y2={height - pb}
              stroke="#0f172a"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity={0.4}
            />
          )}

          {/* Interactive invisible hover hitboxes */}
          {Array.from({ length: totalPeriods }).map((_, i) => {
            const colW = cw / Math.max(totalPeriods - 1, 1);
            return (
              <rect
                key={`hit-${i}`}
                x={xAt(i) - colW / 2}
                y={0}
                width={colW}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            );
          })}
        </svg>

        {/* Floating Tooltip with Instant Profit Breakdown */}
        {currentHover !== null && (
          <div
            className="absolute z-30 rounded-xl border border-slate-700/60 bg-charcoal-900/95 px-3.5 py-2.5 text-xs text-white shadow-xl backdrop-blur-md pointer-events-none transition-all duration-150"
            style={{
              left: `${(xAt(currentHover) / width) * 100}%`,
              top: "16%",
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-1.5 mb-1.5">
              <span className="font-bold text-slate-200">
                {labels[currentHover]}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase",
                  isHoverProjected
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                    : "bg-slate-700 text-slate-300"
                )}
              >
                {isHoverProjected ? "Projected" : "Actual History"}
              </span>
            </div>

            {activeView === "cashflow" ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Collections:
                  </span>
                  <span className="font-bold text-emerald-400">{rupees(hoverRevVal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Expenditure:
                  </span>
                  <span className="font-bold text-rose-400">{rupees(hoverExpVal)}</span>
                </div>
                <div className="border-t border-slate-700/60 pt-1 flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-300">Net Profit:</span>
                  <span
                    className={cn(
                      "font-bold",
                      hoverNetProfit >= 0 ? "text-emerald-400" : "text-amber-400"
                    )}
                  >
                    {hoverNetProfit >= 0 ? "+" : ""}
                    {rupees(hoverNetProfit)} ({hoverNetMargin}%)
                  </span>
                </div>
              </div>
            ) : activeView === "revenue" ? (
              <div>
                <p className="text-slate-400">Collections:</p>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">{rupees(hoverRevVal)}</p>
              </div>
            ) : activeView === "expenses" ? (
              <div>
                <p className="text-slate-400">Operating Outflow:</p>
                <p className="text-sm font-bold text-rose-400 mt-0.5">{rupees(hoverExpVal)}</p>
              </div>
            ) : (
              <div>
                <p className="text-slate-400">New Client Intake:</p>
                <p className="text-sm font-bold text-violet-400 mt-0.5">{hoverAcqVal} clients</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Executive Callout */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold text-charcoal-900">Owner Insight:</span>
          <span>
            {isSurplus
              ? `You are projected to generate a net cash surplus of ${rupees(projectedProfit)} over the next ${HORIZON_NOUN[granularity]}.`
              : `Operating expenditures will exceed revenue by ${rupees(Math.abs(projectedProfit))} over the next ${HORIZON_NOUN[granularity]}. Consider tightening inventory purchases.`}
          </span>
        </div>
        <div className="text-[11px] font-medium text-slate-400">
          Updated in real-time from active job cards & vendor ledgers
        </div>
      </div>
    </div>
  );
}
