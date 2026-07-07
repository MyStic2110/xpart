import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertCircle, Receipt, Car, User } from "lucide-react";
import { api, JobCardDetail } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function JobCardDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [detail, setDetail] = useState<JobCardDetail | null>(null);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [notice, setNotice] = useState("");

  function load() {
    api.getJobCardDetail(id).then(setDetail).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    load();
  }, [id]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function complete() {
    setCompleting(true);
    setError("");
    try {
      const result = await api.completeJobCard(id);
      setNotice(result.alreadyExisted ? "Invoice already exists for this job card" : "Job card completed — invoice generated");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not complete job card");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 sm:px-12 py-10">
          <Link to="/job-cards" className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-charcoal-900">
            <ArrowLeft size={14} /> Back to job cards
          </Link>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600">
              <CheckCircle2 size={15} /> <span>{notice}</span>
            </div>
          )}

          {!detail ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="mt-4 animate-slideUp">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-[1.5rem] font-semibold text-charcoal-900 tracking-tight">
                    Job Card · {detail.jobCard.jobDate}
                  </h1>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 capitalize">
                    {detail.jobCard.status.replace("_", " ")}
                  </span>
                </div>
                {detail.jobCard.status !== "completed" && detail.jobCard.status !== "billed" && (
                  <button
                    onClick={complete}
                    disabled={completing}
                    className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
                  >
                    <Receipt size={15} />
                    {completing ? "Processing..." : "Mark Complete & Generate Invoice"}
                  </button>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                  <div className="flex items-center gap-2 mb-3">
                    <User size={15} className="text-slate-400" />
                    <h3 className="text-[14px] font-semibold text-charcoal-900">Client</h3>
                  </div>
                  <p className="text-[14px] font-medium text-charcoal-900">{detail.client?.name}</p>
                  <p className="text-[13px] text-slate-400">{detail.client?.phone}</p>
                  {detail.client?.address && <p className="text-[13px] text-slate-400 mt-1">{detail.client.address}</p>}
                </div>

                <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Car size={15} className="text-slate-400" />
                    <h3 className="text-[14px] font-semibold text-charcoal-900">Vehicle</h3>
                  </div>
                  <p className="text-[14px] font-medium text-charcoal-900">{detail.vehicle?.plateNumber}</p>
                  <p className="text-[13px] text-slate-400">
                    {detail.vehicle?.makeName} {detail.vehicle?.modelName} {detail.vehicle?.segment ? `· ${detail.vehicle.segment}` : ""}
                  </p>
                  {detail.vehicle?.odometerReading && (
                    <p className="text-[13px] text-slate-400 mt-1">{detail.vehicle.odometerReading.toLocaleString("en-IN")} km</p>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                <h3 className="text-[14px] font-semibold text-charcoal-900 mb-4">Service / Product Items</h3>
                <div className="divide-y divide-slate-100">
                  {detail.lineItems.map((li) => (
                    <div key={li.id} className="flex items-center justify-between py-2.5 text-[13.5px]">
                      <span className="text-charcoal-900">{li.serviceName}</span>
                      <span className="text-slate-400">Qty {li.qty}</span>
                      <span className="font-medium text-charcoal-900">{rupees(li.qty * li.price)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-slate-100 pt-4 flex flex-col items-end gap-1 text-[13px]">
                  <div className="flex gap-8"><span className="text-slate-400">Subtotal</span><span className="font-medium text-charcoal-900 w-24 text-right">{rupees(detail.jobCard.subtotal)}</span></div>
                  <div className="flex gap-8"><span className="text-slate-400">Discount</span><span className="font-medium text-charcoal-900 w-24 text-right">−{rupees(detail.jobCard.discount)}</span></div>
                  <div className="flex gap-8"><span className="text-slate-400">Tax ({detail.jobCard.taxPercent}%)</span><span className="font-medium text-charcoal-900 w-24 text-right">—</span></div>
                  <div className="flex gap-8 text-[15px]"><span className="font-semibold text-charcoal-900">Total</span><span className="font-semibold text-charcoal-900 w-24 text-right">{rupees(detail.jobCard.total)}</span></div>
                </div>
                {detail.serviceAdvisorName && (
                  <p className="mt-3 text-[12px] text-slate-400">Service Advisor: {detail.serviceAdvisorName}</p>
                )}
              </div>

              {detail.invoice && (
                <button
                  onClick={() => navigate(`/billing/${detail.invoice!.id}`)}
                  className="mt-6 w-full rounded-xl2 border border-accent-500/20 bg-accent-500/5 p-5 text-left transition-colors hover:bg-accent-500/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium text-accent-700">Invoice generated — click to collect payment</p>
                      <p className="text-[12px] text-slate-500">#{detail.invoice.id.slice(0, 8)} · {rupees(detail.invoice.total)}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-accent-600 capitalize">
                      {detail.invoice.status}
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
