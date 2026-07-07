import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CloudRain,
  PartyPopper,
  TrendingUp,
  CalendarDays,
  Sparkles,
  ClipboardList,
  CalendarCheck,
  Wallet,
  TrendingDown,
  Flame,
  Target,
  X,
} from "lucide-react";
import { api, CalendarResponse, CalendarDayDetail } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function rupeesShort(paise: number) {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(r >= 10000 ? 0 : 1)}K`;
  return `₹${Math.round(r)}`;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weatherEmoji(summary: string, rainProb: number): string {
  if (summary.includes("Thunder")) return "⛈️";
  if (summary.includes("Rain") || rainProb >= 60) return "🌧️";
  if (summary.includes("Drizzle") || summary.includes("showers")) return "🌦️";
  if (summary.includes("Fog")) return "🌫️";
  if (summary.includes("Cloud")) return "⛅";
  return "☀️";
}

const LEVEL_META: Record<string, { label: string; emoji: string; chip: string; cellBg: string; ring: string }> = {
  peak: { label: "Peak", emoji: "🔥", chip: "bg-gradient-to-r from-rose-500 to-orange-500 text-white", cellBg: "linear-gradient(135deg, rgba(244,63,94,0.16), rgba(249,115,22,0.14))", ring: "ring-2 ring-rose-400/70" },
  high: { label: "Busy", emoji: "📈", chip: "bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950", cellBg: "linear-gradient(135deg, rgba(245,158,11,0.16), rgba(250,204,21,0.12))", ring: "ring-2 ring-amber-300/80" },
  low: { label: "Slow", emoji: "🌧️", chip: "bg-slate-200 text-slate-600", cellBg: "linear-gradient(135deg, rgba(100,116,139,0.10), rgba(148,163,184,0.06))", ring: "ring-1 ring-slate-200" },
  normal: { label: "Steady", emoji: "⚖️", chip: "bg-sky-100 text-sky-700", cellBg: "#ffffff", ring: "" },
};

const INSIGHT_STYLE: Record<string, { bg: string; iconBg: string; icon: typeof Sparkles }> = {
  rush: { bg: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50", iconBg: "bg-gradient-to-br from-amber-400 to-orange-500", icon: PartyPopper },
  rain: { bg: "border-sky-200/80 bg-gradient-to-br from-sky-50 to-blue-50", iconBg: "bg-gradient-to-br from-sky-400 to-blue-500", icon: CloudRain },
  longweekend: { bg: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-fuchsia-50", iconBg: "bg-gradient-to-br from-violet-400 to-fuchsia-500", icon: CalendarDays },
  pattern: { bg: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50", iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500", icon: TrendingUp },
};

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const { branchParam, branchName } = useBranch();
  const [orgName, setOrgName] = useState("Workspace");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api.getCalendar(month, branchParam).then(setData).catch((err) => setError(err.message));
  }, [month, branchParam]);

  useEffect(() => {
    if (!selected) { setDayDetail(null); return; }
    setDayDetail(null);
    api.getCalendarDay(selected, branchParam).then(setDayDetail).catch(() => {});
  }, [selected, branchParam]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const byDate = useMemo(() => {
    const m = new Map<string, { day: CalendarResponse["days"][0]; demand?: CalendarResponse["demand"][0] }>();
    for (const d of data?.days ?? []) m.set(d.date, { day: d });
    for (const dm of data?.demand ?? []) { const e = m.get(dm.date); if (e) e.demand = dm; }
    return m;
  }, [data]);

  const holidayByDate = useMemo(() => new Map((data?.holidays ?? []).map((h) => [h.date, h])), [data]);
  const weatherByDate = useMemo(() => new Map((data?.weather ?? []).map((w) => [w.date, w])), [data]);
  const maxRevenue = useMemo(() => Math.max(...(data?.days ?? []).map((d) => d.revenue), 1), [data]);

  const cells = useMemo(() => {
    if (!data) return [];
    const first = new Date(data.days[0].date + "T00:00:00Z").getUTCDay();
    return [...Array(first).fill(null), ...data.days];
  }, [data]);

  // Next 7 days outlook (only when viewing the current month window).
  const next7 = useMemo(() => {
    if (!data) return [];
    return data.demand.filter((d) => d.date >= data.today).slice(0, 7);
  }, [data]);

  const [y, m] = month.split("-").map(Number);
  const selHoliday = selected ? holidayByDate.get(selected) : null;
  const selWeather = selected ? weatherByDate.get(selected) : null;
  const selDemand = selected ? byDate.get(selected)?.demand : null;
  const growthPct = data && data.summary.prevMonthRevenue > 0
    ? Math.round(((data.summary.projected - data.summary.prevMonthRevenue) / data.summary.prevMonthRevenue) * 100)
    : null;

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          {/* Hero: month money story */}
          <div className="animate-slideUp rounded-2xl bg-gradient-to-r from-charcoal-900 via-slate-800 to-sky-900 p-6 text-white shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[13px] font-medium text-sky-200">
                  <CalendarDays size={15} /> Planner · {branchName}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><ChevronLeft size={16} /></button>
                  <h1 className="min-w-[190px] text-center text-[1.5rem] font-semibold tracking-tight">{MONTH_NAMES[m - 1]} {y}</h1>
                  <button onClick={() => setMonth(shiftMonth(month, 1))} className="rounded-lg bg-white/10 p-1.5 hover:bg-white/20"><ChevronRight size={16} /></button>
                  <button
                    onClick={() => { setMonth(new Date().toISOString().slice(0, 7)); setSelected(new Date().toISOString().slice(0, 10)); }}
                    className="ml-2 rounded-lg bg-sky-500 px-3 py-1.5 text-[12px] font-semibold hover:bg-sky-400"
                  >
                    Today
                  </button>
                </div>
              </div>
              {!data ? (
                <Skeleton className="h-16 w-96 bg-white/10" />
              ) : (
                <div className="flex flex-wrap gap-6">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-sky-300">Collected (MTD)</p>
                    <p className="text-[22px] font-bold">{rupees(data.summary.monthToDate)}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-sky-300">Projected month</p>
                    <p className="text-[22px] font-bold text-emerald-300">{rupees(data.summary.projected)}</p>
                    {growthPct !== null && (
                      <p className={`text-[11px] font-semibold ${growthPct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {growthPct >= 0 ? "▲" : "▼"} {Math.abs(growthPct)}% vs last month ({rupeesShort(data.summary.prevMonthRevenue)})
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-sky-300">Next 7 days expected</p>
                    <p className="text-[22px] font-bold text-amber-300">{rupees(data.summary.next7Expected)}</p>
                    {data.summary.bestDay && (
                      <p className="text-[11px] text-sky-200">Best day so far: {rupeesShort(data.summary.bestDay.revenue)} ({Number(data.summary.bestDay.date.slice(8))} {MONTH_NAMES[m - 1].slice(0, 3)})</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          {/* Next 7 days outlook chips */}
          {data && next7.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Week ahead</p>
              <div className="grid grid-cols-7 gap-2">
                {next7.map((d) => {
                  const wx = weatherByDate.get(d.date);
                  const h = holidayByDate.get(d.date);
                  const lm = LEVEL_META[d.level];
                  const isToday = d.date === data.today;
                  return (
                    <button
                      key={d.date}
                      onClick={() => { setMonth(d.date.slice(0, 7)); setSelected(d.date); }}
                      className={`rounded-xl border p-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-card ${
                        isToday ? "border-charcoal-900 bg-charcoal-900 text-white" : "border-slate-100 bg-white"
                      }`}
                    >
                      <p className={`text-[10.5px] font-bold uppercase ${isToday ? "text-sky-300" : "text-slate-400"}`}>
                        {DOW_SHORT[new Date(d.date + "T00:00:00Z").getUTCDay()]} {Number(d.date.slice(8))}
                      </p>
                      <p className="mt-0.5 text-[16px] leading-none">{h ? "🎉" : wx ? weatherEmoji(wx.summary, wx.rainProbability) : lm.emoji}</p>
                      <p className={`mt-1 text-[11px] font-bold ${isToday ? "text-white" : d.level === "peak" ? "text-rose-600" : d.level === "high" ? "text-amber-600" : d.level === "low" ? "text-slate-400" : "text-sky-600"}`}>
                        {d.expectedRevenue != null ? rupeesShort(d.expectedRevenue) : "—"}
                      </p>
                      <span className={`mt-1 inline-block rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide ${isToday ? "bg-white/20 text-white" : lm.chip}`}>
                        {lm.emoji} {lm.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Planning insights strip */}
          {data && data.insights.length > 0 && (
            <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
              {data.insights.map((ins, i) => {
                const st = INSIGHT_STYLE[ins.type];
                const Icon = st.icon;
                return (
                  <div key={i} className={`min-w-[280px] max-w-[320px] shrink-0 rounded-xl2 border p-4 shadow-card transition-transform hover:-translate-y-0.5 ${st.bg}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${st.iconBg}`}>
                        <Icon size={15} />
                      </span>
                      <p className="text-[13px] font-semibold leading-tight text-charcoal-900">{ins.title}</p>
                    </div>
                    <p className="mt-2 text-[11.5px] leading-snug text-slate-600">{ins.detail}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
            {/* Calendar grid */}
            <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
              <div className="grid grid-cols-7 mb-2">
                {DOW_SHORT.map((d) => (
                  <p key={d} className={`text-center text-[11px] font-semibold uppercase tracking-wide ${d === "Sun" || d === "Sat" ? "text-accent-600" : "text-slate-400"}`}>{d}</p>
                ))}
              </div>
              {!data ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {cells.map((c, i) => {
                    if (!c) return <div key={`b${i}`} />;
                    const heat = c.revenue / maxRevenue;
                    const isPast = c.date < data.today;
                    const isToday = c.date === data.today;
                    const dm = byDate.get(c.date)?.demand;
                    const h = holidayByDate.get(c.date);
                    const wx = weatherByDate.get(c.date);
                    const isSel = selected === c.date;
                    const lm = dm ? LEVEL_META[dm.level] : LEVEL_META.normal;
                    const darkText = (isPast || isToday) && heat > 0.55;
                    return (
                      <div key={c.date} className="relative">
                        <button
                          onClick={() => setSelected(c.date)}
                          onMouseEnter={() => setHovered(c.date)}
                          onMouseLeave={() => setHovered(null)}
                          className={`relative flex h-[84px] w-full flex-col rounded-xl border p-1.5 text-left transition-all duration-150 hover:z-10 hover:scale-[1.06] hover:shadow-lg ${
                            isSel ? "border-charcoal-900 ring-2 ring-charcoal-900/30" : "border-slate-100"
                          } ${!isPast && !isToday && dm && dm.level !== "normal" ? lm.ring : ""}`}
                          style={{
                            background: isPast || isToday
                              ? heat > 0 ? `linear-gradient(160deg, rgba(14,165,233,${0.10 + heat * 0.55}), rgba(56,189,248,${0.05 + heat * 0.35}))` : "#fff"
                              : lm.cellBg,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[11.5px] font-bold ${isToday ? "rounded-full bg-charcoal-900 px-1.5 py-px text-white" : darkText ? "text-white" : "text-charcoal-800"}`}>
                              {Number(c.date.slice(8))}
                            </span>
                            <span className="flex items-center gap-0.5 text-[11px] leading-none">
                              {h && <span title={h.name}>🎉</span>}
                              {wx && wx.rainProbability >= 40 && <span title={`${wx.rainProbability}% rain`}>{weatherEmoji(wx.summary, wx.rainProbability)}</span>}
                            </span>
                          </div>

                          {h && (
                            <p className={`mt-0.5 truncate text-[8.5px] font-semibold leading-tight ${darkText ? "text-white/90" : "text-amber-600"}`}>
                              {h.name.split("/")[0].trim()}
                            </p>
                          )}

                          {(isPast || isToday) && c.revenue > 0 && (
                            <span className={`mt-auto text-[11px] font-bold ${darkText ? "text-white" : "text-charcoal-800"}`}>{rupeesShort(c.revenue)}</span>
                          )}
                          {!isPast && !isToday && dm?.expectedRevenue != null && (
                            <span className={`mt-auto text-[10px] font-bold ${dm.level === "peak" ? "text-rose-600" : dm.level === "high" ? "text-amber-600" : dm.level === "low" ? "text-slate-400" : "text-sky-600"}`}>
                              ~{rupeesShort(dm.expectedRevenue)}
                              <span className="ml-0.5">{lm.emoji}</span>
                            </span>
                          )}

                          {(c.jobCards > 0 || c.appointments > 0 || c.expenses > 0) && (
                            <span className="absolute bottom-1 right-1.5 flex items-center gap-0.5">
                              {c.jobCards > 0 && <span className={`h-1.5 w-1.5 rounded-full ${darkText ? "bg-white" : "bg-charcoal-800"}`} />}
                              {c.appointments > 0 && <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                              {c.expenses > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
                            </span>
                          )}
                        </button>

                        {/* Hover tooltip */}
                        {hovered === c.date && (
                          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-52 -translate-x-1/2 rounded-xl bg-charcoal-900 p-3 text-white shadow-xl">
                            <p className="text-[11.5px] font-bold">
                              {new Date(c.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                              {h ? ` · ${h.name.split("/")[0].trim()} 🎉` : ""}
                            </p>
                            {(isPast || isToday) ? (
                              <p className="mt-1 text-[11px] text-slate-300">
                                Collected <span className="font-bold text-sky-300">{rupees(c.revenue)}</span>
                                {c.expenses > 0 && <> · spent <span className="font-bold text-rose-300">{rupees(c.expenses)}</span></>}
                              </p>
                            ) : (
                              dm && (
                                <p className="mt-1 text-[11px] text-slate-300">
                                  {lm.emoji} {lm.label} expected{dm.expectedRevenue != null && <> · <span className="font-bold text-amber-300">~{rupees(dm.expectedRevenue)}</span></>}
                                </p>
                              )
                            )}
                            <p className="mt-0.5 text-[10.5px] text-slate-400">
                              {c.jobCards} job cards · {c.appointments} appts{c.enquiries > 0 ? ` · ${c.enquiries} enquiries` : ""}
                            </p>
                            {wx && <p className="mt-0.5 text-[10.5px] text-sky-300">{weatherEmoji(wx.summary, wx.rainProbability)} {wx.summary} · {wx.rainProbability}% rain · {wx.tempMax}°C</p>}
                            {dm && dm.drivers.length > 0 && <p className="mt-0.5 text-[10px] italic text-slate-400">{dm.drivers[0]}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-3 w-6 rounded bg-gradient-to-r from-sky-500/60 to-sky-300/40" /> revenue heat (past)</span>
                <span className="flex items-center gap-1">🔥 peak</span>
                <span className="flex items-center gap-1">📈 busy</span>
                <span className="flex items-center gap-1">🌧️ rain / slow</span>
                <span className="flex items-center gap-1">🎉 festival</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-charcoal-800" /> job cards</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> appointments</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> expenses</span>
                <span className="text-slate-300">· ~₹ on future days = expected collection</span>
              </div>

              {/* Weekday pattern */}
              {data && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Your weekday pattern <span className="normal-case font-normal">(learned from your last 180 days · avg day = {rupeesShort(data.avgDailyRevenue)})</span>
                  </p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {data.dowStats.map((s) => {
                      const maxIdx = Math.max(...data.dowStats.map((x) => x.index), 1);
                      const isBest = s.index === maxIdx && s.index > 1;
                      return (
                        <div key={s.dow} className="text-center">
                          {isBest && <p className="text-[9px] font-bold text-emerald-600">BEST 👑</p>}
                          <div className={`mx-auto flex h-16 w-6 items-end overflow-hidden rounded-md bg-slate-100 ${isBest ? "" : "mt-[13px]"}`}>
                            <div
                              className={`w-full rounded-t transition-all duration-500 ${
                                s.index >= 1.15 ? "bg-gradient-to-t from-emerald-500 to-teal-400" : s.index <= 0.85 ? "bg-slate-300" : "bg-gradient-to-t from-sky-500 to-sky-300"
                              }`}
                              style={{ height: `${(s.index / maxIdx) * 100}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] font-medium text-slate-500">{DOW_SHORT[s.dow]}</p>
                          <p className={`text-[9.5px] font-bold ${s.index >= 1.15 ? "text-emerald-600" : s.index <= 0.85 ? "text-slate-400" : "text-sky-600"}`}>
                            {s.index >= 1 ? "+" : ""}{Math.round((s.index - 1) * 100)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Day panel */}
            <div className="rounded-xl2 border border-slate-100 bg-white shadow-card h-fit xl:sticky xl:top-6 overflow-hidden">
              {!selected ? (
                <div className="p-5 py-16 text-center">
                  <CalendarDays size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-charcoal-900">Pick a day</p>
                  <p className="mt-1 text-[12px] text-slate-400">Click any date to see its activity and plan.</p>
                </div>
              ) : (
                <div className="animate-slideUp">
                  <div className={`p-4 text-white ${
                    selDemand?.level === "peak" ? "bg-gradient-to-r from-rose-500 to-orange-500" :
                    selDemand?.level === "high" ? "bg-gradient-to-r from-amber-500 to-yellow-500" :
                    selDemand?.level === "low" ? "bg-gradient-to-r from-slate-500 to-slate-600" :
                    "bg-gradient-to-r from-sky-500 to-blue-500"
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[16px] font-bold">
                          {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
                        </p>
                        {selHoliday && <p className="mt-0.5 text-[12px] font-medium text-white/90">🎉 {selHoliday.name}{selHoliday.longWeekend ? " · long weekend" : ""}</p>}
                        {selWeather && (
                          <p className="mt-0.5 text-[12px] text-white/90">
                            {weatherEmoji(selWeather.summary, selWeather.rainProbability)} {selWeather.summary} · {selWeather.rainProbability}% rain · {selWeather.tempMax}°C
                          </p>
                        )}
                      </div>
                      <button onClick={() => setSelected(null)} className="rounded-lg p-1 text-white/70 hover:bg-white/20 hover:text-white"><X size={15} /></button>
                    </div>
                    {selDemand && selected >= (data?.today ?? "") && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
                          {LEVEL_META[selDemand.level].emoji} {LEVEL_META[selDemand.level].label} · {selDemand.score}× avg
                        </span>
                        {selDemand.expectedRevenue != null && (
                          <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
                            <Target size={11} className="mr-1 inline" />~{rupees(selDemand.expectedRevenue)} expected
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    {selDemand && (selDemand.drivers.length > 0 || selDemand.tip) && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                        {selDemand.drivers.length > 0 && (
                          <ul className="space-y-0.5">
                            {selDemand.drivers.map((d, i) => (
                              <li key={i} className="text-[11.5px] text-slate-600">• {d}</li>
                            ))}
                          </ul>
                        )}
                        {selDemand.tip && (
                          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] font-medium text-charcoal-800">
                            <Sparkles size={13} className="mt-px shrink-0 text-accent-600" /> {selDemand.tip}
                          </p>
                        )}
                      </div>
                    )}

                    {!dayDetail ? (
                      <Skeleton className="mt-4 h-40 w-full" />
                    ) : (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-3">
                            <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-emerald-600"><Wallet size={11} /> Collected</p>
                            <p className="mt-0.5 text-[16px] font-bold text-emerald-700">{rupees(dayDetail.revenue)}</p>
                          </div>
                          <div className="rounded-xl bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-100 p-3">
                            <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-rose-500"><TrendingDown size={11} /> Spent</p>
                            <p className="mt-0.5 text-[16px] font-bold text-rose-600">{rupees(dayDetail.expenseTotal)}</p>
                          </div>
                        </div>
                        {dayDetail.payments.length > 0 && (
                          <p className="mt-2 text-[11px] text-slate-400">
                            {dayDetail.payments.map((p) => `${p.mode.toUpperCase()} ${rupees(p.amount)}`).join(" · ")}
                          </p>
                        )}

                        <div className="mt-4">
                          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-charcoal-900 mb-1.5">
                            <ClipboardList size={13} className="text-slate-400" /> Job cards ({dayDetail.jobCards.length})
                          </p>
                          {dayDetail.jobCards.length === 0 ? (
                            <p className="text-[11.5px] text-slate-400 italic">None recorded.</p>
                          ) : (
                            <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                              {dayDetail.jobCards.map((jc) => (
                                <div key={jc.id} onClick={() => navigate(`/job-cards/${jc.id}`)} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-[12px] hover:bg-slate-50">
                                  <span className="truncate pr-2">
                                    <span className="font-medium text-charcoal-900">{jc.plateNumber}</span>
                                    <span className="text-slate-400"> · {jc.clientName}</span>
                                  </span>
                                  <span className="shrink-0 font-medium text-charcoal-800">{rupees(jc.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-4">
                          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-charcoal-900 mb-1.5">
                            <CalendarCheck size={13} className="text-slate-400" /> Appointments ({dayDetail.appointments.length})
                          </p>
                          {dayDetail.appointments.length === 0 ? (
                            <p className="text-[11.5px] text-slate-400 italic">None scheduled.</p>
                          ) : (
                            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                              {dayDetail.appointments.map((a) => (
                                <div key={a.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px]">
                                  <span className="truncate pr-2">
                                    <span className="font-medium text-charcoal-900">{a.scheduledTime ?? "—"}</span>
                                    <span className="text-slate-400"> · {a.clientName}{a.serviceName ? ` · ${a.serviceName}` : ""}</span>
                                  </span>
                                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium capitalize text-slate-500">{a.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {dayDetail.expenses.length > 0 && (
                          <div className="mt-4">
                            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-charcoal-900 mb-1.5">
                              <TrendingDown size={13} className="text-slate-400" /> Expenses ({dayDetail.expenses.length})
                            </p>
                            <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                              {dayDetail.expenses.map((e) => (
                                <div key={e.id} className="flex items-center justify-between rounded-lg px-2 py-1 text-[12px]">
                                  <span className="truncate pr-2 text-slate-500">{e.category}{e.recipient ? ` · ${e.recipient}` : ""}</span>
                                  <span className="shrink-0 font-medium text-rose-500">{rupees(e.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
