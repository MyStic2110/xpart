import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  RefreshCw,
  Phone,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Target,
  Wallet,
  CalendarCheck,
  XCircle,
  X,
  Sparkles,
  Tag,
} from "lucide-react";
import { api, SalesAction, SalesActionStatus, AppointmentRecord, Client360 as Client360Type } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";

function rupees(paise?: number) {
  if (paise === undefined) return "₹0";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

type Tab = "queue" | "appointments";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-red-50 text-red-600",
  contacted: "bg-amber-50 text-amber-600",
  appointment_booked: "bg-accent-500/10 text-accent-600",
  rescheduled: "bg-slate-100 text-slate-500",
  declined: "bg-slate-100 text-slate-400",
  closed: "bg-emerald-50 text-emerald-600",
  expired: "bg-slate-100 text-slate-400",
};

const APPT_STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-500",
  confirmed: "bg-accent-500/10 text-accent-600",
  completed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-red-50 text-red-600",
  no_show: "bg-amber-50 text-amber-600",
};

// positive = overdue by N days, 0 = expiring today, negative = expires in N days
function dueDelta(dueDate: string): number {
  const due = new Date(dueDate + "T00:00:00");
  const now = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function dueLabel(delta: number): { text: string; className: string } {
  if (delta === 0) return { text: "Expiring today", className: "text-red-600 font-semibold" };
  if (delta < 0) return { text: `Expires in ${-delta}d`, className: "text-amber-600 font-medium" };
  if (delta <= 7) return { text: `${delta}d overdue`, className: "text-red-600 font-medium" };
  return { text: `${delta}d overdue`, className: "text-slate-400" };
}

function whatsappLink(phone: string, clientName: string, lastServices: string, lastVisitDate: string) {
  const msg = encodeURIComponent(
    `Hi ${clientName}, your last visit with us was on ${lastVisitDate} for ${lastServices}. It's due again — would you like to book a slot?`
  );
  return `https://wa.me/91${phone}?text=${msg}`;
}

export default function Client360() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [tab, setTab] = useState<Tab>("queue");
  const [actions, setActions] = useState<SalesAction[] | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [outcomeFor, setOutcomeFor] = useState<SalesAction | null>(null);
  const [outcome, setOutcome] = useState<SalesActionStatus>("contacted");
  const [note, setNote] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [client360, setClient360] = useState<Client360Type | null>(null);
  const { branchParam } = useBranch();

  function loadActions() {
    api.listSalesActions(undefined, branchParam).then(setActions).catch((err) => setError(err.message));
  }
  function loadAppointments() {
    api.listAppointments().then(setAppointments).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    loadAppointments();
  }, []);

  useEffect(() => {
    setActions(null);
    loadActions();
  }, [branchParam]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const result = await api.refreshSalesActions();
      setNotice(result.created > 0 ? `${result.created} new follow-up(s) added to the queue` : "Queue is up to date — nothing new is due");
      loadActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not refresh");
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    if (!actions) return [];
    const q = search.trim().toLowerCase();
    return actions.filter((a) => {
      const matchesSearch = !q || a.clientName.toLowerCase().includes(q) || a.clientPhone.includes(q) || (a.plateNumber ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [actions, search, statusFilter]);

  const isOpenStatus = (s: SalesActionStatus) => s === "pending" || s === "contacted" || s === "rescheduled";
  const openCount = actions?.filter((a) => isOpenStatus(a.status)).length ?? 0;
  const bookedCount = actions?.filter((a) => a.status === "appointment_booked").length ?? 0;
  // "Today's potential" = revenue from open leads inside the conversion sweet
  // spot (expiring within ±7 days) — the ones genuinely worth calling now.
  const todayPotential =
    actions?.filter((a) => isOpenStatus(a.status) && Math.abs(dueDelta(a.dueDate)) <= 7).reduce((s, a) => s + a.potentialRevenue, 0) ?? 0;
  const totalPotential = actions?.filter((a) => isOpenStatus(a.status)).reduce((s, a) => s + a.potentialRevenue, 0) ?? 0;

  function openOutcome(action: SalesAction) {
    setOutcomeFor(action);
    setOutcome("contacted");
    setNote("");
    setNextFollowUpDate("");
    setAppointmentDate("");
    setAppointmentTime("");
    setClient360(null);
    api.getClient360(action.clientId).then(setClient360).catch(() => {});
  }

  async function submitOutcome(e: React.FormEvent) {
    e.preventDefault();
    if (!outcomeFor) return;
    setSavingOutcome(true);
    setError("");
    try {
      await api.recordSalesOutcome(outcomeFor.id, {
        outcome,
        note,
        nextFollowUpDate: outcome === "rescheduled" ? nextFollowUpDate : undefined,
        appointmentDate: outcome === "appointment_booked" ? appointmentDate : undefined,
        appointmentTime: outcome === "appointment_booked" ? appointmentTime : undefined,
      });
      setOutcomeFor(null);
      setNotice("Outcome recorded");
      loadActions();
      loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save outcome");
    } finally {
      setSavingOutcome(false);
    }
  }

  async function setApptStatus(id: string, status: AppointmentRecord["status"]) {
    try {
      await api.updateAppointmentStatus(id, status);
      loadAppointments();
      loadActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not update appointment");
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-full mx-auto px-8 sm:px-12 py-10">
          <div className="flex items-center justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Client 360°</h1>
              <p className="mt-1 text-[14px] text-slate-400">
                Who's due for a repeat visit, what it's worth, and what to do about it today.
              </p>
            </div>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh queue"}
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              label="Potential revenue today"
              value={`₹${(todayPotential / 100).toLocaleString("en-IN")}`}
              icon={Target}
              loading={!actions}
              info="From leads in the conversion sweet-spot — expiring within ±7 days of today."
            />
            <StatCard label="Total potential (all open)" value={`₹${(totalPotential / 100).toLocaleString("en-IN")}`} icon={Wallet} loading={!actions} />
            <StatCard label="Open follow-ups" value={openCount} icon={CheckCircle2} loading={!actions} />
            <StatCard label="Appointments booked" value={bookedCount} icon={CalendarCheck} loading={!actions} />
          </div>

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

          <div className="mt-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {(["queue", "appointments"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
                  tab === t ? "bg-white text-charcoal-900 shadow-card" : "text-slate-500 hover:text-charcoal-900"
                }`}
              >
                {t === "queue" ? "Action queue" : "Appointments"}
              </button>
            ))}
          </div>

          {tab === "queue" ? (
            <>
              <div className="mt-6">
                <TableToolbar
                  search={search}
                  onSearch={setSearch}
                  placeholder="Search client, phone, vehicle..."
                  onDownload={() => {}}
                  filters={
                    <Dropdown
                      value={statusFilter}
                      onChange={setStatusFilter}
                      className="w-48"
                      size="sm"
                      capitalize
                      options={[
                        { value: "all", label: "All statuses" },
                        ...["pending", "contacted", "appointment_booked", "rescheduled", "declined", "closed"].map((s) => ({ value: s, label: s.replace("_", " ") })),
                      ]}
                    />
                  }
                />
              </div>

              <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                        <th className="px-5 py-3.5">Client</th>
                        <th className="px-5 py-3.5">Due for</th>
                        <th className="px-5 py-3.5">Last service with us</th>
                        <th className="px-5 py-3.5">Expiry</th>
                        <th className="px-5 py-3.5">Potential</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!actions ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 7 }).map((__, j) => (
                              <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                            ))}
                          </tr>
                        ))
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-16 text-center">
                            <Target size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">Nothing due right now</p>
                            <p className="mt-1 text-sm text-slate-400">Hit "Refresh queue" after completing more job cards to recompute.</p>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((a) => {
                          const delta = dueDelta(a.dueDate);
                          const label = dueLabel(delta);
                          const isOpen = a.status === "pending" || a.status === "contacted" || a.status === "rescheduled";
                          const hot = isOpen && delta >= -7 && delta <= 7; // within the conversion sweet-spot
                          return (
                            <tr key={a.id} className={`text-[13.5px] text-charcoal-900 hover:bg-slate-50/60 ${hot ? "bg-red-50/40" : ""}`}>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <p className="font-medium">
                                  <Link to={`/clients/${a.clientId}`} className="text-charcoal-900 hover:underline">
                                    {a.clientName}
                                  </Link>
                                </p>
                                <p className="text-[12px] text-slate-400">{a.clientPhone}{a.plateNumber ? ` · ${a.plateNumber}` : ""}</p>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap font-medium">{a.serviceName}</td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-slate-700">{a.lastVisitServices}</span>
                                  <span className="text-[11px] text-slate-400">{a.lastVisitDate}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className={label.className}>{label.text}</span>
                                  <span className="text-[11px] text-slate-400">{a.dueDate}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 font-medium whitespace-nowrap">₹{(a.potentialRevenue / 100).toLocaleString("en-IN")}</td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${STATUS_STYLES[a.status]}`}>
                                  {a.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right whitespace-nowrap">
                                {isOpen && (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <a href={`tel:${a.clientPhone}`} title="Call" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900">
                                      <Phone size={15} strokeWidth={1.75} />
                                    </a>
                                    <a href={whatsappLink(a.clientPhone, a.clientName, a.lastVisitServices, a.lastVisitDate)} target="_blank" rel="noreferrer" title="WhatsApp" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600">
                                      <MessageCircle size={15} strokeWidth={1.75} />
                                    </a>
                                    <button onClick={() => openOutcome(a)} className="rounded-lg bg-charcoal-900 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-charcoal-800">
                                      Log outcome
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                      <th className="px-5 py-3.5">Client</th>
                      <th className="px-5 py-3.5">Service</th>
                      <th className="px-5 py-3.5">Scheduled</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Intelligence & Action</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!appointments ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((__, j) => (
                            <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                          ))}
                        </tr>
                      ))
                    ) : appointments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-16 text-center">
                          <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                          <p className="mt-3 text-sm font-medium text-charcoal-900">No appointments booked yet</p>
                        </td>
                      </tr>
                    ) : (
                      appointments.map((appt) => (
                        <tr key={appt.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <p className="font-medium">{appt.clientName}</p>
                            <p className="text-[12px] text-slate-400">{appt.clientPhone}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{appt.serviceName ?? "—"}</td>
                          <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{appt.scheduledDate} {appt.scheduledTime}</td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${APPT_STATUS_STYLES[appt.status]}`}>
                              {appt.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {(() => {
                              const message = encodeURIComponent(
                                appt.status === "scheduled" || appt.status === "confirmed"
                                  ? `Hi ${appt.clientName}, reminding you of your detailing appointment at Xpart Automotive (${appt.branchName}) on ${appt.scheduledDate} at ${appt.scheduledTime || "scheduled slot"}. Please bring your vehicle! Reg, Xpart team.`
                                  : appt.status === "no_show"
                                  ? `Hi ${appt.clientName}, we missed you today for your vehicle appointment at Xpart Automotive (${appt.branchName}). Shall we reschedule your slot for tomorrow? Let us know! Reg, Xpart team.`
                                  : appt.status === "cancelled"
                                  ? `Hi ${appt.clientName}, we noticed your appointment at Xpart Automotive (${appt.branchName}) was cancelled. Let us know if you want to book another slot this week! Reg, Xpart team.`
                                  : `Hi ${appt.clientName}, thank you for visiting Xpart Automotive (${appt.branchName})! We hope your vehicle is shining. Please leave us a review here: https://g.page/xpart-automotive/review. Reg, Xpart team.`
                              );
                              const whatsappLink = `https://wa.me/91${appt.clientPhone}?text=${message}`;
                              
                              const label =
                                appt.status === "scheduled" || appt.status === "confirmed"
                                  ? "Upcoming slot"
                                  : appt.status === "no_show"
                                  ? "Customer missed slot"
                                  : appt.status === "cancelled"
                                  ? "Cancelled booking"
                                  : "Completed service";
                                  
                              const actionLabel =
                                appt.status === "scheduled" || appt.status === "confirmed"
                                  ? "Send Reminder"
                                  : appt.status === "no_show"
                                  ? "Reschedule via WhatsApp"
                                  : appt.status === "cancelled"
                                  ? "Ask to Re-book"
                                  : "Ask for Review";
                                  
                              return (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] text-slate-400 font-medium">{label}</span>
                                  <a
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                                  >
                                    <MessageCircle size={12} />
                                    {actionLabel}
                                  </a>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            {(appt.status === "scheduled" || appt.status === "confirmed") && (
                              <div className="flex items-center justify-end gap-1.5">
                                {appt.status === "scheduled" && (
                                  <button onClick={() => setApptStatus(appt.id, "confirmed")} className="rounded-lg bg-accent-500/10 px-2.5 py-1.5 text-[11px] font-medium text-accent-600 hover:bg-accent-500/20">
                                    Confirm
                                  </button>
                                )}
                                <button onClick={() => setApptStatus(appt.id, "completed")} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-100">
                                  Completed
                                </button>
                                <button onClick={() => setApptStatus(appt.id, "no_show")} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-600 hover:bg-amber-100">
                                  No-show
                                </button>
                                <button onClick={() => setApptStatus(appt.id, "cancelled")} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-100">
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {outcomeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/30 animate-fadeIn">
          <div className="w-full max-w-md rounded-xl2 bg-white shadow-elevated animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-[16px] font-semibold text-charcoal-900">Log outcome</h2>
                <p className="text-[12px] text-slate-400">{outcomeFor.clientName} · {outcomeFor.serviceName}</p>
              </div>
              <button onClick={() => setOutcomeFor(null)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitOutcome} className="flex flex-col gap-4 px-6 py-6">
              {client360 && client360.offers && client360.offers.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/10 p-3.5 text-[12px] animate-slideUp">
                  <p className="font-semibold text-rose-800 flex items-center gap-1.5 mb-2">
                    <Sparkles size={13} className="animate-pulse" />
                    Targeted Offers (Pitch cues):
                  </p>
                  <div className="space-y-2">
                    {client360.offers.map((off) => (
                      <div key={off.id} className="bg-white border border-rose-100/40 rounded p-2.5 flex items-center justify-between shadow-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-charcoal-900 flex items-center gap-1">
                            <span className="bg-sky-50 px-1 py-0.2 rounded border border-sky-100 text-[9px] font-mono text-sky-600">
                              {off.code}
                            </span>
                            {off.title}
                          </p>
                          <p className="mt-0.5 text-slate-500 text-[10.5px] leading-tight break-words">{off.description}</p>
                        </div>
                        <span className="font-bold text-[11px] text-rose-700 shrink-0 ml-2">
                          {off.discountType === "flat" ? rupees(off.value) : `${off.value}% Off`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[13px] font-medium text-slate-500">Outcome</label>
                <Dropdown
                  value={outcome}
                  onChange={(v) => setOutcome(v as SalesActionStatus)}
                  className="mt-1.5 w-full"
                  options={[
                    { value: "contacted", label: "Contacted — no decision yet" },
                    { value: "appointment_booked", label: "Confirmed — book appointment" },
                    { value: "rescheduled", label: "Asked to follow up later" },
                    { value: "declined", label: "Not interested" },
                  ]}
                />
              </div>

              {outcome === "appointment_booked" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-medium text-slate-400">Appointment date</label>
                    <input type="date" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-slate-400">Time</label>
                    <input type="text" placeholder="10:00 AM" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                  </div>
                </div>
              )}

              {outcome === "rescheduled" && (
                <div>
                  <label className="text-[12px] font-medium text-slate-400">Follow up on</label>
                  <input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                </div>
              )}

              <div>
                <label className="text-[13px] font-medium text-slate-500">Notes *</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Called, busy today, follow up next Friday"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none"
                />
              </div>

              <button type="submit" disabled={savingOutcome} className="rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {savingOutcome ? "Saving..." : "Save outcome"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
