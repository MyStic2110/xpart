import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, CreditCard, DollarSign, Wallet, ShieldCheck, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, User, Car, X, Search } from "lucide-react";
import { api, Vendor, VendorLedgerGroup } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import FloatingInput from "../components/FloatingInput";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function VendorLedger() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [ledger, setLedger] = useState<VendorLedgerGroup[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState<VendorLedgerGroup | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});
  const [showSettled, setShowSettled] = useState(true);

  // Search, Period filtering, and Pagination state
  const [searchVal, setSearchVal] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 5;
  const [totalGroups, setTotalGroups] = useState(0);
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [totals, setTotals] = useState({
    creditOwed: 0,
    settled: 0,
    outstanding: 0,
    margin: 0,
    readyToSettle: 0,
  });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchVal]);

  function load(currentPage = page, currentSearch = search, currentPeriod = period) {
    api.listVendors().then((list) => {
      const found = list.find((v) => v.id === id);
      if (found) setVendor(found);
    }).catch((err) => setError(err.message));

    api.getVendorLedger(id, {
      search: currentSearch,
      period: currentPeriod,
      page: currentPage,
      limit,
    }).then((res) => {
      setLedger(res.data);
      setTotalGroups(res.total);
      setTotals(res.totals);
    }).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  useEffect(() => {
    load(page, search, period);
  }, [id, page, search, period]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const filteredLedger = useMemo<VendorLedgerGroup[]>(() => {
    if (!ledger) return [];
    if (showSettled) return ledger;
    return ledger.filter((g) => (g.totalPurchaseDue - g.totalPaidToVendor) > 0);
  }, [ledger, showSettled]);

  function openPay(g: VendorLedgerGroup) {
    const outstanding = g.totalPurchaseDue - g.totalPaidToVendor;
    setPayTarget(g);
    setPayAmount(String(outstanding / 100));
    setError("");
    setSuccess("");
    setShowPayModal(true);
  }

  async function handleSettle(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    setError("");
    setSuccess("");
    setPaying(true);

    try {
      const amount = Number(payAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid positive payment amount.");
      }

      await api.payVendorVehicle(id, payTarget.vehicleId, amount, paymentMode);
      setSuccess(`Recorded payment of ₹${amount.toLocaleString("en-IN")} successfully!`);
      setShowPayModal(false);
      load(page, search, period);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not record payment");
    } finally {
      setPaying(false);
    }
  }

  function toggleExpand(plate: string) {
    setExpandedVehicles((prev) => ({ ...prev, [plate]: !prev[plate] }));
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto no-print">
        <div className="max-w-6xl mx-auto px-8 sm:px-12 py-10">
          <Link to="/vendors" className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-charcoal-900 mb-4">
            <ArrowLeft size={14} /> Back to vendors
          </Link>

          {!vendor ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="animate-slideUp">
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">{vendor.name} · Credit Ledger</h1>
              <p className="mt-1 text-[14px] text-slate-400">Manage credit accounts and customer-matched settlements.</p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
                <StatCard label="Total Credit Purchased" value={rupees(totals.creditOwed)} icon={CreditCard} loading={!ledger} />
                <StatCard label="Outstanding Vendor Owed" value={rupees(totals.outstanding)} icon={Wallet} loading={!ledger} />
                <StatCard label="Ready to Settle (Customer Paid)" value={rupees(totals.readyToSettle)} icon={ShieldCheck} loading={!ledger} info="Vendor outstanding for vehicles where the customer has paid in full." />
                <StatCard label="Xpart Profit Margin" value={rupees(totals.margin)} icon={DollarSign} loading={!ledger} info="Markup margin between cost price and sale price for these parts." />
              </div>

              {success && (
                <div className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600">
                  <CheckCircle2 size={15} /> <span>{success}</span>
                </div>
              )}
              {error && !showPayModal && (
                <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              {/* Period Tabs (matching standard layout style) */}
              <div className="mt-8 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
                {(["all", "day", "week", "month"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setPage(1);
                    }}
                    className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
                      period === p
                        ? "bg-white text-charcoal-900 shadow-card"
                        : "text-slate-500 hover:text-charcoal-900"
                    }`}
                  >
                    {p === "all" ? "All Time" : p === "day" ? "Today" : p === "week" ? "This Week" : "This Month"}
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-xs">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    placeholder="Search plate, client, part..."
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13.5px] text-charcoal-900 placeholder-slate-400 focus:border-accent-500 focus:outline-none"
                  />
                </div>

                <div className="ml-auto flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSettled}
                      onChange={(e) => setShowSettled(e.target.checked)}
                      className="rounded border-slate-300 text-charcoal-900 focus:ring-charcoal-900 cursor-pointer"
                    />
                    Show settled vehicle accounts
                  </label>

                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-charcoal-900 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Print Statement
                  </button>
                </div>
              </div>

              <div className="mt-6">
                {!ledger ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                  </div>
                ) : filteredLedger.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-white p-12 text-center shadow-card animate-slideUp">
                    <CheckCircle2 size={36} strokeWidth={1.5} className="mx-auto text-emerald-500" />
                    <h4 className="mt-3 text-sm font-semibold text-charcoal-900">No accounts to display</h4>
                    <p className="mt-1 text-[13px] text-slate-400">All matching accounts are settled or none found for this filter.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredLedger.map((group) => {
                      const outstanding = group.totalPurchaseDue - group.totalPaidToVendor;
                      const isCustomerPaid = group.customerInvoiceStatus === "paid";
                      const isFullySettled = outstanding <= 0;
                      const isExpanded = expandedVehicles[group.plateNumber];

                      return (
                        <div key={group.plateNumber} className={`rounded-xl border border-slate-100 bg-white shadow-card overflow-hidden transition-all ${isCustomerPaid && !isFullySettled ? "border-l-4 border-l-emerald-500" : ""}`}>
                          {/* Header panel */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4">
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                <Car size={18} className="text-slate-500" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[15px] font-bold text-charcoal-900">{group.plateNumber}</span>
                                  <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase ${
                                    isCustomerPaid ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                    group.customerInvoiceStatus === "partial" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                    "bg-slate-100 text-slate-500"
                                  }`}>
                                    Cust: {group.customerInvoiceStatus}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-500">
                                  <User size={13} />
                                  <span>{group.clientName} ({group.clientPhone})</span>
                                  {group.customerInvoiceNo && (
                                    <span className="text-slate-400">· Inv {group.customerInvoiceNo}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-6">
                              <div className="text-[13px]">
                                <span className="block text-slate-400 font-medium">Vendor Due</span>
                                <span className={`font-semibold ${isFullySettled ? "text-slate-400 line-through" : "text-charcoal-900"}`}>
                                  {rupees(outstanding)}
                                </span>
                              </div>

                              <div className="text-[13px]">
                                <span className="block text-slate-400 font-medium">Margin</span>
                                <span className="font-semibold text-emerald-600">
                                  +{rupees(group.margin)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {!isFullySettled && (
                                  <button
                                    onClick={() => openPay(group)}
                                    className={`rounded-xl px-4 py-2 text-[12.5px] font-bold transition-all shadow-sm ${
                                      isCustomerPaid
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                        : "bg-charcoal-900 text-white hover:bg-charcoal-800"
                                    }`}
                                  >
                                    Pay Vendor
                                  </button>
                                )}
                                {isFullySettled && (
                                  <span className="rounded-xl bg-slate-100 px-3.5 py-2 text-[12px] font-bold text-slate-400">
                                    Settled ✓
                                  </span>
                                )}
                                <button
                                  onClick={() => toggleExpand(group.plateNumber)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-charcoal-900"
                                >
                                  {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Expanded items view */}
                          {isExpanded && (
                            <div className="bg-slate-50/50 border-t border-slate-100 px-5 py-4 divide-y divide-slate-100">
                              <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">Purchased Parts details</p>
                              {group.items.map((item) => {
                                const itemTotalCost = item.purchasePrice * item.quantity;
                                const itemTotalSale = item.salePrice * item.quantity;
                                const itemMargin = itemTotalSale - itemTotalCost;
                                return (
                                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 text-[13px] gap-2">
                                    <div>
                                      <span className="font-semibold text-charcoal-900">{item.productName}</span>
                                      <span className="ml-2 text-slate-400">Qty {item.quantity} {item.unit || ""}</span>
                                      <span className="block mt-0.5 text-[11px] text-slate-400">
                                        Lot #{item.lotNo} {item.supplierInvoiceNo ? `· Supp Inv: ${item.supplierInvoiceNo}` : ""}
                                      </span>
                                    </div>
                                    <div className="flex gap-6 text-[12px] text-slate-500 shrink-0">
                                      <div>
                                        <span>Cost:</span> <span className="font-medium text-charcoal-900">{rupees(itemTotalCost)}</span>
                                      </div>
                                      <div>
                                        <span>Sale:</span> <span className="font-medium text-charcoal-900">{rupees(itemTotalSale)}</span>
                                      </div>
                                      <div>
                                        <span>Paid:</span> <span className="font-medium text-slate-700">{rupees(item.vendorAmountPaid)}</span>
                                      </div>
                                      <div>
                                        <span>Status:</span> <span className={`font-semibold capitalize ${item.vendorPaidStatus === "paid" ? "text-emerald-600" : "text-amber-500"}`}>{item.vendorPaidStatus}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalGroups > limit && (
                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-[12.5px] text-slate-400">
                    Showing <span className="font-semibold text-charcoal-900">{Math.min(totalGroups, (page - 1) * limit + 1)}</span> to{" "}
                    <span className="font-semibold text-charcoal-900">{Math.min(totalGroups, page * limit)}</span> of{" "}
                    <span className="font-semibold text-charcoal-900">{totalGroups}</span> repair accounts
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(Math.ceil(totalGroups / limit), p + 1))}
                      disabled={page >= Math.ceil(totalGroups / limit)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Pay Vendor Modal */}
      {showPayModal && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/40 p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-elevated overflow-hidden animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Settle Vendor Invoice</h2>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>
            <form onSubmit={handleSettle} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 text-[13px] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Vehicle:</span>
                  <span className="font-bold text-charcoal-900">{payTarget.plateNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total parts cost:</span>
                  <span className="font-semibold text-charcoal-900">{rupees(payTarget.totalPurchaseDue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount paid so far:</span>
                  <span className="font-semibold text-charcoal-900">{rupees(payTarget.totalPaidToVendor)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/80 pt-1.5 mt-1 font-semibold text-[14px]">
                  <span className="text-charcoal-900">Outstanding:</span>
                  <span className="text-accent-700">{rupees(payTarget.totalPurchaseDue - payTarget.totalPaidToVendor)}</span>
                </div>
              </div>

              <FloatingInput
                label="Amount to pay (₹)"
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />

              <div className="space-y-1">
                <label className="text-[12px] font-medium text-slate-400">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-charcoal-900/10 focus:border-charcoal-900"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Online payment">Online payment</option>
                </select>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-[14px] font-medium text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="flex-1 rounded-xl bg-charcoal-900 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
                >
                  {paying ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden print section, visible only during print */}
      {vendor && (
        <div id="print-section" className="hidden print:block w-full max-w-3xl mx-auto p-8 bg-white text-charcoal-900 font-sans">
          {/* Header */}
          <div className="text-center pb-6 border-b border-slate-200">
            <h1 className="text-[20px] font-bold tracking-wide uppercase text-charcoal-900">{orgName}</h1>
            <p className="text-[12px] text-slate-500 mt-1">Vendor Account Statement</p>
            <p className="text-[10px] text-slate-400 mt-0.5">GENERATED ON {new Date().toLocaleDateString('en-IN')}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mt-6 text-[12px] pb-6 border-b border-slate-100">
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Vendor Details</p>
              <p className="mt-1"><span className="text-slate-500">Name:</span> <span className="font-semibold">{vendor.name}</span></p>
              <p><span className="text-slate-500">Contact:</span> <span className="font-medium">{vendor.contactNumber}</span></p>
              {vendor.email && <p><span className="text-slate-500">Email:</span> <span className="font-medium">{vendor.email}</span></p>}
              {vendor.address && <p><span className="text-slate-500">Address:</span> <span className="font-medium">{vendor.address}</span></p>}
            </div>
            <div>
              <p className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Statement Summary</p>
              <p className="mt-1"><span className="text-slate-500">Total Credit Purchased:</span> <span className="font-semibold">{rupees(totals.creditOwed)}</span></p>
              <p><span className="text-slate-500">Outstanding Owed:</span> <span className="font-semibold text-rose-600">{rupees(totals.outstanding)}</span></p>
              <p><span className="text-slate-500">Total Settled:</span> <span className="font-semibold text-emerald-600">{rupees(totals.settled)}</span></p>
              <p><span className="text-slate-500">Markup Margin:</span> <span className="font-semibold text-violet-600">{rupees(totals.margin)}</span></p>
            </div>
          </div>

          {/* Statement Items Table */}
          <div className="mt-6">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Repair & Parts Statement</h3>
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                  <th className="py-2">Vehicle</th>
                  <th className="py-2">Product Name</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Cost Price</th>
                  <th className="py-2 text-right">Sale Price</th>
                  <th className="py-2 text-right">Paid</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger && ledger.map((group) => (
                  group.items.map((item, idx) => (
                    <tr key={item.id} className="text-slate-700">
                      <td className="py-2">
                        {idx === 0 ? (
                          <div>
                            <span className="font-bold">{group.plateNumber}</span>
                            <span className="block text-[9px] text-slate-400">{group.clientName}</span>
                          </div>
                        ) : ""}
                      </td>
                      <td className="py-2 font-medium">{item.productName}</td>
                      <td className="py-2 text-center">{item.quantity} {item.unit || ""}</td>
                      <td className="py-2 text-right">{rupees(item.purchasePrice * item.quantity)}</td>
                      <td className="py-2 text-right">{rupees(item.salePrice * item.quantity)}</td>
                      <td className="py-2 text-right">{rupees(item.vendorAmountPaid)}</td>
                      <td className="py-2 text-right font-semibold uppercase text-[9px]">
                        <span className={item.vendorPaidStatus === "paid" ? "text-emerald-600" : "text-amber-600"}>
                          {item.vendorPaidStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
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
