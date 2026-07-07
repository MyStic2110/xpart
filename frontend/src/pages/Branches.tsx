import { useEffect, useMemo, useState } from "react";
import { Plus, X, AlertCircle, Building2, MapPin, CheckCircle2, XCircle, Sparkles, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, Branch, BranchInput } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import FloatingInput from "../components/FloatingInput";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import { downloadCsv } from "../utils/csv";

const EMPTY_FORM: BranchInput = {
  name: "",
  salonName: "",
  city: "",
  address: "",
  logoUrl: "",
  phone: "",
  email: "",
  website: "",
  gstNumber: "",
  workingHours: "",
  status: "active",
  loyaltyPointsEnabled: true,
  pointsPerThousand: 50,
  redeemPaisePerPoint: 100,
};

const PAGE_SIZE = 8;

export default function Branches() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [orgName, setOrgName] = useState("Workspace");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BranchInput>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [togglingWallet, setTogglingWallet] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  function load() {
    api.listBranches().then(setBranches).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => {
      setOrgName(me.org.name);
      setWalletEnabled(me.org.walletEnabled);
      setIsOwner(me.roles.includes("org_owner"));
    }).catch(() => {});
    load();
  }, []);

  function update(field: keyof BranchInput, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(b: Branch) {
    setForm({
      name: b.name,
      salonName: b.salonName,
      city: b.city,
      address: b.address ?? "",
      logoUrl: b.logoUrl ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      website: b.website ?? "",
      gstNumber: b.gstNumber ?? "",
      workingHours: b.workingHours ?? "",
      status: b.status,
      loyaltyPointsEnabled: b.loyaltyPointsEnabled,
      pointsPerThousand: b.pointsPerThousand,
      redeemPaisePerPoint: b.redeemPaisePerPoint,
    });
    setEditingId(b.id);
    setError("");
    setShowForm(true);
  }

  async function toggleWallet() {
    const next = !walletEnabled;
    setWalletEnabled(next);
    setTogglingWallet(true);
    try {
      await api.updateOrgSettings({ walletEnabled: next });
    } catch {
      setWalletEnabled(!next); // revert on failure
    } finally {
      setTogglingWallet(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingId) {
        await api.updateBranch(editingId, form);
      } else {
        await api.createBranch(form);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save branch");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(branch: Branch) {
    const next = branch.status === "active" ? "inactive" : "active";
    setBranches((prev) => prev?.map((b) => (b.id === branch.id ? { ...b, status: next } : b)) ?? prev);
    try {
      await api.updateBranch(branch.id, { status: next });
    } catch {
      load();
    }
  }

  const filtered = useMemo(() => {
    if (!branches) return [];
    const q = search.trim().toLowerCase();
    return branches.filter((b) => {
      const matchesSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.salonName.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        (b.email ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, statusFilter]);

  const activeCount = branches?.filter((b) => b.status === "active").length ?? 0;
  const cities = new Set(branches?.map((b) => b.city)).size;

  function exportCsv() {
    downloadCsv(
      "branches.csv",
      filtered.map((b) => ({
        BranchName: b.name,
        SalonName: b.salonName,
        City: b.city,
        Phone: b.phone ?? "",
        Email: b.email ?? "",
        Website: b.website ?? "",
        GST: b.gstNumber ?? "",
        WorkingHours: b.workingHours ?? "",
        Status: b.status,
      }))
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex items-center justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Branches</h1>
              <p className="mt-1 text-[14px] text-slate-400">Manage every outlet operating under your business.</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-charcoal-800"
            >
              <Plus size={15} />
              Add branch
            </button>
          </div>

          {/* Org-wide master switch for the wallet & loyalty-points concept. */}
          <div className="mt-8 flex items-center justify-between rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-violet-50 p-2.5 text-violet-500">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-charcoal-900">Wallet & loyalty points</h3>
                <p className="mt-0.5 text-[12.5px] text-slate-400">
                  Master switch for the whole organisation. When off, no branch earns or redeems points regardless of its own setting.
                </p>
              </div>
            </div>
            <button
              onClick={toggleWallet}
              disabled={!isOwner || togglingWallet}
              title={!isOwner ? "Only the org owner can change this" : undefined}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                walletEnabled ? "bg-violet-600" : "bg-slate-300"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${walletEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total branches" value={branches?.length ?? 0} icon={Building2} loading={!branches} />
            <StatCard label="Active branches" value={activeCount} icon={CheckCircle2} loading={!branches} />
            <StatCard label="Cities covered" value={cities} icon={MapPin} loading={!branches} />
          </div>

          {error && !showForm && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6">
            <TableToolbar
              search={search}
              onSearch={setSearch}
              placeholder="Search branches, salon name, city..."
              onDownload={exportCsv}
              filters={
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  {(["all", "active", "inactive"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
                        statusFilter === s ? "bg-white text-charcoal-900 shadow-card" : "text-slate-500 hover:text-charcoal-900"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              }
            />
          </div>

          <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                    <th className="px-5 py-3.5 whitespace-nowrap">Branch name</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Salon name</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Phone</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Email</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Website</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">GST</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Working hours</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Loyalty</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3.5 whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!branches ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }).map((__, j) => (
                          <td key={j} className="px-5 py-4">
                            <Skeleton className="h-4 w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-16 text-center">
                        {branches.length === 0 ? (
                          <>
                            <Building2 size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">No branches yet</p>
                            <p className="mt-1 text-sm text-slate-400">Add your first additional branch to get started.</p>
                          </>
                        ) : (
                          <>
                            <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">No matching branches</p>
                            <p className="mt-1 text-sm text-slate-400">Try a different search or filter.</p>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((b) => (
                      <tr key={b.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-medium whitespace-nowrap">{b.name}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{b.salonName}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{b.phone || "—"}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{b.email || "—"}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{b.website || "—"}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{b.gstNumber || "—"}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{b.workingHours || "—"}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-[12.5px]">
                          {!walletEnabled ? (
                            <span className="text-slate-300">Org off</span>
                          ) : b.loyaltyPointsEnabled ? (
                            <span className="text-slate-500">
                              {b.pointsPerThousand} pts/₹1k · ₹{(b.redeemPaisePerPoint / 100).toLocaleString("en-IN")}/pt
                            </span>
                          ) : (
                            <span className="text-slate-400">Off</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleStatus(b)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              b.status === "active"
                                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {b.status === "active" ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => openEdit(b)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-medium text-slate-400 hover:bg-slate-100 hover:text-charcoal-900"
                          >
                            <Pencil size={13} /> Edit
                          </button>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">{editingId ? "Edit branch" : "Add branch"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput label="Branch name" value={form.name} onChange={(e) => update("name", e.target.value)} required autoFocus />
              <FloatingInput label="Salon name" value={form.salonName} onChange={(e) => update("salonName", e.target.value)} required helperText="Can be the same or different from your business name" />
              <FloatingInput label="City" value={form.city} onChange={(e) => update("city", e.target.value)} required />
              <FloatingInput label="Address" value={form.address} onChange={(e) => update("address", e.target.value)} />
              <FloatingInput label="Logo URL" value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} />
              <FloatingInput label="Phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              <FloatingInput label="Email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} helperText="Can be the same or different per branch" />
              <FloatingInput label="Website" value={form.website} onChange={(e) => update("website", e.target.value)} />
              <FloatingInput label="GST number" value={form.gstNumber} onChange={(e) => update("gstNumber", e.target.value)} helperText="Can be the same or different per branch" />
              <FloatingInput label="Working hours" value={form.workingHours} onChange={(e) => update("workingHours", e.target.value)} helperText="e.g. Mon-Sat 9:00-20:00" />

              <div>
                <label className="text-[13px] font-medium text-slate-500">Status</label>
                <div className="mt-2 flex gap-2">
                  {(["active", "inactive"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update("status", s)}
                      className={`rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize transition-colors ${
                        form.status === s ? "bg-charcoal-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loyalty points config for this branch. */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium text-charcoal-900">
                    <Sparkles size={14} className="text-violet-500" /> Loyalty points
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, loyaltyPointsEnabled: !f.loyaltyPointsEnabled }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      form.loyaltyPointsEnabled ? "bg-violet-600" : "bg-slate-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.loyaltyPointsEnabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                {!walletEnabled && (
                  <p className="mt-2 text-[12px] text-amber-600">The org-wide wallet switch is off, so points stay inactive even if enabled here.</p>
                )}
                {form.loyaltyPointsEnabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-slate-400">Points per ₹1,000</label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={form.pointsPerThousand ?? 50}
                        onChange={(e) => setForm((f) => ({ ...f, pointsPerThousand: Number(e.target.value) }))}
                        className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">Earned on cash/UPI/card collected.</p>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-400">₹ per point (redeem)</label>
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={(form.redeemPaisePerPoint ?? 100) / 100}
                        onChange={(e) => setForm((f) => ({ ...f, redeemPaisePerPoint: Math.round(Number(e.target.value) * 100) }))}
                        className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px]"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">Value of 1 point when redeemed.</p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-charcoal-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Add branch"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
