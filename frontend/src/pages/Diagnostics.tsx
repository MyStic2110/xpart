import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileScan,
  AlertTriangle,
  AlertOctagon,
  CarFront,
  HeartPulse,
  Upload,
  X,
  AlertCircle,
  FileText,
  Sparkles,
  ScanText,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { api, DiagnosticReportListItem, DiagnosticSummary, VehicleSearchResult } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 12;

const REPORT_TYPES: { value: string; label: string }[] = [
  { value: "obd_scan", label: "OBD scan report" },
  { value: "health_report", label: "Vehicle health report" },
  { value: "service_invoice", label: "Service invoice / history" },
  { value: "emission_test", label: "Emission (PUC) test" },
  { value: "battery_report", label: "Battery health report" },
  { value: "alignment_report", label: "Wheel alignment report" },
  { value: "insurance_inspection", label: "Insurance inspection" },
  { value: "other", label: "Other document" },
];

export function healthTone(score: number | null): string {
  if (score == null) return "bg-slate-100 text-slate-500";
  if (score >= 85) return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  if (score >= 60) return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-red-50 text-red-700 border border-red-100";
}

export default function Diagnostics() {
  const navigate = useNavigate();
  const { branchId, branchParam } = useBranch();
  const [orgName, setOrgName] = useState("Workspace");

  const [reports, setReports] = useState<DiagnosticReportListItem[] | null>(null);
  const [summary, setSummary] = useState<DiagnosticSummary | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  // Upload drawer
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState("obd_scan");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleResults, setVehicleResults] = useState<VehicleSearchResult[]>([]);
  const [vehicle, setVehicle] = useState<VehicleSearchResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    api.listDiagnosticReports({ branchId: branchParam }).then(setReports).catch((err) => setError(err.message));
    api.diagnosticsSummary(branchParam).then(setSummary).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  useEffect(() => {
    setReports(null);
    load();
    setPage(1);
  }, [branchParam]);

  useEffect(() => setPage(1), [search]);

  // Vehicle autocomplete for the upload drawer
  useEffect(() => {
    if (vehicleQuery.trim().length < 2 || vehicle) {
      setVehicleResults([]);
      return;
    }
    const t = setTimeout(() => {
      api.searchVehicles(vehicleQuery.trim()).then(setVehicleResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [vehicleQuery, vehicle]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function openUpload() {
    setFile(null);
    setReportType("obd_scan");
    setVehicle(null);
    setVehicleQuery("");
    setUploadError("");
    setShowUpload(true);
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadError("");
    if (!file) return setUploadError("pick a PDF report to upload");
    setUploading(true);
    try {
      const detail = await api.uploadDiagnosticReport(file, {
        branchId: branchId !== "all" ? branchId : undefined,
        vehicleId: vehicle?.id,
        reportType,
      });
      setShowUpload(false);
      navigate(`/diagnostics/${detail.report.id}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeReport(r: DiagnosticReportListItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete diagnostic report "${r.fileName}"? Its fault history is removed too.`)) return;
    try {
      await api.deleteDiagnosticReport(r.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not delete");
    }
  }

  const filtered = useMemo(() => {
    if (!reports) return [];
    const q = search.trim().toLowerCase();
    return q
      ? reports.filter(
          (r) =>
            (r.plateNumber ?? "").toLowerCase().includes(q) ||
            (r.clientName ?? "").toLowerCase().includes(q) ||
            r.fileName.toLowerCase().includes(q) ||
            r.reportType.toLowerCase().includes(q)
        )
      : reports;
  }, [reports, search]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />

      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-charcoal-900 tracking-tight">Diagnostics</h1>
              <p className="mt-1 text-[13px] text-slate-400">
                Upload any diagnostic PDF — OBD scans, dealer health reports, emission tests — and get fault codes, root cause and a repair plan per vehicle.
              </p>
            </div>
            <button
              onClick={openUpload}
              className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-charcoal-800"
            >
              <Upload size={15} />
              Upload report
            </button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Reports" value={summary?.totalReports ?? 0} icon={FileScan} loading={!summary} />
            <StatCard label="Active faults" value={summary?.activeFaults ?? 0} icon={AlertTriangle} loading={!summary} />
            <StatCard label="Critical faults" value={summary?.criticalFaults ?? 0} icon={AlertOctagon} loading={!summary} />
            <StatCard
              label="Vehicles need attention"
              value={summary?.vehiclesNeedingAttention ?? 0}
              icon={CarFront}
              loading={!summary}
              info="Vehicles with active critical/high-severity faults in their latest reports"
            />
            <StatCard
              label="Avg health"
              value={summary?.avgHealthScore != null ? `${summary.avgHealthScore}/100` : "—"}
              icon={HeartPulse}
              loading={!summary}
            />
          </div>

          {summary && summary.topCodes.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Common faults</span>
              {summary.topCodes.map((c) => (
                <span key={c.code} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-charcoal-900" title={c.description}>
                  <span className="font-semibold">{c.code}</span>
                  <span className="ml-1.5 text-slate-400">×{c.count}</span>
                </span>
              ))}
            </div>
          )}

          <div className="mt-6">
            <TableToolbar
              search={search}
              onSearch={setSearch}
              placeholder="Search plate, client, file…"
              onDownload={() =>
                downloadCsv(
                  "diagnostic-reports.csv",
                  filtered.map((r) => ({
                    date: r.reportDate ?? r.createdAt.slice(0, 10),
                    plate: r.plateNumber ?? "",
                    client: r.clientName ?? "",
                    type: r.reportType,
                    faults: r.faultCount,
                    critical: r.criticalFaults,
                    health: r.healthScore ?? "",
                    status: r.status,
                    file: r.fileName,
                  }))
                )
              }
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl2 border border-slate-100 bg-white shadow-card">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Vehicle</th>
                  <th className="px-5 py-3.5">Client</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Faults</th>
                  <th className="px-5 py-3.5">Health</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px]">
                {reports === null ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-slate-400">
                      <FileScan size={22} className="mx-auto mb-2 text-slate-300" />
                      No diagnostic reports yet. Upload an OBD scan or workshop PDF to build each vehicle's health history.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} onClick={() => navigate(`/diagnostics/${r.id}`)} className="cursor-pointer transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                        {new Date(r.reportDate ?? r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-4 font-semibold text-charcoal-900">{r.plateNumber ?? <span className="font-normal text-slate-400">Unmatched</span>}</td>
                      <td className="px-5 py-4 text-slate-600">{r.clientName ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-500">{REPORT_TYPES.find((t) => t.value === r.reportType)?.label ?? r.reportType}</td>
                      <td className="px-5 py-4">
                        <span className="text-charcoal-900 font-medium">{r.faultCount}</span>
                        {r.criticalFaults > 0 && (
                          <span className="ml-2 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">{r.criticalFaults} critical</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block rounded-lg px-2 py-1 text-[11.5px] font-semibold ${healthTone(r.healthScore)}`}>
                          {r.healthScore != null ? `${r.healthScore}/100` : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {r.status === "processed" ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] text-slate-500">
                            {r.engine !== "parser" ? <Sparkles size={12} className="text-accent-600" /> : <ScanText size={12} className="text-slate-400" />}
                            {{ parser: "Parsed", ocr: "OCR read", "parser+llm": "Parsed + AI", "ocr+llm": "OCR + AI" }[r.engine ?? "parser"] ?? "Parsed"}
                          </span>
                        ) : r.status === "needs_ai" ? (
                          <span className="whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Needs OCR</span>
                        ) : (
                          <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">Failed</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => removeReport(r, e)}
                            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Delete report"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={15} className="text-slate-300" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        </div>
      </main>

      {/* Upload drawer */}
      {showUpload && (
        <>
          <div className="fixed inset-0 z-40 bg-charcoal-900/30 backdrop-blur-[2px]" onClick={() => setShowUpload(false)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-elevated animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[15px] font-semibold text-charcoal-900">Upload diagnostic report</h2>
              <button onClick={() => setShowUpload(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitUpload} className="space-y-5 px-6 py-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                  file ? "border-accent-500/50 bg-accent-500/[0.04]" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <FileText size={22} className={file ? "text-accent-600" : "text-slate-300"} />
                {file ? (
                  <>
                    <p className="text-[13px] font-semibold text-charcoal-900 break-all">{file.name}</p>
                    <p className="text-[11.5px] text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB — click to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-charcoal-900">Click to pick a PDF</p>
                    <p className="text-[11.5px] text-slate-400">OBD scan, health report, emission test… up to 15 MB</p>
                  </>
                )}
              </div>

              <div>
                <label className="mb-1 block px-1 text-[11px] font-medium text-slate-400">Report type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-charcoal-900 hover:border-slate-300 focus:border-accent-500 focus:outline-none"
                >
                  {REPORT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label className="mb-1 block px-1 text-[11px] font-medium text-slate-400">Vehicle (optional — auto-matched by plate on the report)</label>
                {vehicle ? (
                  <div className="flex items-center justify-between rounded-xl border border-accent-500/40 bg-accent-500/[0.05] px-4 py-3">
                    <div>
                      <p className="text-[14px] font-semibold text-charcoal-900">{vehicle.plateNumber}</p>
                      <p className="text-[11.5px] text-slate-400">
                        {vehicle.clientName} · {vehicle.clientPhone}
                      </p>
                    </div>
                    <button type="button" onClick={() => setVehicle(null)} className="rounded-lg p-1 text-slate-400 hover:bg-white">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={vehicleQuery}
                      onChange={(e) => setVehicleQuery(e.target.value)}
                      placeholder="Search plate number…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] text-charcoal-900 placeholder-slate-400 hover:border-slate-300 focus:border-accent-500 focus:outline-none"
                    />
                    {vehicleResults.length > 0 && (
                      <div className="absolute left-0 right-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-elevated">
                        {vehicleResults.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setVehicle(v);
                              setVehicleResults([]);
                            }}
                            className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-slate-50"
                          >
                            <span className="text-[13.5px] font-semibold text-charcoal-900">{v.plateNumber}</span>
                            <span className="text-[11.5px] text-slate-400">
                              {v.clientName} · {v.clientPhone}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  <AlertCircle size={15} /> {uploadError}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded-xl bg-charcoal-900 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-charcoal-800 disabled:opacity-60"
              >
                {uploading ? "Reading report…" : "Upload & analyse"}
              </button>
              <p className="text-center text-[11.5px] leading-snug text-slate-400">
                Searchable PDFs are read instantly. Scanned PDFs need the Mistral OCR connector (Settings → Connectors).
              </p>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
