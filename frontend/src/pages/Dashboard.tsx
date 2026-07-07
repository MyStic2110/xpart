import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ClipboardList,
  Receipt,
  Users,
  Target,
  Wallet,
  CalendarCheck,
  Building2,
  UserCog,
  TrendingUp,
  TrendingDown,
  Minus,
  UserPlus,
  ArrowRight,
  Truck,
} from "lucide-react";
import { api, MeResponse, DashboardMetrics, ForecastResponse } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import ForecastChart from "../components/ForecastChart";

type Granularity = "day" | "week" | "month";
const GRAN_LABELS: Record<Granularity, string> = { day: "Days", week: "Weeks", month: "Months" };
const HORIZON_NOUN: Record<Granularity, string> = { day: "12 days", week: "12 weeks", month: "12 months" };

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Compact ₹ for chart axes/tooltips: ₹1.2L, ₹45K, ₹900.
function rupeesShort(paise: number) {
  const r = paise / 100;
  if (r >= 10000000) return `₹${(r / 10000000).toFixed(1)}Cr`;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${Math.round(r / 1000)}K`;
  return `₹${Math.round(r)}`;
}

function formatDate(dateStr: string) {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = parseInt(parts[2], 10);
  const month = months[parseInt(parts[1], 10) - 1];
  return `${day} ${month}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [now] = useState(new Date());
  const { branchParam, branchName } = useBranch();

  useEffect(() => {
    api.me().then(setMe).catch((err) => {
      setError(err.message);
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    setMetrics(null);
    api.dashboardMetrics(branchParam).then(setMetrics).catch(() => {});
  }, [branchParam]);

  useEffect(() => {
    setForecast(null);
    api.dashboardForecast(granularity, branchParam).then(setForecast).catch(() => {});
  }, [branchParam, granularity]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  if (error) return <p className="p-8 text-red-500 text-sm">{error}</p>;

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const loading = !metrics;

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={me?.org.name ?? "Workspace"} onLogout={logout} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10 animate-fadeIn">
          {!me ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : (
            <div className="animate-slideUp">
              <p className="text-sm text-slate-400">{dateStr}</p>
              <h1 className="mt-1 text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">
                {greeting}, {me.user.name.split(" ")[0]}
              </h1>
              <p className="mt-2 text-[15px] text-slate-400">
                Here's where things stand at <span className="font-medium text-charcoal-700">{branchName}</span> today.
              </p>
            </div>
          )}

          {/* Sales opportunity — the money you can act on right now */}
          <div className="mt-10 rounded-xl2 border border-accent-500/20 bg-accent-500/5 p-6 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-accent-700">
                  <Target size={16} />
                  <h3 className="text-[14px] font-semibold">Today's revenue opportunity</h3>
                </div>
                {loading ? (
                  <Skeleton className="mt-3 h-9 w-40" />
                ) : (
                  <p className="mt-2 text-[2rem] font-semibold text-charcoal-900 tracking-tight">
                    {rupees(metrics.potentialToday)}
                  </p>
                )}
                <p className="mt-1 text-[13px] text-slate-500">
                  {loading ? "" : `${metrics.openFollowUps} open follow-ups · ${rupees(metrics.potentialOpen)} total potential`}
                </p>
              </div>
              <Link
                to="/client-360"
                className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-charcoal-800"
              >
                Work the queue
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Sales & Cash Inflow */}
          <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Sales & Inflow</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Sales today" value={rupees(metrics?.revenueToday ?? 0)} icon={Wallet} loading={loading} />
            <StatCard label="Sales this week" value={rupees(metrics?.revenueWeek ?? 0)} icon={Wallet} loading={loading} />
            <StatCard label="Sales this month" value={rupees(metrics?.revenueMonth ?? 0)} icon={TrendingUp} loading={loading} />
            <StatCard
              label="Xpart Profit Margin"
              value={rupees(metrics?.partsMarginMonth ?? 0)}
              icon={TrendingUp}
              loading={loading}
              info={metrics ? `Today: ${rupees(metrics.partsMarginToday)} · Week: ${rupees(metrics.partsMarginWeek)}` : undefined}
            />
            <StatCard
              label="Pending invoices"
              value={metrics?.pendingInvoices ?? 0}
              icon={Receipt}
              loading={loading}
              info={metrics ? `${rupees(metrics.pendingAmount)} awaiting collection` : undefined}
            />
          </div>

          {/* Client segmentation — visit-recency buckets over the customer base (vendors excluded) */}
          <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Clients segmentation</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(
              [
                {
                  label: "Existing clients",
                  value: metrics?.segmentation?.existing ?? 0,
                  desc: "Clients who are existing in the software.",
                  color: "text-charcoal-900",
                  bar: "bg-slate-300",
                  href: "/clients",
                },
                {
                  label: "Active",
                  value: metrics?.segmentation?.active ?? 0,
                  desc: "Clients who visit your outlet at regular intervals (last 60 days).",
                  color: "text-emerald-600",
                  bar: "bg-emerald-500",
                  href: "/clients?segment=active",
                },
                {
                  label: "Churn prediction",
                  value: metrics?.segmentation?.churnRisk ?? 0,
                  desc: "Clients who haven't visited in 60–180 days and are likely to leave.",
                  color: "text-amber-600",
                  bar: "bg-amber-500",
                  href: "/clients?segment=churn",
                },
                {
                  label: "Defected clients",
                  value: metrics?.segmentation?.defected ?? 0,
                  desc: "Clients inactive for over 180 days (or never visited).",
                  color: "text-rose-600",
                  bar: "bg-rose-500",
                  href: "/clients?segment=defected",
                },
              ] as const
            ).map((s) => {
              const total = metrics?.segmentation?.existing || 1;
              const pct = s.label === "Existing clients" ? 100 : Math.round((s.value / total) * 100);
              return (
                <div
                  key={s.label}
                  onClick={() => navigate(s.href)}
                  className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card cursor-pointer transition-colors hover:border-slate-200 hover:bg-slate-50/60"
                >
                  {loading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <>
                      <p className={`text-[26px] font-semibold tracking-tight ${s.color}`}>{s.value}</p>
                      <p className="mt-0.5 text-[13.5px] font-semibold text-charcoal-900">{s.label}</p>
                      <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-2 text-[11.5px] leading-snug text-slate-400">{s.desc}</p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent-600">
                        View list <ArrowRight size={11} />
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Third-party vendors — mechanics who bring vehicles in on a credit tab */}
          <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Third-party vendors</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="Vendor credit due"
              value={rupees(metrics?.thirdPartyOutstanding ?? 0)}
              icon={Receipt}
              loading={loading}
              info="Unsettled vehicle invoices across all third-party vendors — cash to collect."
            />
            <StatCard
              label="Collected from vendors (month)"
              value={rupees(metrics?.thirdPartyCollectedMonth ?? 0)}
              icon={Wallet}
              loading={loading}
            />
            <StatCard
              label="Third-party vendors"
              value={metrics?.thirdPartyClients ?? 0}
              icon={Truck}
              loading={loading}
              info="Vendors bringing in customer vehicles regularly."
            />
          </div>

          {/* Expenses & Outflow */}
          <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Expenses & Outflow</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Expenses today" value={rupees(metrics?.expenseToday ?? 0)} icon={TrendingDown} loading={loading} />
            <StatCard label="Expenses this week" value={rupees(metrics?.expenseWeek ?? 0)} icon={TrendingDown} loading={loading} />
            <StatCard label="Expenses this month" value={rupees(metrics?.expenseMonth ?? 0)} icon={TrendingDown} loading={loading} />
            <StatCard
              label="Net balance (Month)"
              value={metrics ? rupees((metrics.revenueMonth || 0) - (metrics.expenseMonth || 0)) : rupees(0)}
              icon={TrendingUp}
              loading={loading}
              info={metrics ? `${((metrics.revenueMonth || 0) - (metrics.expenseMonth || 0)) >= 0 ? "Surplus cash" : "Deficit cash"}` : undefined}
            />
          </div>

          {/* Operations Overview */}
          <h2 className="mt-10 text-[13px] font-semibold uppercase tracking-wide text-slate-400">Operations</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Job cards today" value={metrics?.jobCardsToday ?? 0} icon={ClipboardList} loading={loading} />
            <StatCard label="Upcoming appointments" value={metrics?.upcomingAppointments ?? 0} icon={CalendarCheck} loading={loading} />
            <StatCard label="Total clients" value={metrics?.totalClients ?? 0} icon={Users} loading={loading} />
            <StatCard label="Staff & mechanics" value={metrics?.staffCount ?? 0} icon={UserCog} loading={loading} />
          </div>

          {/* Visual Analytics Charts */}
          {!loading && metrics && (
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slideUp">
              {/* Revenue Trend Area Chart */}
              <div className="lg:col-span-2 rounded-xl2 border border-slate-100 bg-white p-6 shadow-card relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-[15px] font-semibold text-charcoal-900">Revenue Trend (14 Days)</h3>
                    <p className="text-[12px] text-slate-400">Daily collections trajectory</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-medium text-slate-400">Chart Total</p>
                    <p className="text-[14px] font-semibold text-charcoal-900">
                      {rupees(metrics.dailyRevenueTrend?.reduce((sum, d) => sum + d.revenue, 0) ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="relative h-48 w-full">
                  {(() => {
                    const chartData = metrics.dailyRevenueTrend || [];
                    const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 0) || 10000;
                    
                    const width = 500;
                    const height = 180;
                    const paddingLeft = 50;
                    const paddingRight = 10;
                    const paddingTop = 20;
                    const paddingBottom = 25;
                    
                    const chartWidth = width - paddingLeft - paddingRight;
                    const chartHeight = height - paddingTop - paddingBottom;
                    
                    const points = chartData.map((d, i) => {
                      const x = paddingLeft + (i / Math.max(chartData.length - 1, 1)) * chartWidth;
                      const y = height - paddingBottom - (d.revenue / maxRevenue) * chartHeight;
                      return { x, y, val: d.revenue, date: d.date };
                    });
                    
                    let linePath = "";
                    let areaPath = "";
                    if (points.length > 0) {
                      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
                      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
                    }

                    const yGridTicks = [0, 0.25, 0.5, 0.75, 1];

                    return (
                      <>
                        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines & Y-Axis Labels */}
                          {yGridTicks.map((tick, index) => {
                            const y = height - paddingBottom - tick * chartHeight;
                            const labelVal = tick * maxRevenue;
                            return (
                              <g key={index}>
                                <line
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={width - paddingRight}
                                  y2={y}
                                  stroke="#e2e8f0"
                                  strokeWidth="1"
                                  strokeDasharray="4 4"
                                />
                                <text
                                  x={paddingLeft - 8}
                                  y={y + 4}
                                  textAnchor="end"
                                  fontSize="10"
                                  fill="#94a3b8"
                                >
                                  {rupees(labelVal)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Area Fill under Line */}
                          {areaPath && (
                            <path d={areaPath} fill="url(#chartGradient)" />
                          )}

                          {/* Line Path */}
                          {linePath && (
                            <path
                              d={linePath}
                              fill="none"
                              stroke="#0ea5e9"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}

                          {/* X-Axis Labels */}
                          {points.map((p, index) => {
                            if (index % 2 !== 0 && index !== points.length - 1) return null; // Show clean sparse labels
                            return (
                              <text
                                key={index}
                                x={p.x}
                                y={height - 6}
                                textAnchor="middle"
                                fontSize="9"
                                fill="#94a3b8"
                              >
                                {formatDate(p.date)}
                              </text>
                            );
                          })}

                          {/* Data points */}
                          {points.map((p, index) => (
                            <circle
                              key={index}
                              cx={p.x}
                              cy={p.y}
                              r={hoveredIndex === index ? 5.5 : 3.5}
                              fill={hoveredIndex === index ? "#0ea5e9" : "#ffffff"}
                              stroke="#0ea5e9"
                              strokeWidth="2"
                              className="transition-all duration-150"
                            />
                          ))}

                          {/* Vertical hover marker line */}
                          {hoveredIndex !== null && points[hoveredIndex] && (
                            <line
                              x1={points[hoveredIndex].x}
                              y1={paddingTop}
                              x2={points[hoveredIndex].x}
                              y2={height - paddingBottom}
                              stroke="#0ea5e9"
                              strokeWidth="1.5"
                              strokeDasharray="2 2"
                            />
                          )}

                          {/* Invisible Interactive Columns for hover */}
                          {points.map((p, idx) => {
                            const colWidth = chartWidth / Math.max(chartData.length - 1, 1);
                            const triggerX = p.x - colWidth / 2;
                            return (
                              <rect
                                key={idx}
                                x={idx === 0 ? paddingLeft : triggerX}
                                y={0}
                                width={idx === 0 || idx === chartData.length - 1 ? colWidth / 2 : colWidth}
                                height={height}
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredIndex(idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                              />
                            );
                          })}
                        </svg>

                        {/* Interactive Tooltip Overlay */}
                        {hoveredIndex !== null && points[hoveredIndex] && (
                          <div
                            className="absolute bg-charcoal-900 text-white rounded-lg p-2.5 text-[12px] shadow-lg pointer-events-none z-10 transition-all duration-150 ease-out"
                            style={{
                              left: `${(points[hoveredIndex].x / width) * 100}%`,
                              top: `${(points[hoveredIndex].y / height) * 100 - 32}%`,
                              transform: "translate(-50%, -100%)",
                            }}
                          >
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-charcoal-900" />
                            <p className="font-semibold text-slate-300">{formatDate(points[hoveredIndex].date)}</p>
                            <p className="mt-0.5 font-bold text-sky-400">{rupees(points[hoveredIndex].val)}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Side Column: Top Services & Status Breakdown */}
              <div className="space-y-6">
                {/* Top Services */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                  <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Top Services</h3>
                  {metrics.topServices && metrics.topServices.length > 0 ? (
                    <div className="space-y-3.5">
                      {metrics.topServices.map((svc, i) => {
                        const maxVal = Math.max(...metrics.topServices.map((s) => s.count), 1);
                        const percent = (svc.count / maxVal) * 100;
                        return (
                          <div key={svc.name}>
                            <div className="flex items-center justify-between text-[13px] mb-1">
                              <span className="font-medium text-charcoal-800 truncate pr-2" title={svc.name}>{svc.name}</span>
                              <span className="font-semibold text-charcoal-600">{svc.count} jobs</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400">No service volume data.</p>
                  )}
                </div>

                {/* Job Card Status Breakdown */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                  <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Job Status Breakdown</h3>
                  {metrics.statusDistribution && metrics.statusDistribution.length > 0 ? (
                    <div className="space-y-3">
                      {metrics.statusDistribution.map((item) => {
                        const totalJobs = metrics.statusDistribution.reduce((sum, d) => sum + d.count, 0) || 1;
                        const pct = Math.round((item.count / totalJobs) * 100);
                        const colors: Record<string, string> = {
                          draft: "bg-amber-500",
                          in_progress: "bg-blue-500",
                          completed: "bg-emerald-500",
                          billed: "bg-charcoal-900",
                          cancelled: "bg-rose-500",
                        };
                        const displayNames: Record<string, string> = {
                          draft: "Draft",
                          in_progress: "In Progress",
                          completed: "Completed",
                          billed: "Billed",
                          cancelled: "Cancelled",
                        };
                        return (
                          <div key={item.status} className="flex items-center justify-between text-[13px]">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${colors[item.status] || "bg-slate-400"}`} />
                              <span className="font-medium text-slate-600">{displayNames[item.status] || item.status}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-charcoal-800">{item.count}</span>
                              <span className="text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400">No status distribution data.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Forecast — simple least-squares trend projection over the next 12 periods */}
          <div className="mt-10 animate-slideUp">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Forecast</h2>
                <p className="mt-1 text-[13px] text-slate-400">
                  Projected revenue & new customers for the next {HORIZON_NOUN[granularity]} — linear trend on your own history.
                </p>
              </div>
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(["day", "week", "month"] as Granularity[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      granularity === g ? "bg-white text-charcoal-900 shadow-card" : "text-slate-500 hover:text-charcoal-900"
                    }`}
                  >
                    {GRAN_LABELS[g]}
                  </button>
                ))}
              </div>
            </div>

            {!forecast ? (
              <div className="mt-4 grid grid-cols-1 gap-6">
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-56 w-full" />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-6">
                {/* Revenue forecast */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-center">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-[15px] font-semibold text-charcoal-900">Revenue forecast</h3>
                      <p className="text-[12px] text-slate-400">Next {HORIZON_NOUN[granularity]} expected collections</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected Total</span>
                      <p className="text-[20px] font-bold text-charcoal-900 mt-1">{rupees(forecast.revenue.forecastTotal)}</p>
                      <div className="mt-2">
                        <TrendPill trend={forecast.revenue.trend} pct={forecast.revenue.growthPct} />
                      </div>
                    </div>
                  </div>
                  <div className="h-52 relative w-full">
                    <ForecastChart history={forecast.revenue.history} forecast={forecast.revenue.forecast} format={rupeesShort} color="#0ea5e9" />
                  </div>
                </div>

                {/* Expense forecast */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-center">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-[15px] font-semibold text-charcoal-900">Expense forecast</h3>
                      <p className="text-[12px] text-slate-400">Next {HORIZON_NOUN[granularity]} expected expenditures</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected Spend</span>
                      <p className="text-[20px] font-bold text-charcoal-900 mt-1">{rupees(forecast.expenses.forecastTotal)}</p>
                      <div className="mt-2">
                        <TrendPill trend={forecast.expenses.trend === "up" ? "down" : forecast.expenses.trend === "down" ? "up" : "flat"} pct={forecast.expenses.growthPct} />
                      </div>
                    </div>
                  </div>
                  <div className="h-52 relative w-full">
                    <ForecastChart history={forecast.expenses.history} forecast={forecast.expenses.forecast} format={rupeesShort} color="#f43f5e" />
                  </div>
                </div>

                {/* New customer acquisition forecast */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-center">
                  <div className="space-y-4">
                    <div>
                      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-charcoal-900">
                        <UserPlus size={15} className="text-violet-500" /> New customers forecast
                      </h3>
                      <p className="text-[12px] text-slate-400">First-time customers, next {HORIZON_NOUN[granularity]}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected Total</span>
                      <p className="text-[20px] font-bold text-charcoal-900 mt-1">{forecast.acquisitions.forecastTotal} clients</p>
                      <div className="mt-2">
                        <TrendPill trend={forecast.acquisitions.trend} pct={forecast.acquisitions.growthPct} />
                      </div>
                    </div>
                  </div>
                  <div className="h-52 relative w-full">
                    <ForecastChart
                      history={forecast.acquisitions.history}
                      forecast={forecast.acquisitions.forecast}
                      format={(n) => `${Math.round(n)}`}
                      color="#8b5cf6"
                    />
                  </div>
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-400">
              Projection uses an ordinary least-squares trend on historical periods; the shaded band reflects typical variance.
              Not a guarantee — a planning estimate from past data only.
            </p>
          </div>

          {/* Branches */}
          {me && (
            <div className="mt-10 rounded-xl2 border border-slate-100 bg-white p-6 shadow-card animate-slideUp">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-slate-400" />
                  <h3 className="text-[15px] font-semibold text-charcoal-900">Branches</h3>
                </div>
                <span className="text-xs font-medium text-slate-400">{me.roles.join(", ")}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {me.branches.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">No branches yet.</p>
                ) : (
                  me.branches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-[14px] font-medium text-charcoal-900">{b.name}</p>
                        <p className="text-[13px] text-slate-400">{b.city}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TrendPill({ trend, pct }: { trend: "up" | "down" | "flat"; pct: number }) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const cls =
    trend === "up" ? "text-emerald-600 bg-emerald-50" : trend === "down" ? "text-rose-600 bg-rose-50" : "text-slate-500 bg-slate-100";
  const sign = pct > 0 ? "+" : "";
  return (
    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <Icon size={12} /> {sign}{pct}% vs recent avg
    </span>
  );
}
