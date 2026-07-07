import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Wallet, Repeat, Eye, XCircle, Plus, Truck, X } from "lucide-react";
import { api, ClientListItem } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 12;

type TypeTab = "all" | "customer" | "third_party";
type Segment = "all" | "active" | "churn" | "defected";

// Same recency thresholds as the dashboard segmentation and Client 360 churn flag.
function segmentOf(lastVisit: string | null): Exclude<Segment, "all"> {
  if (!lastVisit) return "defected";
  const days = Math.floor((Date.now() - new Date(lastVisit + "T00:00:00").getTime()) / 86400000);
  if (days <= 60) return "active";
  if (days <= 180) return "churn";
  return "defected";
}

export default function Clients() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [clients, setClients] = useState<ClientListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const segParam = searchParams.get("segment");
  const segment: Segment = segParam === "active" || segParam === "churn" || segParam === "defected" ? segParam : "all";
  const [typeTab, setTypeTab] = useState<TypeTab>("all");
  const [showAdd, setShowAdd] = useState(false);

  function setSegment(s: Segment) {
    if (s === "all") searchParams.delete("segment");
    else searchParams.set("segment", s);
    setSearchParams(searchParams, { replace: true });
  }

  // Add-client form state
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fSource, setFSource] = useState("");
  const [fType, setFType] = useState<"customer" | "third_party">("customer");
  const [fReferredBy, setFReferredBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function loadClients() {
    api.listClients().then(setClients).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    loadClients();
  }, []);

  useEffect(() => setPage(1), [search, typeTab, segment]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function submitClient(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!fName.trim() || fPhone.trim().length < 5) {
      setFormError("Name and a valid phone are required.");
      return;
    }
    setSaving(true);
    try {
      const created = await api.createClient({
        name: fName.trim(),
        phone: fPhone.trim(),
        address: fAddress.trim() || undefined,
        sourceOfClient: fSource.trim() || undefined,
        clientType: fType,
        referredByCode: fType === "customer" ? fReferredBy.trim() || undefined : undefined,
      });
      setShowAdd(false);
      setFName(""); setFPhone(""); setFAddress(""); setFSource(""); setFType("customer"); setFReferredBy("");
      loadClients();
      navigate(`/clients/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save client");
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    let rows = typeTab === "all" ? clients : clients.filter((c) => c.clientType === typeTab);
    // Segments describe the customer base only — vendors drop out when one is picked.
    if (segment !== "all") rows = rows.filter((c) => c.clientType !== "third_party" && segmentOf(c.lastVisit) === segment);
    if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    return rows;
  }, [clients, search, typeTab, segment]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const customers = clients?.filter((c) => c.clientType !== "third_party") ?? [];
  const vendors = clients?.filter((c) => c.clientType === "third_party") ?? [];
  const totalSpend = clients?.reduce((s, c) => s + c.totalSpend, 0) ?? 0;
  const repeatCount = customers.filter((c) => c.totalVisits > 1).length;
  const vendorOutstanding = vendors.reduce((s, c) => s + c.outstanding, 0);

  function exportCsv() {
    downloadCsv(
      "clients.csv",
      filtered.map((c) => ({
        Name: c.name,
        Phone: c.phone,
        Type: c.clientType === "third_party" ? "Third party" : "Client",
        Visits: c.totalVisits,
        TotalSpend: (c.totalSpend / 100).toFixed(2),
        Outstanding: (c.outstanding / 100).toFixed(2),
        LastVisit: c.lastVisit ?? "",
        Vehicles: c.vehicleCount,
        Wallet: (c.walletBalance / 100).toFixed(2),
        Points: c.points,
        Source: c.sourceOfClient ?? "",
      }))
    );
  }

  const TABS: { key: TypeTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "customer", label: "Clients" },
    { key: "third_party", label: "Third party" },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex items-start justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Clients</h1>
              <p className="mt-1 text-[14px] text-slate-400">Your customer base plus third-party vendors who bring in vehicles on credit.</p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-charcoal-800"
            >
              <Plus size={15} /> Add client
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total clients" value={customers.length} icon={Users} loading={!clients} />
            <StatCard
              label="Repeat clients"
              value={repeatCount}
              icon={Repeat}
              loading={!clients}
              info="Customers who have visited more than once."
            />
            <StatCard label="Lifetime revenue" value={`₹${(totalSpend / 100).toLocaleString("en-IN")}`} icon={Wallet} loading={!clients} />
            <StatCard
              label="Third-party credit due"
              value={`₹${(vendorOutstanding / 100).toLocaleString("en-IN")}`}
              icon={Truck}
              loading={!clients}
              info={`${vendors.length} third-party vendor${vendors.length === 1 ? "" : "s"} · unsettled vehicle invoices`}
            />
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTypeTab(t.key)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      typeTab === t.key ? "bg-white text-charcoal-900 shadow-card" : "text-slate-500 hover:text-charcoal-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(
                  [
                    { key: "all", label: "All segments", cls: "text-slate-500", active: "bg-charcoal-900 text-white border-charcoal-900" },
                    { key: "active", label: "Active", cls: "text-emerald-600", active: "bg-emerald-500 text-white border-emerald-500" },
                    { key: "churn", label: "Churn risk", cls: "text-amber-600", active: "bg-amber-500 text-white border-amber-500" },
                    { key: "defected", label: "Defected", cls: "text-rose-600", active: "bg-rose-500 text-white border-rose-500" },
                  ] as { key: Segment; label: string; cls: string; active: string }[]
                ).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSegment(p.key)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      segment === p.key ? p.active : `border-slate-200 bg-white hover:bg-slate-50 ${p.cls}`
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[260px]">
              <TableToolbar search={search} onSearch={setSearch} placeholder="Search name or phone..." onDownload={exportCsv} />
            </div>
          </div>

          <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                    <th className="px-5 py-3.5">Client</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Visits</th>
                    <th className="px-5 py-3.5">Total spend</th>
                    <th className="px-5 py-3.5">Credit due</th>
                    <th className="px-5 py-3.5">Last visit</th>
                    <th className="px-5 py-3.5">Points</th>
                    <th className="px-5 py-3.5 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!clients ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-16 text-center">
                        <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-medium text-charcoal-900">No clients found</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((c) => {
                      const isVendor = c.clientType === "third_party";
                      return (
                        <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="cursor-pointer text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <p className="font-medium">{c.name}</p>
                            <p className="text-[12px] text-slate-400">{c.phone}{c.vehicleCount > 0 ? ` · ${c.vehicleCount} vehicle${c.vehicleCount > 1 ? "s" : ""}` : ""}</p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isVendor ? "bg-violet-50 text-violet-600" : "bg-slate-100 text-slate-500"}`}>
                              {isVendor ? "Third party" : "Client"}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {c.totalVisits}
                            {!isVendor && c.totalVisits > 1 && <span className="ml-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">repeat</span>}
                          </td>
                          <td className="px-5 py-4 font-medium whitespace-nowrap">₹{(c.totalSpend / 100).toLocaleString("en-IN")}</td>
                          <td className={`px-5 py-4 whitespace-nowrap font-medium ${c.outstanding > 0 ? "text-amber-600" : "text-slate-400"}`}>
                            {c.outstanding > 0 ? `₹${(c.outstanding / 100).toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{c.lastVisit ?? "—"}</td>
                          <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{isVendor ? "—" : `${c.points} pts`}</td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900"
                            >
                              <Eye size={16} strokeWidth={1.75} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        </div>
      </main>

      {/* Add client modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-xl2 bg-white p-6 shadow-xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-charcoal-900">Add client</h3>
              <button onClick={() => setShowAdd(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitClient} className="mt-5 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-slate-500">Type</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFType("customer")}
                    className={`rounded-xl border px-3 py-2.5 text-left text-[13px] ${fType === "customer" ? "border-charcoal-900 bg-charcoal-900/5 font-medium text-charcoal-900" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    Client
                    <span className="block text-[11px] font-normal text-slate-400">Regular customer — earns points</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFType("third_party")}
                    className={`rounded-xl border px-3 py-2.5 text-left text-[13px] ${fType === "third_party" ? "border-violet-500 bg-violet-50 font-medium text-violet-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    Third party
                    <span className="block text-[11px] font-normal text-slate-400">Vendor/mechanic — credit tab, no points</span>
                  </button>
                </div>
                {fType === "third_party" && (
                  <p className="mt-2 rounded-lg bg-violet-50/60 px-3 py-2 text-[11.5px] text-violet-700">
                    Brings in customer vehicles (e.g. daily washes). All vehicles are tracked under this name; unpaid invoices
                    stay open as credit and are closed one by one when cash is received. No coupons, wallet or points.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[12px] font-medium text-slate-500">Name *</label>
                <input value={fName} onChange={(e) => setFName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-charcoal-900" placeholder={fType === "third_party" ? "e.g. Ravi Mechanic Works" : "Client name"} />
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-500">Phone *</label>
                <input value={fPhone} onChange={(e) => setFPhone(e.target.value.replace(/[^0-9+]/g, ""))} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-charcoal-900" placeholder="10-digit mobile" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-slate-500">Address</label>
                <input value={fAddress} onChange={(e) => setFAddress(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-charcoal-900" placeholder="Optional" />
              </div>
              {fType === "customer" && (
                <div>
                  <label className="text-[12px] font-medium text-slate-500">Referred by (referral code)</label>
                  <input
                    value={fReferredBy}
                    onChange={(e) => setFReferredBy(e.target.value.toUpperCase())}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-[13.5px] tracking-widest outline-none focus:border-charcoal-900"
                    placeholder="e.g. MANO477 — optional"
                  />
                </div>
              )}
              <div>
                <label className="text-[12px] font-medium text-slate-500">Source</label>
                <input value={fSource} onChange={(e) => setFSource(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-charcoal-900" placeholder="walkin / referral / whatsapp..." />
              </div>

              {formError && <p className="text-[12.5px] text-red-500">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                  {saving ? "Saving..." : "Save client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
