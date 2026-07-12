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
} from "lucide-react";
import { api, DiagnosticReportDetail, DiagnosticTimeline } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import { healthTone } from "./Diagnostics";

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

const STATUS_CHIP: Record<string, string> = {
  active: "bg-red-50 text-red-600",
  permanent: "bg-red-50 text-red-600",
  pending: "bg-amber-50 text-amber-700",
  history: "bg-slate-100 text-slate-500",
  unknown: "bg-slate-50 text-slate-400",
};

function inr(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

function HealthGauge({ score }: { score: number | null }) {
  const value = score ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score == null ? "#cbd5e1" : value >= 85 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative h-36 w-36">
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
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-charcoal-900">{score ?? "—"}</span>
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">Health</span>
      </div>
    </div>
  );
}

export default function DiagnosticReportPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [orgName, setOrgName] = useState("Workspace");
  const [detail, setDetail] = useState<DiagnosticReportDetail | null>(null);
  const [timeline, setTimeline] = useState<DiagnosticTimeline | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reprocessing, setReprocessing] = useState(false);

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

  const report = detail?.report;
  const extracted = report?.extracted;
  const liveFaults = detail?.faults.filter((f) => f.status !== "history") ?? [];
  const recs = report?.recommendations ?? [];
  const totalMin = recs.reduce((s, r) => s + r.estCostMin, 0);
  const totalMax = recs.reduce((s, r) => s + r.estCostMax, 0);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />

      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">
          <Link to="/diagnostics" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 transition-colors hover:text-charcoal-900">
            <ArrowLeft size={14} /> Diagnostics
          </Link>

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

          {!detail ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div>
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
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={report!.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50"
                  >
                    <FileText size={13} /> Original PDF
                  </a>
                  {report!.textFileUrl && (
                    <a
                      href={report!.textFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Full document text (tables as markdown) — ready to paste into any LLM"
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50"
                    >
                      <ScanText size={13} /> Extracted text
                    </a>
                  )}
                  <button
                    onClick={() => reprocess(false)}
                    disabled={reprocessing}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-charcoal-900 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={reprocessing ? "animate-spin" : ""} /> Re-analyse
                  </button>
                  {(report!.status === "needs_ai" || report!.engine === "parser") && (
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

              {report!.status !== "processed" ? (
                <div className="mt-6 rounded-xl2 border border-amber-100 bg-amber-50 px-6 py-8 text-center">
                  <AlertCircle size={22} className="mx-auto mb-2 text-amber-500" />
                  <p className="text-[14px] font-semibold text-amber-800">
                    {report!.status === "needs_ai" ? "This PDF is scanned — OCR is needed to read it" : "Could not read this file"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-snug text-amber-700">{report!.summary}</p>
                </div>
              ) : (
                <>
                  {/* Hero: health + systems + summary */}
                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    <div className="flex items-center gap-5 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <HealthGauge score={report!.healthScore} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Verdict</p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-charcoal-900">{report!.summary}</p>
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

                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card lg:col-span-2">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">System health</p>
                      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
                        {Object.entries(report!.systemScores ?? {}).map(([sys, score]) => (
                          <div key={sys} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 text-[12px] text-slate-500">{SYSTEM_LABELS[sys] ?? sys}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${score >= 85 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className="w-8 shrink-0 text-right text-[12px] font-semibold text-charcoal-900">{score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AutoDiag AI analysis — full LLM output (OCR → LLM → UI) */}
                  {report!.aiAnalysis && <AiAnalysisCard analysis={report!.aiAnalysis} />}

                  {/* Root causes */}
                  {(report!.rootCauses ?? []).length > 0 && (
                    <div className="mt-4 space-y-3">
                      {(report!.rootCauses ?? []).map((rc, i) => (
                        <div key={i} className="rounded-xl2 border border-accent-500/20 bg-accent-500/[0.04] p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <GitBranch size={15} className="text-accent-600" />
                            <span className="text-[14px] font-semibold text-charcoal-900">{rc.title}</span>
                            <span className="rounded-md bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent-700 border border-accent-500/20">
                              {rc.confidence} confidence
                            </span>
                            <span className="text-[11.5px] text-slate-400">explains {rc.explains.join(", ")}</span>
                          </div>
                          <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{rc.explanation}</p>
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
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 lg:grid-cols-5">
                    {/* Faults table */}
                    <div className="overflow-hidden rounded-xl2 border border-slate-100 bg-white shadow-card lg:col-span-3">
                      <div className="border-b border-slate-100 px-5 py-4">
                        <p className="text-[13.5px] font-semibold text-charcoal-900">
                          Fault codes <span className="ml-1 font-normal text-slate-400">({detail.faults.length})</span>
                        </p>
                      </div>
                      {detail.faults.length === 0 ? (
                        <p className="px-5 py-10 text-center text-[13px] text-slate-400">No fault codes in this report — scanned clean. 🎉</p>
                      ) : (
                        <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12.5px]">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                              <th className="px-5 py-2.5">Code</th>
                              <th className="px-5 py-2.5">Description</th>
                              <th className="px-5 py-2.5">System</th>
                              <th className="px-5 py-2.5">Status</th>
                              <th className="px-5 py-2.5">Severity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {detail.faults.map((f) => (
                              <tr key={f.id}>
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
                      )}
                    </div>

                    {/* Repair plan */}
                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card lg:col-span-2">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-charcoal-900">
                          <Wrench size={14} /> Repair plan
                        </p>
                        {totalMax > 0 && (
                          <span className="text-[12px] font-semibold text-charcoal-900">
                            {inr(totalMin)}–{inr(totalMax)}
                          </span>
                        )}
                      </div>
                      {recs.length === 0 ? (
                        <p className="mt-4 text-[12.5px] text-slate-400">Nothing to repair from this report.</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {recs.map((r, i) => (
                            <div key={i} className="rounded-xl border border-slate-100 p-3.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[13px] font-medium leading-snug text-charcoal-900">{r.action}</p>
                                <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_CHIP[r.priority] ?? SEVERITY_CHIP.info}`}>
                                  {r.priority}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[11.5px] text-slate-400">
                                {r.codes.join(", ")}
                                {r.estCostMax > 0 && (
                                  <>
                                    {" · "}
                                    <span className="font-semibold text-charcoal-900">
                                      {inr(r.estCostMin)}–{inr(r.estCostMax)}
                                    </span>
                                  </>
                                )}
                                {r.laborHours > 0 && <> · ~{r.laborHours}h labour</>}
                              </p>
                            </div>
                          ))}
                          <p className="text-[10.5px] leading-snug text-slate-400">
                            Cost bands are indicative Indian-market estimates (parts + labour), not quotes.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sensors + comparison + history */}
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-charcoal-900">
                        <Activity size={14} /> Live data captured
                      </p>
                      {(extracted?.sensors ?? []).length === 0 ? (
                        <p className="mt-4 text-[12.5px] text-slate-400">No live sensor values found on this report.</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2.5">
                          {(extracted?.sensors ?? []).map((s, i) => (
                            <div key={i} className="rounded-xl bg-slate-50 px-3 py-2.5">
                              <p className="text-[10.5px] font-medium text-slate-400">{s.name}</p>
                              <p className="mt-0.5 text-[14px] font-semibold text-charcoal-900">
                                {s.value}
                                {s.unit ? <span className="ml-1 text-[11px] font-normal text-slate-400">{s.unit}</span> : null}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-charcoal-900">
                        <History size={14} /> vs previous report
                      </p>
                      {!detail.comparison ? (
                        <p className="mt-4 text-[12.5px] text-slate-400">First report for this vehicle — upload the next scan to see trends.</p>
                      ) : (
                        <div className="mt-3 space-y-2.5 text-[12.5px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Health change</span>
                            {detail.comparison.healthDelta == null ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${
                                  detail.comparison.healthDelta >= 0 ? "text-emerald-600" : "text-red-600"
                                }`}
                              >
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

                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-charcoal-900">
                        <TrendingUp size={14} /> Vehicle history
                      </p>
                      {!timeline || timeline.reports.length <= 1 ? (
                        <p className="mt-4 text-[12.5px] text-slate-400">
                          {timeline?.reports.length === 1 ? "One report on file for this vehicle." : "No vehicle linked — match a vehicle to build history."}
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
                  </div>

                  {/* Extracted document facts */}
                  {(extracted?.workshopName || extracted?.technicianName || (extracted?.remarks ?? []).length > 0 || (extracted?.partsReplaced ?? []).length > 0) && (
                    <div className="mt-4 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">From the document</p>
                      <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-[12.5px] text-slate-600">
                        {extracted?.workshopName && (
                          <span>
                            Workshop: <span className="font-medium text-charcoal-900">{extracted.workshopName}</span>
                          </span>
                        )}
                        {extracted?.technicianName && (
                          <span>
                            Technician: <span className="font-medium text-charcoal-900">{extracted.technicianName}</span>
                          </span>
                        )}
                        {(extracted?.partsReplaced ?? []).length > 0 && (
                          <span>
                            Parts replaced: <span className="font-medium text-charcoal-900">{extracted!.partsReplaced!.join(", ")}</span>
                          </span>
                        )}
                      </div>
                      {(extracted?.remarks ?? []).length > 0 && (
                        <ul className="mt-2 list-inside list-disc text-[12.5px] text-slate-600">
                          {extracted!.remarks!.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ---- AutoDiag AI analysis (LLM output) — shape varies by model, render defensively ----

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

// Recursive renderer: strings/numbers as text, arrays as bullet lists,
// objects as label/value rows.
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
  const customerSummary = str("customer_summary");

  // Everything else renders generically, in a sensible order.
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

  return (
    <div className="mt-4 rounded-xl2 border border-violet-200/60 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={15} className="text-violet-600" />
        <span className="text-[14px] font-semibold text-charcoal-900">AutoDiag AI analysis</span>
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

      {customerSummary && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Explain to the customer</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-charcoal-900">{customerSummary}</p>
        </div>
      )}

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

      <p className="mt-4 text-[10.5px] leading-snug text-slate-400">
        Generated by the model configured in Settings → Connectors → OpenRouter, from this report's extracted text. Verify before quoting.
      </p>
    </div>
  );
}

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
      <span className={`inline-flex items-center gap-1.5 text-slate-500`}>
        <Icon size={13} className={tone} /> {label}
      </span>
      <span className="text-right font-mono text-[11.5px] font-medium text-charcoal-900">{codes.length > 0 ? codes.join(", ") : "none"}</span>
    </div>
  );
}
