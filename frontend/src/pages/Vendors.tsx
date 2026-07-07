import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Phone, Mail, MapPin, Building, Pencil, Trash2, XCircle, ChevronRight } from "lucide-react";
import { api, Vendor, VendorInput } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import FloatingInput from "../components/FloatingInput";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 12;
const EMPTY: VendorInput = { name: "", contactNumber: "", email: "", address: "" };

export default function Vendors() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorInput>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creditSummary, setCreditSummary] = useState(0);

  function load() {
    api.listVendors().then(setVendors).catch((err) => setError(err.message));
    api.inventorySummary().then((sum) => setCreditSummary(sum.creditOutstanding)).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    load();
  }, []);

  useEffect(() => setPage(1), [search]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function openCreate() {
    setEditId(null);
    setForm(EMPTY);
    setError("");
    setShowForm(true);
  }

  function openEdit(v: Vendor) {
    setEditId(v.id);
    setForm({
      name: v.name,
      contactNumber: v.contactNumber,
      email: v.email ?? "",
      address: v.address ?? "",
    });
    setError("");
    setShowForm(true);
  }

  function set(field: keyof VendorInput, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editId) await api.updateVendor(editId, form);
      else await api.createVendor(form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save vendor");
    } finally {
      setSaving(false);
    }
  }

  async function remove(v: Vendor) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    try {
      await api.deleteVendor(v.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not delete");
    }
  }

  const filtered = useMemo(() => {
    if (!vendors) return [];
    const q = search.trim().toLowerCase();
    return q
      ? vendors.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.contactNumber.includes(q) ||
            (v.email ?? "").toLowerCase().includes(q) ||
            (v.address ?? "").toLowerCase().includes(q)
        )
      : vendors;
  }, [vendors, search]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    downloadCsv(
      "vendors.csv",
      filtered.map((v) => ({
        Name: v.name,
        Contact: v.contactNumber,
        Email: v.email ?? "",
        Address: v.address ?? "",
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
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Vendors</h1>
              <p className="mt-1 text-[14px] text-slate-400">Parts and products suppliers listing.</p>
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800">
              <Plus size={15} /> Add vendor
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard label="Total vendors" value={vendors?.length ?? 0} icon={Building} loading={!vendors} />
            <StatCard label="Credit outstanding" value={`₹${(creditSummary / 100).toLocaleString("en-IN")}`} icon={Building} loading={!vendors} info="Total outstanding payments owed to all suppliers." />
          </div>

          <div className="mt-6">
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, contact, email, address..." onDownload={exportCsv} />
          </div>

          {error && !showForm && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}

          <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                    <th className="px-5 py-3.5">Vendor</th>
                    <th className="px-5 py-3.5">Contact Details</th>
                    <th className="px-5 py-3.5">Address</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!vendors ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16 text-center">
                        <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-medium text-charcoal-900">No vendors found</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((v) => (
                      <tr key={v.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-charcoal-900">{v.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-[13px] text-slate-500">
                            <span className="flex items-center gap-1"><Phone size={12} /> {v.contactNumber}</span>
                            {v.email && <span className="flex items-center gap-1"><Mail size={12} /> {v.email}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {v.address ? (
                            <span className="flex items-center gap-1 max-w-xs truncate"><MapPin size={12} className="shrink-0" /> {v.address}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/vendors/${v.id}/ledger`)}
                              className="inline-flex items-center gap-1 text-[12px] font-bold text-accent-700 hover:text-accent-950 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              Ledger <ChevronRight size={13} />
                            </button>
                            <button onClick={() => openEdit(v)} title="Edit" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => remove(v)} title="Delete" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 size={15} />
                            </button>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideLeft">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">{editId ? "Edit vendor" : "Add vendor"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput label="Vendor name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <FloatingInput label="Contact number" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} required />
              <FloatingInput label="Email address" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <FloatingInput label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}
              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Saving..." : editId ? "Save changes" : "Add vendor"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
