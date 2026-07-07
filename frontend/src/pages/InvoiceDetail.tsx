import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle, CheckCircle2, Wallet, Sparkles } from "lucide-react";
import { api, InvoiceDetail, Payment } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import Dropdown from "../components/Dropdown";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const MODE_LABELS: Record<Payment["mode"], string> = { cash: "Cash", upi: "UPI", card: "Card", wallet: "Wallet", points: "Points" };

export default function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"cash" | "upi" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [paying, setPaying] = useState(false);
  const [redeemPts, setRedeemPts] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  function load() {
    api.getInvoiceDetail(id).then((d) => {
      setDetail(d);
      setAmount((d.balanceDue / 100).toFixed(2));
    }).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    load();
  }, [id]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPaying(true);
    try {
      const res = await api.recordPayment(id, { mode, amount: Number(amount), txnRef: txnRef || undefined });
      setNotice(res.earnedPoints > 0 ? `Payment recorded · +${res.earnedPoints} points earned` : "Payment recorded");
      setTxnRef("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not record payment");
    } finally {
      setPaying(false);
    }
  }

  async function submitRedeem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setRedeeming(true);
    try {
      const res = await api.redeemPoints(id, Number(redeemPts));
      setNotice(`Redeemed ${res.redeemedPoints} points (${rupees(res.redeemedValue)})`);
      setRedeemPts("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not redeem points");
    } finally {
      setRedeeming(false);
    }
  }

  const isSettled = detail?.invoice.status === "paid" || detail?.invoice.status === "cancelled";
  // Points are worth money up to whatever is still owed, capped by the balance.
  const redeemRate = detail ? detail.redeemPaisePerPoint : 0;
  const maxRedeemablePoints =
    detail && redeemRate > 0 ? Math.min(detail.pointsBalance, Math.floor(detail.balanceDue / redeemRate)) : 0;
  const redeemValuePreview = Number(redeemPts) > 0 && redeemRate > 0 ? Number(redeemPts) * redeemRate : 0;

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 sm:px-12 py-10">
          <Link to="/billing" className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-charcoal-900">
            <ArrowLeft size={14} /> Back to billing
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
                    Invoice · {detail.client?.name}
                  </h1>
                  <p className="text-[13px] text-slate-400">
                    {detail.invoice.invoiceNo ? `${detail.invoice.invoiceNo} · ` : ""}
                    {detail.client?.phone} · {detail.vehicle?.plateNumber}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {(detail.invoice.status === "paid" || detail.invoice.status === "partial") && (
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-charcoal-800 transition-colors"
                    >
                      Print / Save PDF
                    </button>
                  )}
                  <span className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize ${
                    detail.invoice.status === "paid" ? "bg-emerald-50 text-emerald-600" :
                    detail.invoice.status === "partial" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                  }`}>
                    {detail.invoice.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                <h3 className="text-[14px] font-semibold text-charcoal-900 mb-4">Items</h3>
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
                  <div className="flex gap-8"><span className="text-slate-400">Subtotal</span><span className="font-medium text-charcoal-900 w-24 text-right">{rupees(detail.invoice.subtotal)}</span></div>
                  <div className="flex gap-8"><span className="text-slate-400">Discount</span><span className="font-medium text-charcoal-900 w-24 text-right">−{rupees(detail.invoice.discount)}</span></div>
                  <div className="flex gap-8 text-[15px]"><span className="font-semibold text-charcoal-900">Total</span><span className="font-semibold text-charcoal-900 w-24 text-right">{rupees(detail.invoice.total)}</span></div>
                  <div className="flex gap-8"><span className="text-slate-400">Paid so far</span><span className="font-medium text-emerald-600 w-24 text-right">{rupees(detail.paidSoFar)}</span></div>
                  <div className="flex gap-8 text-[15px]"><span className="font-semibold text-charcoal-900">Balance due</span><span className="font-semibold text-charcoal-900 w-24 text-right">{rupees(detail.balanceDue)}</span></div>
                </div>
              </div>

              {detail.payments.length > 0 && (
                <div className="mt-6 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                  <h3 className="text-[14px] font-semibold text-charcoal-900 mb-3">Payment history</h3>
                  <div className="divide-y divide-slate-100">
                    {detail.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2.5 text-[13px]">
                        <span className="font-medium text-charcoal-900">{MODE_LABELS[p.mode]}</span>
                        <span className="text-slate-400">{new Date(p.paidAt).toLocaleString("en-IN")}</span>
                        <span className="font-medium text-charcoal-900">{rupees(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isSettled && detail.loyaltyEnabled && detail.pointsBalance > 0 && (
                <div className="mt-6 rounded-xl2 border border-violet-100 bg-violet-50/40 p-5 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-charcoal-900">
                      <Sparkles size={15} className="text-violet-500" /> Redeem loyalty points
                    </h3>
                    <span className="text-[12px] text-slate-500 text-right">
                      Balance: <span className="font-semibold text-violet-600">{detail.pointsBalance} pts</span> ·{" "}
                      <span className="text-slate-400">1 pt = {rupees(redeemRate)} (180d expiry)</span>
                    </span>
                  </div>
                  {maxRedeemablePoints <= 0 ? (
                    <p className="text-[12.5px] text-slate-400">Balance due is below the value of a single point — nothing to redeem here.</p>
                  ) : (
                    <form onSubmit={submitRedeem} className="flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-[12px] font-medium text-slate-400">Points to redeem</label>
                        <input
                          type="number"
                          min={1}
                          max={maxRedeemablePoints}
                          step="1"
                          value={redeemPts}
                          onChange={(e) => setRedeemPts(e.target.value)}
                          placeholder={`up to ${maxRedeemablePoints}`}
                          className="mt-1 block w-36 rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setRedeemPts(String(maxRedeemablePoints))}
                        className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-[12.5px] font-medium text-violet-600 hover:bg-violet-50"
                      >
                        Max ({maxRedeemablePoints})
                      </button>
                      {redeemValuePreview > 0 && (
                        <p className="text-[12.5px] text-slate-500">
                          = <span className="font-semibold text-violet-600">{rupees(redeemValuePreview)}</span> off balance
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={redeeming || !(Number(redeemPts) > 0)}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {redeeming ? "Redeeming..." : "Redeem"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {!isSettled && (
                <div className="mt-6 rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                  <h3 className="text-[14px] font-semibold text-charcoal-900 mb-4">Collect payment</h3>
                  <form onSubmit={submitPayment} className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-slate-400">Mode</label>
                      <Dropdown
                        value={mode}
                        onChange={(v) => setMode(v as "cash" | "upi" | "card")}
                        className="mt-1 w-32"
                        size="sm"
                        options={(["cash", "upi", "card"] as const).map((m) => ({ value: m, label: MODE_LABELS[m] }))}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-400">Amount (₹)</label>
                      <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-400">Reference (optional)</label>
                      <input value={txnRef} onChange={(e) => setTxnRef(e.target.value)} className="mt-1 block w-40 rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                    </div>
                    <button type="submit" disabled={paying} className="rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                      {paying ? "Recording..." : "Record payment"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Hidden print section, visible only during print */}
      {detail && (
        <div id="print-section" className="hidden print:block w-full max-w-2xl mx-auto p-8 bg-white text-charcoal-900 font-sans">
          {/* Header */}
          <div className="text-center pb-6 border-b border-slate-200">
            <h1 className="text-[20px] font-bold tracking-wide uppercase text-charcoal-900">{orgName}</h1>
            <p className="text-[12px] text-slate-500 mt-1">Premium Car Care & Auto Detailing Services</p>
            <p className="text-[10px] text-slate-400 mt-0.5">TAX INVOICE</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mt-6 text-[12px] pb-6 border-b border-slate-100">
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Invoice Details</p>
              <p className="mt-1"><span className="text-slate-500">Invoice ID:</span> <span className="font-semibold">{detail.invoice.id.slice(0, 8).toUpperCase()}</span></p>
              <p><span className="text-slate-500">Date:</span> <span className="font-medium">{new Date(detail.invoice.createdAt).toLocaleDateString('en-IN')}</span></p>
              <p><span className="text-slate-500">Status:</span> <span className="font-semibold text-emerald-600 uppercase text-[11px]">{detail.invoice.status}</span></p>
            </div>
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Client & Vehicle</p>
              <p className="mt-1"><span className="text-slate-500">Name:</span> <span className="font-medium">{detail.client?.name}</span></p>
              <p><span className="text-slate-500">Phone:</span> <span className="font-medium">{detail.client?.phone}</span></p>
              <p><span className="text-slate-500">Vehicle:</span> <span className="font-bold tracking-wide">{detail.vehicle?.plateNumber}</span></p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mt-6">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                  <th className="py-2">Service Description</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.lineItems.map((item) => (
                  <tr key={item.id} className="text-slate-700">
                    <td className="py-3 font-medium text-charcoal-900">{item.serviceName}</td>
                    <td className="py-3 text-center">{item.qty}</td>
                    <td className="py-3 text-right">{rupees(item.price)}</td>
                    <td className="py-3 text-right font-medium">{rupees(item.qty * item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Breakdown */}
          <div className="mt-8 border-t border-slate-200 pt-4 flex flex-col items-end gap-1.5 text-[12px] ml-auto w-72">
            <div className="flex justify-between w-full">
              <span className="text-slate-400">Subtotal</span>
              <span className="font-medium text-charcoal-900">{rupees(detail.invoice.subtotal)}</span>
            </div>
            {detail.invoice.discount > 0 && (
              <div className="flex justify-between w-full">
                <span className="text-slate-400 flex items-center gap-1.5">
                  Discount
                  {detail.invoice.appliedOfferCode && (
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 border border-sky-100 text-[9px] font-mono text-sky-600">
                      {detail.invoice.appliedOfferCode}
                    </span>
                  )}
                </span>
                <span className="font-medium text-red-500">−{rupees(detail.invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between w-full text-[14px] border-t border-slate-100 pt-2 font-bold text-charcoal-900">
              <span>Total Amount</span>
              <span>{rupees(detail.invoice.total)}</span>
            </div>
            <div className="flex justify-between w-full text-[12px] text-emerald-600">
              <span>Amount Paid</span>
              <span>{rupees(detail.paidSoFar)}</span>
            </div>
            {detail.balanceDue > 0 && (
              <div className="flex justify-between w-full text-[13px] text-red-500 font-bold border-t border-dashed border-slate-100 pt-1.5">
                <span>Balance Due</span>
                <span>{rupees(detail.balanceDue)}</span>
              </div>
            )}
          </div>

          {/* Footer message */}
          <div className="text-center mt-12 text-[10px] text-slate-400 pt-6 border-t border-slate-100">
            <p>Thank you for choosing {orgName}!</p>
            <p className="mt-0.5">Please visit again for detailing, polishing & ceramic coatings.</p>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
