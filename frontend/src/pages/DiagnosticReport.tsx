import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Sparkles,
  ScanText,
  RefreshCw,
  Wrench,
  GitBranch,
  Activity,
  History,
  TrendingUp,
  TrendingDown,
  Repeat,
  CheckCircle2,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  IndianRupee,
  Clock,
  MessageCircle,
  Shield,
  Share2,
} from "lucide-react";
import { api, DiagnosticReportDetail, DiagnosticTimeline } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import { healthTone } from "./Diagnostics";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const SYSTEM_LABELS: Record<string, string> = {
  engine: "Engine",
  transmission: "Transmission",
  abs_brakes: "Brakes / ABS",
  airbag: "Airbag / SRS",
  network: "Network (CAN)",
  electrical: "Electrical",
  emissions: "Emissions",
  cooling: "Cooling",
  fuel: "Fuel system",
  body: "Body",
  unknown: "Other",
};

const SEVERITY_CHIP: Record<string, string> = {
  critical: "bg-red-50 text-red-600 border-red-100",
  high: "bg-orange-50 text-orange-600 border-orange-100",
  medium: "bg-amber-50 text-amber-700 border-amber-100",
  low: "bg-sky-50 text-sky-600 border-sky-100",
  info: "bg-slate-50 text-slate-500 border-slate-100",
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-500",
  low: "border-l-sky-400",
  info: "border-l-slate-300",
};

const STATUS_CHIP: Record<string, string> = {
  active: "bg-red-50 text-red-600",
  permanent: "bg-red-50 text-red-600",
  pending: "bg-amber-50 text-amber-700",
  history: "bg-slate-100 text-slate-500",
  unknown: "bg-slate-50 text-slate-400",
};

const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

function inr(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

/* ------------------------------------------------------------------ */
/*  Health Gauge                                                      */
/* ------------------------------------------------------------------ */

function HealthGauge({ score, size = 144 }: { score: number | null; size?: number }) {
  const value = score ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score == null ? "#cbd5e1" : value >= 85 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative" style={{ height: size, width: size }}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="11" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-charcoal-900">{score ?? "—"}</span>
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">Health</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function DiagnosticReportPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [orgName, setOrgName] = useState("Workspace");
  const [detail, setDetail] = useState<DiagnosticReportDetail | null>(null);
  const [timeline, setTimeline] = useState<DiagnosticTimeline | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reprocessing, setReprocessing] = useState(false);
  const [showFaults, setShowFaults] = useState(false);
  const [expandedCauses, setExpandedCauses] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  // Vehicle-aware powertrain scan simulation state
  const [runningScans, setRunningScans] = useState<Record<string, boolean>>({});
  const [completedScans, setCompletedScans] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    api
      .getDiagnosticReport(id)
      .then((d) => {
        setDetail(d);
        if (d.report.vehicleId) api.vehicleDiagnosticTimeline(d.report.vehicleId).then(setTimeline).catch(() => {});
      })
      .catch((err) => setError(err.message));
  }, [id]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function reprocess(useOcr: boolean) {
    if (!id) return;
    setReprocessing(true);
    setNotice("");
    setError("");
    try {
      const d = await api.reprocessDiagnosticReport(id, useOcr);
      setDetail(d);
      setNotice(d.statusDetail ?? "Report re-analysed.");
      if (d.report.vehicleId) api.vehicleDiagnosticTimeline(d.report.vehicleId).then(setTimeline).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "reprocess failed");
    } finally {
      setReprocessing(false);
    }
  }

  function toggleCause(i: number) {
    setExpandedCauses((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  // Powertrain vehicle-aware classifications
  const rawFuel = detail?.vehicle?.fuelType || (detail?.report?.extracted?.vehicle?.fuelType as string) || "petrol";
  const fuelTypeLower = rawFuel.toLowerCase();
  const isEv = fuelTypeLower === "electric";
  const isHybrid = fuelTypeLower === "hybrid";
  const isIce = !isEv && !isHybrid;

  const startScanSim = (key: string) => {
    setRunningScans(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setRunningScans(prev => ({ ...prev, [key]: false }));
      setCompletedScans(prev => ({ ...prev, [key]: true }));
    }, 1500);
  };

  const iceItems = [
    {
      key: "oil",
      name: "Engine Oil & Lubrication",
      desc: "Oil level switch, dynamic viscosity readings, oil pump pressure limits.",
      systems: ["engine"],
    },
    {
      key: "filters",
      name: "Air & Fuel Filters",
      desc: "Mass air flow correlation, fuel filter restriction bounds.",
      systems: ["fuel"],
    },
    {
      key: "clutch",
      name: "Clutch & Transmission",
      desc: "Clutch wear coefficients, gear synchronizer alignment parameters.",
      systems: ["transmission"],
    },
    {
      key: "emissions",
      name: "Exhaust & Emissions Compliance",
      desc: "Catalytic converter gas efficiency metrics, lambda sensors response.",
      systems: ["emissions"],
    },
    {
      key: "cooling",
      name: "Engine Cooling & Radiator",
      desc: "Coolant temperature control thermostat, fan relay controls.",
      systems: ["cooling"],
    },
    {
      key: "combustion",
      name: "Combustion & Cylinder Fire",
      desc: "Misfire counters on each cylinder, spark plug impedance bounds.",
      systems: ["engine"],
    },
  ];

  const evItems = [
    {
      key: "battery",
      name: "Battery Pack State of Health (SOH)",
      desc: "Cell balance metrics, SOH calculation, thermal sensors deviation.",
      systems: ["electrical"],
    },
    {
      key: "charging",
      name: "Charging Interface & OBC",
      desc: "Onboard charger insulation, AC/DC fast charge relay contactors.",
      systems: ["electrical"],
    },
    {
      key: "safety",
      name: "High-Voltage Safety & Isolation",
      desc: "Ground fault detection insulation resistance, interlock loops status.",
      systems: ["electrical", "network"],
    },
    {
      key: "motor",
      name: "Electric Motor & Inverter Drive",
      desc: "IGBT switch temp limits, stator coils current sensors accuracy.",
      systems: ["transmission", "electrical"],
    },
    {
      key: "ev_cooling",
      name: "Battery Thermal Management",
      desc: "Coolant pumps speed validation, battery active chillers logic.",
      systems: ["cooling"],
    },
    {
      key: "warranty",
      name: "EV Telemetry & Pack Warranty",
      desc: "Age of pack, cumulative fast-charge cycle limits, warranty parameters.",
      systems: ["network"],
    },
  ];

  const renderWorkflowItem = (item: typeof iceItems[0]) => {
    const matchingFaults = detail?.faults.filter(f => item.systems.includes(f.system) && f.status !== "history") || [];
    const hasFault = matchingFaults.length > 0;
    
    const isCompleted = completedScans[item.key];
    const isRunning = runningScans[item.key];

    let systemScore: number | null = null;
    if (detail?.report?.systemScores) {
      for (const sys of item.systems) {
        if (detail.report.systemScores[sys] !== undefined) {
          systemScore = detail.report.systemScores[sys];
          break;
        }
      }
    }

    let status: "failed" | "passed" | "warning" | "unevaluated" = "unevaluated";
    if (hasFault) {
      status = "failed";
    } else if (isCompleted) {
      status = "passed";
    } else if (systemScore !== null) {
      status = systemScore >= 85 ? "passed" : "warning";
    }

    return (
      <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-charcoal-900">{item.name}</span>
            {status === "failed" && (
              <span className="rounded bg-red-50 border border-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 flex items-center gap-0.5 shadow-sm">
                🚨 Fault Detected
              </span>
            )}
            {status === "passed" && (
              <span className="rounded bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 shadow-sm">
                ✓ Passed
              </span>
            )}
            {status === "warning" && (
              <span className="rounded bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 flex items-center gap-0.5 shadow-sm">
                ⚠️ Attention Needed
              </span>
            )}
            {status === "unevaluated" && (
              <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                Pending Scan
              </span>
            )}
          </div>
          <p className="text-[12px] text-slate-400 mt-0.5">{item.desc}</p>
          
          {hasFault && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matchingFaults.map(f => (
                <span key={f.id} className="inline-flex items-center gap-1 rounded bg-red-50/40 px-1.5 py-0.5 text-[10px] font-mono font-bold text-red-700 border border-red-100/50" title={f.description}>
                  {f.code} ({f.severity})
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center">
          {isRunning ? (
            <button disabled className="rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1.5 text-[11.5px] font-bold flex items-center gap-1.5 animate-pulse">
              <RefreshCw size={12} className="animate-spin" /> Scanning...
            </button>
          ) : status === "unevaluated" ? (
            <button
              type="button"
              onClick={() => startScanSim(item.key)}
              className="rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 px-3 py-1.5 text-[11.5px] font-bold shadow-sm transition-all flex items-center gap-1"
            >
              <Activity size={12} /> Run Scan
            </button>
          ) : (
            <div className="text-[11px] text-slate-400 font-semibold px-2">
              {status === "passed" ? (systemScore !== null ? `Score: ${systemScore}` : "Verified") : `Score: ${systemScore}`}
            </div>
          )}
        </div>
      </div>
    );
  };

  const report = detail?.report;
  const extracted = report?.extracted;
  const recs = report?.recommendations ?? [];
  const totalMin = recs.reduce((s, r) => s + r.estCostMin, 0);
  const totalMax = recs.reduce((s, r) => s + r.estCostMax, 0);
  const totalLabor = recs.reduce((s, r) => s + r.laborHours, 0);
  const liveFaults = detail?.faults.filter((f) => f.status !== "history") ?? [];
  const criticalCount = liveFaults.filter((f) => f.severity === "critical").length;
  const activeCount = liveFaults.length;

  // Group recommendations by priority
  const recsByPriority = PRIORITY_ORDER.map((p) => ({
    priority: p,
    items: recs.filter((r) => r.priority === p),
  })).filter((g) => g.items.length > 0);

  // AI fields
  const aiCustomerSummary = (() => {
    const v = report?.aiAnalysis?.customer_summary;
    return typeof v === "string" && v.trim() && !/^not available\.?$/i.test(v.trim()) ? v.trim() : null;
  })();

  const verdictText = (() => {
    if (!report || report.status !== "processed") return null;
    if (criticalCount > 0) return `${criticalCount} critical fault${criticalCount > 1 ? "s" : ""} — immediate attention needed`;
    if (activeCount > 0) return `${activeCount} active fault${activeCount > 1 ? "s" : ""} found`;
    return "Clean scan — no active faults";
  })();

  const customerMessage = aiCustomerSummary || report?.summary || null;

  function copyCustomerMessage() {
    if (!customerMessage) return;
    navigator.clipboard.writeText(customerMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function waShareLink() {
    if (!customerMessage || !detail?.client?.phone) return null;
    const plate = detail?.vehicle?.plateNumber ?? report?.plateNumber ?? "";
    const text = `${plate ? plate + " — " : ""}${customerMessage}`;
    return `https://wa.me/91${detail.client.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />

      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          {/* Back nav */}
          <Link to="/diagnostics" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:text-charcoal-900">
            <ArrowLeft size={14} /> Diagnostics
          </Link>

          {/* Notices */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-[13px] text-sky-700">
              <AlertCircle size={15} /> {notice}
            </div>
          )}

          {/* Loading */}
          {!detail ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : report!.status !== "processed" ? (
            /* Not processed banner */
            <>
              <HeaderBar report={report!} detail={detail} reprocessing={reprocessing} reprocess={reprocess} />
              <div className="mt-6 rounded-xl2 border border-amber-100 bg-amber-50 px-6 py-8 text-center">
                <AlertCircle size={22} className="mx-auto mb-2 text-amber-500" />
                <p className="text-[14px] font-semibold text-amber-800">
                  {report!.status === "needs_ai" ? "This PDF is scanned — OCR is needed to read it" : "Could not read this file"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-snug text-amber-700">{report!.summary}</p>
              </div>
            </>
          ) : (
            <>
              {/* ============================================ */}
              {/* HERO: Health + Revenue + Vehicle Info         */}
              {/* ============================================ */}
              <div className="mt-4 rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-5">
                    <HealthGauge score={report!.healthScore} />
                    <div className="min-w-0">
                      <h1 className="text-xl font-semibold tracking-tight text-charcoal-900">
                        {detail.vehicle?.plateNumber ?? report!.plateNumber ?? "Unmatched vehicle"}
                      </h1>
                      <p className="mt-1 text-[13px] text-slate-400">
                        {detail.client ? (
                          <>
                            <Link to={`/clients/${detail.client.id}`} className="font-medium text-accent-700 hover:underline">
                              {detail.client.name}
                            </Link>
                            {" · "}
                            {detail.client.phone}
                            {" · "}
                          </>
                        ) : null}
                        {new Date(report!.reportDate ?? report!.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        {report!.odometerKm != null && <> · {report!.odometerKm.toLocaleString("en-IN")} km</>}
                        {report!.vin && <> · VIN {report!.vin}</>}
                      </p>
                      {/* Verdict */}
                      {verdictText && (
                        <p className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold ${
                          criticalCount > 0
                            ? "bg-red-50 text-red-600"
                            : activeCount > 0
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {criticalCount > 0 ? <AlertCircle size={13} /> : activeCount > 0 ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                          {verdictText}
                        </p>
                      )}
                      {/* Engine source */}
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                        {report!.engine !== "parser" ? <Sparkles size={11} className="text-accent-600" /> : <ScanText size={11} />}
                        {{
                          parser: "Extracted from PDF text layer",
                          ocr: "Read via Mistral OCR",
                          "parser+llm": "Text layer → AI analysis",
                          "ocr+llm": "Mistral OCR → AI analysis",
                        }[report!.engine ?? "parser"] ?? "Extracted from PDF text layer"}
                      </p>
                    </div>
                  </div>

                  {/* Right side: revenue opportunity + actions */}
                  <div className="flex flex-col items-end gap-3">
                    {totalMax > 0 && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-right">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Revenue opportunity</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xl font-bold tracking-tight text-charcoal-900">
                          <IndianRupee size={16} className="text-slate-400" />
                          {inr(totalMin)} – {inr(totalMax)}
                        </p>
                        {totalLabor > 0 && (
                          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                            <Clock size={10} /> ~{totalLabor}h labour
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <a
                        href={report!.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50"
                      >
                        <FileText size={13} /> PDF
                      </a>
                      {report!.textFileUrl && (
                        <a
                          href={report!.textFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Full document text (tables as markdown)"
                          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50"
                        >
                          <ScanText size={13} /> Text
                        </a>
                      )}
                      <button
                        onClick={() => reprocess(false)}
                        disabled={reprocessing}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={reprocessing ? "animate-spin" : ""} /> Re-analyse
                      </button>
                      {((report!.status as string) === "needs_ai" || report!.engine === "parser") && (
                        <button
                          onClick={() => reprocess(true)}
                          disabled={reprocessing}
                          className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-charcoal-800 disabled:opacity-50"
                        >
                          <Sparkles size={13} /> OCR
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================ */}
              {/* MAIN CONTENT: 2-column on lg                 */}
              {/* ============================================ */}
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                {/* LEFT COLUMN: Intelligence */}
                <div className="space-y-4">

                  {/* --- Customer Communication Card --- */}
                  {customerMessage && (
                    <div className="rounded-xl2 border border-accent-500/20 bg-accent-500/[0.03] p-5">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-900">
                          <MessageCircle size={14} className="text-accent-600" />
                          Customer summary
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={copyCustomerMessage}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:text-charcoal-900 transition-colors"
                          >
                            <Copy size={11} /> {copied ? "Copied!" : "Copy"}
                          </button>
                          {waShareLink() && (
                            <a
                              href={waShareLink()!}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors"
                            >
                              <Share2 size={11} /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-[13.5px] leading-relaxed text-charcoal-900">{customerMessage}</p>
                    </div>
                  )}

                  {/* --- System Health Strip --- */}
                  {report!.systemScores && Object.keys(report!.systemScores).length > 0 && (
                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">System health</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        {Object.entries(report!.systemScores!).map(([sys, score]) => (
                          <div key={sys} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <span className="text-[11.5px] text-slate-500">{SYSTEM_LABELS[sys] ?? sys}</span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${score >= 85 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className={`text-[11.5px] font-bold ${score >= 85 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600"}`}>{score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* --- Powertrain-Aware Diagnostics Workflow Panel --- */}
                  <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                      <div>
                        <h3 className="text-[14.5px] font-bold text-charcoal-900 flex items-center gap-1.5">
                          ⚙️ Powertrain Diagnostics Workflow
                        </h3>
                        <p className="text-[12px] text-slate-400">
                          Powertrain-specific active checks for this {isEv ? "Electric Vehicle (EV)" : isHybrid ? "Hybrid Vehicle" : "Internal Combustion Engine (ICE)"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border ${
                          isEv 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm" 
                            : isHybrid 
                              ? "bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm" 
                              : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}>
                          {isEv ? "⚡ EV Powertrain" : isHybrid ? "🔌 Hybrid Powertrain" : "⛽ ICE Powertrain"}
                        </span>
                      </div>
                    </div>

                    {isEv && (
                      <div className="space-y-2">
                        {evItems.map(renderWorkflowItem)}
                      </div>
                    )}

                    {isIce && (
                      <div className="space-y-2">
                        {iceItems.map(renderWorkflowItem)}
                      </div>
                    )}

                    {isHybrid && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">⚡ Electric Drivetrain & High Voltage Checks</p>
                          <div className="space-y-2">
                            {evItems.map(renderWorkflowItem)}
                          </div>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">⛽ Internal Combustion Engine Checks</p>
                          <div className="space-y-2">
                            {iceItems.map(renderWorkflowItem)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {recs.length > 0 && (
                    <div className="rounded-xl2 border border-slate-100 bg-white shadow-card">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <p className="flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-900">
                          <Wrench size={15} /> Repair plan
                        </p>
                        {totalMax > 0 && (
                          <div className="flex items-center gap-3 text-[12px]">
                            <span className="text-slate-400">Total estimate</span>
                            <span className="font-bold text-charcoal-900">{inr(totalMin)} – {inr(totalMax)}</span>
                            {totalLabor > 0 && <span className="text-slate-400">· ~{totalLabor}h</span>}
                          </div>
                        )}
                      </div>

                      {/* Priority groups */}
                      <div className="p-5 space-y-4">
                        {recsByPriority.map((group) => (
                          <div key={group.priority}>
                            <p className={`mb-2 text-[10.5px] font-bold uppercase tracking-widest ${
                              group.priority === "critical" ? "text-red-500" : group.priority === "high" ? "text-orange-500" : group.priority === "medium" ? "text-amber-600" : "text-sky-500"
                            }`}>
                              {group.priority} priority
                            </p>
                            <div className="space-y-2">
                              {group.items.map((r, i) => (
                                <div
                                  key={i}
                                  className={`rounded-xl border border-slate-100 border-l-[3px] p-4 ${SEVERITY_BORDER[r.priority] ?? "border-l-slate-300"}`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-[13px] font-medium leading-snug text-charcoal-900">{r.action}</p>
                                    {r.estCostMax > 0 && (
                                      <span className="shrink-0 text-[13px] font-bold text-charcoal-900">
                                        {inr(r.estCostMin)}–{inr(r.estCostMax)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {r.codes.map((code) => (
                                      <span key={code} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-mono font-medium text-slate-600">{code}</span>
                                    ))}
                                    {r.laborHours > 0 && (
                                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                        <Clock size={10} /> ~{r.laborHours}h
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <p className="text-[10.5px] leading-snug text-slate-400">
                          Cost bands are indicative Indian-market estimates (parts + labour), not quotes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* --- Root Causes --- */}
                  {(report!.rootCauses ?? []).length > 0 && (
                    <div className="rounded-xl2 border border-slate-100 bg-white shadow-card">
                      <div className="border-b border-slate-100 px-5 py-4">
                        <p className="flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-900">
                          <GitBranch size={15} className="text-accent-600" /> Root cause analysis
                        </p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {(report!.rootCauses ?? []).map((rc, i) => {
                          const isOpen = expandedCauses.has(i);
                          return (
                            <div key={i} className="px-5">
                              <button
                                onClick={() => toggleCause(i)}
                                className="flex w-full items-center justify-between py-4 text-left"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13px] font-semibold text-charcoal-900">{rc.title}</span>
                                  <span className="rounded-md bg-accent-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent-700 border border-accent-100">
                                    {rc.confidence}
                                  </span>
                                  <span className="text-[11px] text-slate-400">{rc.explains.join(", ")}</span>
                                </div>
                                {isOpen ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                              </button>
                              {isOpen && (
                                <div className="pb-4">
                                  <p className="text-[13px] leading-relaxed text-slate-600">{rc.explanation}</p>
                                  <ol className="mt-3 space-y-1.5">
                                    {rc.repairSequence.map((step, j) => (
                                      <li key={j} className="flex items-start gap-2.5 text-[13px] text-charcoal-900">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-charcoal-900 text-[10.5px] font-bold text-white">
                                          {j + 1}
                                        </span>
                                        {step}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* --- AI Analysis (remaining fields) --- */}
                  {report!.aiAnalysis && <AiAnalysisCard analysis={report!.aiAnalysis} /> }

                  {/* --- Fault Codes (collapsible) --- */}
                  <div className="rounded-xl2 border border-slate-100 bg-white shadow-card">
                    <button
                      onClick={() => setShowFaults(!showFaults)}
                      className="flex w-full items-center justify-between px-5 py-4"
                    >
                      <p className="text-[13.5px] font-semibold text-charcoal-900">
                        Fault codes <span className="ml-1 font-normal text-slate-400">({detail.faults.length})</span>
                      </p>
                      {showFaults ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                    </button>
                    {showFaults && (
                      detail.faults.length === 0 ? (
                        <p className="px-5 pb-5 text-[13px] text-slate-400">No fault codes in this report — scanned clean. 🎉</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[12.5px]">
                            <thead>
                              <tr className="border-t border-b border-slate-100 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                                <th className="px-5 py-2.5">Code</th>
                                <th className="px-5 py-2.5">Description</th>
                                <th className="px-5 py-2.5">System</th>
                                <th className="px-5 py-2.5">Status</th>
                                <th className="px-5 py-2.5">Severity</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {detail.faults.map((f) => (
                                <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-5 py-3 font-mono font-semibold text-charcoal-900 whitespace-nowrap">
                                    {f.code}
                                    {f.isRecurring && (
                                      <span title="Seen in earlier reports of this vehicle">
                                        <Repeat size={11} className="ml-1.5 inline text-orange-500" />
                                      </span>
                                    )}
                                  </td>
                                  <td className="max-w-[280px] break-words px-5 py-3 text-slate-600">{f.description}</td>
                                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{SYSTEM_LABELS[f.system] ?? f.system}</td>
                                  <td className="px-5 py-3">
                                    <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase ${STATUS_CHIP[f.status] ?? STATUS_CHIP.unknown}`}>
                                      {f.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3">
                                    <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase ${SEVERITY_CHIP[f.severity] ?? SEVERITY_CHIP.info}`}>
                                      {f.severity}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    )}
                  </div>

                  {/* --- Document Facts --- */}
                  {(extracted?.workshopName || extracted?.technicianName || (extracted?.remarks ?? []).length > 0 || (extracted?.partsReplaced ?? []).length > 0) && (
                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">From the document</p>
                      <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-[12.5px] text-slate-600">
                        {extracted?.workshopName && (
                          <span>Workshop: <span className="font-medium text-charcoal-900">{extracted.workshopName}</span></span>
                        )}
                        {extracted?.technicianName && (
                          <span>Technician: <span className="font-medium text-charcoal-900">{extracted.technicianName}</span></span>
                        )}
                        {(extracted?.partsReplaced ?? []).length > 0 && (
                          <span>Parts replaced: <span className="font-medium text-charcoal-900">{extracted!.partsReplaced!.join(", ")}</span></span>
                        )}
                      </div>
                      {(extracted?.remarks ?? []).length > 0 && (
                        <ul className="mt-2 list-inside list-disc text-[12.5px] text-slate-600">
                          {extracted!.remarks!.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* RIGHT SIDEBAR: Context & History */}
                <div className="space-y-4 lg:sticky lg:top-8 lg:self-start">

                  {/* --- vs Previous Report --- */}
                  <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-900">
                      <History size={14} /> vs previous report
                    </p>
                    {!detail.comparison ? (
                      <p className="mt-3 text-[12.5px] text-slate-400">First report for this vehicle — upload the next scan to see trends.</p>
                    ) : (
                      <div className="mt-3 space-y-2.5 text-[12.5px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Health change</span>
                          {detail.comparison.healthDelta == null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 font-semibold ${detail.comparison.healthDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {detail.comparison.healthDelta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                              {detail.comparison.healthDelta > 0 ? "+" : ""}
                              {detail.comparison.healthDelta}
                            </span>
                          )}
                        </div>
                        <ComparisonRow icon={PlusCircle} tone="text-red-600" label="New faults" codes={detail.comparison.newCodes} />
                        <ComparisonRow icon={CheckCircle2} tone="text-emerald-600" label="Resolved" codes={detail.comparison.resolvedCodes} />
                        <ComparisonRow icon={Repeat} tone="text-orange-500" label="Still present" codes={detail.comparison.recurringCodes} />
                        <p className="pt-1 text-[11px] text-slate-400">
                          Compared with{" "}
                          <Link to={`/diagnostics/${detail.comparison.previousReportId}`} className="font-medium text-accent-700 hover:underline">
                            report of {new Date(detail.comparison.previousDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </Link>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* --- Vehicle History --- */}
                  <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-900">
                      <TrendingUp size={14} /> Vehicle history
                    </p>
                    {!timeline || timeline.reports.length <= 1 ? (
                      <p className="mt-3 text-[12.5px] text-slate-400">
                        {timeline?.reports.length === 1 ? "One report on file." : "No vehicle linked — match a vehicle to build history."}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {timeline.recurringCodes.length > 0 && (
                          <p className="rounded-lg bg-orange-50 px-3 py-2 text-[11.5px] leading-snug text-orange-700">
                            <Repeat size={11} className="mr-1 inline" />
                            Keeps recurring: {timeline.recurringCodes.map((c) => `${c.code} (×${c.occurrences})`).join(", ")}
                          </p>
                        )}
                        {[...timeline.reports].reverse().slice(0, 6).map((r) => (
                          <Link
                            key={r.id}
                            to={`/diagnostics/${r.id}`}
                            className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors hover:bg-slate-50 ${
                              r.id === report!.id ? "border-accent-500/40 bg-accent-500/[0.04]" : "border-slate-100"
                            }`}
                          >
                            <span className="text-[12px] text-slate-500">
                              {new Date(r.reportDate ?? r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              <span className="ml-2 text-slate-400">{r.faults.length} fault{r.faults.length === 1 ? "" : "s"}</span>
                            </span>
                            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${healthTone(r.healthScore)}`}>
                              {r.healthScore != null ? r.healthScore : "—"}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* --- Live Sensor Data --- */}
                  {(extracted?.sensors ?? []).length > 0 && (
                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-900">
                        <Activity size={14} /> Live data captured
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(extracted?.sensors ?? []).map((s, i) => (
                          <div key={i} className="rounded-lg bg-slate-50 px-2.5 py-2">
                            <p className="text-[10px] font-medium text-slate-400 truncate">{s.name}</p>
                            <p className="mt-0.5 text-[13px] font-semibold text-charcoal-900">
                              {s.value}
                              {s.unit ? <span className="ml-0.5 text-[10px] font-normal text-slate-400">{s.unit}</span> : null}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header Bar (shared between processed and non-processed states)    */
/* ------------------------------------------------------------------ */

function HeaderBar({
  report,
  detail,
  reprocessing,
  reprocess,
}: {
  report: DiagnosticReportDetail["report"];
  detail: DiagnosticReportDetail;
  reprocessing: boolean;
  reprocess: (useOcr: boolean) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-charcoal-900">
          {detail.vehicle?.plateNumber ?? report.plateNumber ?? "Unmatched vehicle"}
        </h1>
        <p className="mt-1 text-[13px] text-slate-400">
          {detail.client ? (
            <>
              <Link to={`/clients/${detail.client.id}`} className="font-medium text-accent-700 hover:underline">
                {detail.client.name}
              </Link>
              {" · "}
              {detail.client.phone}
              {" · "}
            </>
          ) : null}
          {new Date(report.reportDate ?? report.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={report.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50"
        >
          <FileText size={13} /> PDF
        </a>
        <button
          onClick={() => reprocess(false)}
          disabled={reprocessing}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={reprocessing ? "animate-spin" : ""} /> Re-analyse
        </button>
        {(report.status === "needs_ai" || report.engine === "parser") && (
          <button
            onClick={() => reprocess(true)}
            disabled={reprocessing}
            className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-charcoal-800 disabled:opacity-50"
          >
            <Sparkles size={13} /> Read with OCR
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Analysis Card — only renders real data, never fabricated       */
/* ------------------------------------------------------------------ */

function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "" || /^not available\.?$/i.test(v.trim());
  if (Array.isArray(v)) return v.length === 0 || v.every(isEmptyValue);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).every(isEmptyValue);
  return false;
}

function humanize(key: string): string {
  const s = key.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function AiValue({ value }: { value: unknown }) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="text-charcoal-900">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="mt-0.5 space-y-1">
        {value.filter((v) => !isEmptyValue(v)).map((v, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <div className="min-w-0 flex-1 break-words">
              <AiValue value={v} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="mt-0.5 space-y-1">
      {Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => !isEmptyValue(v))
        .map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[11.5px] font-medium text-slate-400">{humanize(k)}:</span>
            <div className="min-w-0 flex-1 break-words">
              <AiValue value={v} />
            </div>
          </div>
        ))}
    </div>
  );
}

const AI_CHIP_TONE: Record<string, string> = {
  critical: "bg-red-50 text-red-600 border-red-100",
  high: "bg-orange-50 text-orange-600 border-orange-100",
  medium: "bg-amber-50 text-amber-700 border-amber-100",
  low: "bg-sky-50 text-sky-600 border-sky-100",
};

function AiAnalysisCard({ analysis }: { analysis: Record<string, unknown> }) {
  const str = (k: string): string | null => {
    const v = analysis[k];
    return typeof v === "string" && !isEmptyValue(v) ? v : null;
  };
  const severity = str("severity");
  const confidence = str("confidence");
  const repairTime = str("repair_time");

  // customer_summary is rendered in the communication card above — skip here
  const SECTION_ORDER = [
    "diagnostic_summary",
    "root_cause_analysis",
    "recommended_tests",
    "recommended_repairs",
    "parts_required",
    "estimated_cost",
    "vehicle_health_score",
    "technician_notes",
    "faults",
    "vehicle",
  ];
  const handled = new Set(["severity", "confidence", "repair_time", "customer_summary", ...SECTION_ORDER]);
  const sections = [
    ...SECTION_ORDER.map((k) => [k, analysis[k]] as const),
    ...Object.entries(analysis).filter(([k]) => !handled.has(k)),
  ].filter(([, v]) => !isEmptyValue(v));

  if (sections.length === 0 && !severity && !confidence) return null;

  return (
    <div className="rounded-xl2 border border-violet-200/60 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={15} className="text-violet-600" />
        <span className="text-[14px] font-semibold text-charcoal-900">AI analysis</span>
        {severity && (
          <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-semibold uppercase ${AI_CHIP_TONE[severity.toLowerCase()] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
            {severity} severity
          </span>
        )}
        {confidence && (
          <span className="rounded-md border border-violet-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase text-violet-700">
            {confidence} confidence
          </span>
        )}
        {repairTime && <span className="text-[11.5px] text-slate-400">est. repair time: {repairTime}</span>}
      </div>

      {sections.length > 0 && (
        <div className="mt-3 grid gap-x-8 gap-y-4 text-[12.5px] md:grid-cols-2">
          {sections.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{humanize(k)}</p>
              <div className="mt-1 break-words leading-relaxed">
                <AiValue value={v} />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[10.5px] leading-snug text-slate-400">
        Generated by the model configured in Settings → Connectors → OpenRouter, from this report's extracted text. Verify before quoting.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison Row                                                     */
/* ------------------------------------------------------------------ */

function ComparisonRow({
  icon: Icon,
  tone,
  label,
  codes,
}: {
  icon: typeof Repeat;
  tone: string;
  label: string;
  codes: string[];
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-slate-500">
        <Icon size={13} className={tone} /> {label}
      </span>
      <span className="text-right font-mono text-[11.5px] font-medium text-charcoal-900">{codes.length > 0 ? codes.join(", ") : "none"}</span>
    </div>
  );
}
