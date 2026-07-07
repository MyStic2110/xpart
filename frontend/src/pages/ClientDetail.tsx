import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Car, Wallet, Star, Phone, MessageCircle, Tag, Gift } from "lucide-react";
import { api, ClientDetail } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-500",
  in_progress: "bg-amber-50 text-amber-600",
  completed: "bg-emerald-50 text-emerald-600",
  billed: "bg-accent-500/10 text-accent-600",
  cancelled: "bg-red-50 text-red-600",
};

const APPT_STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-slate-100 text-slate-500",
  confirmed: "bg-accent-500/10 text-accent-600",
  completed: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-red-50 text-red-600",
  no_show: "bg-amber-50 text-amber-600",
};

export default function ClientDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    api.getClientDetail(id).then(setDetail).catch((err) => setError(err.message));
  }, [id]);

  async function setApptStatus(apptId: string, status: "confirmed" | "completed" | "cancelled" | "no_show") {
    try {
      await api.updateAppointmentStatus(apptId, status);
      const res = await api.getClientDetail(id);
      setDetail(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update appointment");
    }
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const s = detail?.summary;

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 sm:px-12 py-10">
          <Link to="/clients" className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-charcoal-900">
            <ArrowLeft size={14} /> Back to clients
          </Link>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          {!detail ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="mt-4 animate-slideUp">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-[1.6rem] font-semibold text-charcoal-900 tracking-tight">{detail.client.name}</h1>
                    {detail.client.clientType === "third_party" && (
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-600">Third-party vendor</span>
                    )}
                  </div>
                  <p className="mt-1 text-[14px] text-slate-400">
                    {detail.client.phone}
                    {detail.client.sourceOfClient ? ` · via ${detail.client.sourceOfClient}` : ""}
                    {detail.client.referralCode ? ` · ${detail.client.referralCode}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {detail.client.clientType !== "third_party" && (
                    <a
                      href={`https://wa.me/91${detail.client.phone}?text=${encodeURIComponent(
                        `Hi ${detail.client.name}! 👋\n\n🎁 *Invite your Friends & Earn points*\nYou & your friend will each get *500 points* on your friend's first billing.\n\nYour referral code:\n*${detail.client.referralCode}*\n\nShare this code with friends — they mention it on their first visit, and you both earn!`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/40 px-3.5 py-2 text-[13px] font-medium text-violet-700 hover:bg-violet-50"
                    >
                      <Gift size={14} /> Referral invite
                    </a>
                  )}
                  <a href={`tel:${detail.client.phone}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-charcoal-900 hover:bg-slate-50">
                    <Phone size={14} /> Call
                  </a>
                  <a href={`https://wa.me/91${detail.client.phone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-[13px] font-medium text-emerald-600 hover:bg-emerald-50">
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                </div>
              </div>

              {/* Summary stats */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Total visits", value: s?.totalVisits ?? 0 },
                  { label: "Lifetime spend", value: rupees(s?.totalSpendings ?? 0) },
                  detail.client.clientType === "third_party"
                    ? { label: "Credit outstanding", value: rupees(detail.credit?.totalOutstanding ?? 0) }
                    : { label: "Reward points", value: s?.rewardPoints ?? 0 },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl2 border border-slate-100 bg-white p-4 shadow-card">
                    <p className="text-[12px] font-medium text-slate-400">{m.label}</p>
                    <p className="mt-1.5 text-[20px] font-semibold text-charcoal-900">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Third-party credit ledger — one row per open vehicle invoice; collect cash and close them one by one. */}
              {detail.client.clientType === "third_party" && detail.credit && (
                <div className="mt-6 rounded-xl2 border border-violet-100 bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-semibold text-charcoal-900">Credit ledger — open vehicle invoices</h3>
                    <span className="text-[13px] font-semibold text-amber-600">{rupees(detail.credit.totalOutstanding)} due</span>
                  </div>
                  {detail.credit.openInvoices.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">All settled — no credit outstanding. 🎉</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11.5px] font-medium text-slate-400">
                            <th className="py-2.5 pr-4">Vehicle / visit</th>
                            <th className="py-2.5 pr-4">Invoice</th>
                            <th className="py-2.5 pr-4">Total</th>
                            <th className="py-2.5 pr-4">Paid</th>
                            <th className="py-2.5 pr-4">Balance</th>
                            <th className="py-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="text-[13px]">
                          {/* Grouped by vehicle number — the plate is the tracking key; each visit closes individually. */}
                          {(() => {
                            const groups = new Map<string, typeof detail.credit.openInvoices>();
                            for (const inv of detail.credit.openInvoices) {
                              const g = groups.get(inv.plateNumber) ?? [];
                              g.push(inv);
                              groups.set(inv.plateNumber, g);
                            }
                            return [...groups.entries()].map(([plate, invs]) => {
                              const plateDue = invs.reduce((s, i) => s + i.balance, 0);
                              return (
                                <Fragment key={plate}>
                                  <tr className="border-t border-slate-100 bg-slate-50/60">
                                    <td colSpan={4} className="py-2 pr-4">
                                      <span className="font-semibold text-charcoal-900 tracking-wide">{plate}</span>
                                      <span className="ml-2 text-[11px] text-slate-400">{invs.length} open visit{invs.length > 1 ? "s" : ""}</span>
                                    </td>
                                    <td colSpan={2} className="py-2 pr-4 font-semibold text-amber-600">{rupees(plateDue)} due</td>
                                  </tr>
                                  {invs.map((inv) => (
                                    <tr key={inv.invoiceId} className="border-t border-slate-50">
                                      <td className="py-2.5 pr-4 pl-4 text-slate-500">{inv.jobDate}</td>
                                      <td className="py-2.5 pr-4 text-slate-500">{inv.invoiceNo ?? "—"}</td>
                                      <td className="py-2.5 pr-4">{rupees(inv.total)}</td>
                                      <td className="py-2.5 pr-4 text-emerald-600">{inv.paid > 0 ? rupees(inv.paid) : "—"}</td>
                                      <td className="py-2.5 pr-4 font-semibold text-amber-600">{rupees(inv.balance)}</td>
                                      <td className="py-2.5 text-right">
                                        <button
                                          onClick={() => navigate(`/billing/${inv.invoiceId}`)}
                                          className="rounded-lg bg-charcoal-900 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-charcoal-800"
                                        >
                                          Collect
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </Fragment>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
                {/* Visit history */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                  <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Visit history</h3>
                  {detail.visits.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">No visits recorded.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {detail.visits.map((v) => (
                        <div
                          key={v.jobCardId}
                          onClick={() => navigate(`/job-cards/${v.jobCardId}`)}
                          className="flex items-center justify-between py-3 cursor-pointer hover:bg-slate-50/60 -mx-2 px-2 rounded-lg"
                        >
                          <div>
                            <p className="text-[13.5px] font-medium text-charcoal-900">{v.services.join(", ") || "—"}</p>
                            <p className="text-[12px] text-slate-400">{v.jobDate}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[13.5px] font-medium text-charcoal-900">{rupees(v.total)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_STYLES[v.status] ?? "bg-slate-100 text-slate-500"}`}>
                              {v.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Appointments & Bookings history */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card mt-6">
                  <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Bookings & Appointments</h3>
                  {!detail.appointments || detail.appointments.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-400">No appointments scheduled.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {detail.appointments.map((appt) => {
                        const message = encodeURIComponent(
                          appt.status === "scheduled" || appt.status === "confirmed"
                            ? `Hi ${detail.client.name}, reminding you of your detailing appointment at Xpart Automotive (${appt.branchName}) on ${appt.scheduledDate} at ${appt.scheduledTime || "scheduled slot"}. Please bring your vehicle! Reg, Xpart team.`
                            : appt.status === "no_show"
                            ? `Hi ${detail.client.name}, we missed you today for your vehicle appointment at Xpart Automotive (${appt.branchName}). Shall we reschedule your slot for tomorrow? Let us know! Reg, Xpart team.`
                            : appt.status === "cancelled"
                            ? `Hi ${detail.client.name}, we noticed your appointment at Xpart Automotive (${appt.branchName}) was cancelled. Let us know if you want to book another slot this week! Reg, Xpart team.`
                            : `Hi ${detail.client.name}, thank you for visiting Xpart Automotive (${appt.branchName})! We hope your vehicle is shining. Please leave us a review here: https://g.page/xpart-automotive/review. Reg, Xpart team.`
                        );
                        const whatsappLink = `https://wa.me/91${detail.client.phone}?text=${message}`;
                        
                        return (
                          <div key={appt.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-[13.5px] font-medium text-charcoal-900">{appt.serviceName ?? "Service booking"}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${APPT_STATUS_STYLES[appt.status]}`}>
                                  {appt.status.replace("_", " ")}
                                </span>
                              </div>
                              <p className="text-[12px] text-slate-400 mt-0.5">
                                {appt.scheduledDate} · {appt.scheduledTime || "Flexible time"} · {appt.branchName}
                              </p>
                              {appt.notes && <p className="text-[11.5px] text-slate-400 mt-1 italic">Note: {appt.notes}</p>}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Status update actions */}
                              {(appt.status === "scheduled" || appt.status === "confirmed") && (
                                <div className="flex items-center gap-1">
                                  {appt.status === "scheduled" && (
                                    <button
                                      onClick={() => setApptStatus(appt.id, "confirmed")}
                                      className="rounded-lg bg-accent-500/10 px-2 py-1 text-[11px] font-medium text-accent-600 hover:bg-accent-500/20"
                                    >
                                      Confirm
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setApptStatus(appt.id, "completed")}
                                    className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-100"
                                  >
                                    Complete
                                  </button>
                                  <button
                                    onClick={() => setApptStatus(appt.id, "no_show")}
                                    className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-100"
                                  >
                                    No-show
                                  </button>
                                  <button
                                    onClick={() => setApptStatus(appt.id, "cancelled")}
                                    className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                              
                              {/* WhatsApp CTA Action */}
                              <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-600 bg-emerald-50/30 hover:bg-emerald-50"
                              >
                                <MessageCircle size={12} />
                                {appt.status === "scheduled" || appt.status === "confirmed"
                                  ? "Send Reminder"
                                  : appt.status === "no_show"
                                  ? "Reschedule"
                                  : appt.status === "cancelled"
                                  ? "Ask to Re-book"
                                  : "Ask for Review"}
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Vehicles + profile */}
                <div className="space-y-6">
                  {s?.offers && s.offers.length > 0 && (
                    <div className="rounded-xl2 border border-rose-100 bg-rose-50/20 p-5 shadow-card animate-slideUp">
                      <div className="flex items-center gap-2 mb-3">
                        <Tag size={15} className="text-rose-600 animate-pulse" />
                        <h3 className="text-[14px] font-semibold text-rose-800">Targeted Offers (Pitch cues)</h3>
                      </div>
                      <div className="space-y-3">
                        {s.offers.map((off) => (
                          <div key={off.id} className="rounded-lg bg-white border border-rose-100/40 p-3 shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-600 font-mono border border-sky-100">
                                {off.code}
                              </span>
                              <span className="font-bold text-[12px] text-charcoal-900">{off.title}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500 leading-normal">{off.description}</p>
                            <div className="mt-2 flex items-center justify-between text-[11.5px] border-t border-slate-50 pt-2">
                              <span className="text-slate-400 font-medium">Value:</span>
                              <span className="font-bold text-rose-700">
                                {off.discountType === "flat" ? rupees(off.value) : `${off.value}% Off`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Car size={15} className="text-slate-400" />
                      <h3 className="text-[14px] font-semibold text-charcoal-900">Vehicles</h3>
                    </div>
                    {detail.vehicles.length === 0 ? (
                      <p className="text-sm text-slate-400">No vehicles on file.</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.vehicles.map((v) => (
                          <div key={v.id} className="flex items-center justify-between text-[13px]">
                            <span className="font-medium text-charcoal-900">{v.plateNumber}</span>
                            <span className="text-slate-400">{v.segment ?? ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Referral programme — code + manual send, attribution both ways */}
                  {detail.client.clientType !== "third_party" && (
                    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                      <div className="flex items-center gap-2 mb-3">
                        <Gift size={15} className="text-violet-500" />
                        <h3 className="text-[14px] font-semibold text-charcoal-900">Referral programme</h3>
                      </div>

                      <div className="rounded-xl bg-violet-50/50 border border-violet-100 p-3">
                        <p className="text-[10.5px] font-bold uppercase tracking-wider text-violet-500">Referral code</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="font-mono text-[16px] font-bold tracking-widest text-charcoal-900">{detail.client.referralCode}</span>
                          <a
                            href={`https://wa.me/91${detail.client.phone}?text=${encodeURIComponent(
                              `Hi ${detail.client.name}! 👋\n\n🎁 *Invite your Friends & Earn points*\nYou & your friend will each get *500 points* on your friend's first billing.\n\nYour referral code:\n*${detail.client.referralCode}*\n\nShare this code with friends — they mention it on their first visit, and you both earn!`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-emerald-600"
                          >
                            <MessageCircle size={13} /> Send to customer
                          </a>
                        </div>
                        <p className="mt-1.5 text-[11px] text-violet-600/80">You & your friend each get 500 points on the friend's first billing.</p>
                      </div>

                      <div className="mt-3 flex justify-between text-[13px]">
                        <span className="text-slate-400">Referred by</span>
                        {detail.referredBy ? (
                          <Link to={`/clients/${detail.referredBy.id}`} className="font-medium text-accent-600 hover:underline">
                            {detail.referredBy.name}
                          </Link>
                        ) : (
                          <span className="text-charcoal-900">—</span>
                        )}
                      </div>

                      <div className="mt-3">
                        <p className="text-[12px] font-medium text-slate-400 mb-1.5">
                          Friends referred {detail.referrals.length > 0 ? `(${detail.referrals.length})` : ""}
                        </p>
                        {detail.referrals.length === 0 ? (
                          <p className="text-[12px] text-slate-400 italic">No one has joined with this code yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {detail.referrals.map((r) => (
                              <div key={r.id} className="flex items-center justify-between text-[12.5px]">
                                <Link to={`/clients/${r.id}`} className="font-medium text-charcoal-900 hover:text-accent-600 truncate pr-2">
                                  {r.name}
                                </Link>
                                {r.hasBilled ? (
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                                    Billed {r.firstBilledOn ?? ""} ✓
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                                    Joined {r.joinedOn} · not billed yet
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                    <h3 className="text-[14px] font-semibold text-charcoal-900 mb-3">Profile</h3>
                    <div className="space-y-2 text-[13px]">
                      <div className="flex justify-between"><span className="text-slate-400">Gender</span><span className="capitalize text-charcoal-900">{s?.gender ?? "—"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Date of birth</span><span className="text-charcoal-900">{s?.dateOfBirth ?? "—"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Anniversary</span><span className="text-charcoal-900">{s?.anniversary ?? "—"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Last branch</span><span className="text-charcoal-900">{s?.branch ?? "—"}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
