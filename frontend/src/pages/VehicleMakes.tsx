import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, AlertCircle, Car, Globe, Building2, Trash2, XCircle } from "lucide-react";
import { api, VehicleMake } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 10;

export default function VehicleMakes() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [makes, setMakes] = useState<VehicleMake[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function load() {
    api.listVehicleMakes().then(setMakes).catch((err) => setError(err.message));
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createVehicleMake(name.trim());
      setName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not add make");
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: VehicleMake) {
    try {
      await api.deleteVehicleMake(m.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not delete");
    }
  }

  const filtered = useMemo(() => {
    if (!makes) return [];
    const q = search.trim().toLowerCase();
    return q ? makes.filter((m) => m.name.toLowerCase().includes(q)) : makes;
  }, [makes, search]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const globalCount = makes?.filter((m) => m.orgId === null).length ?? 0;
  const customCount = makes?.filter((m) => m.orgId !== null).length ?? 0;

  function exportCsv() {
    downloadCsv(
      "vehicle-makes.csv",
      filtered.map((m, i) => ({ "#": i + 1, MakeName: m.name, Source: m.orgId ? "Custom" : "Global" }))
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="animate-slideUp">
            <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Vehicle Make</h1>
            <p className="mt-1 text-[14px] text-slate-400">Master list of vehicle manufacturers used across Job Cards.</p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total makes" value={makes?.length ?? 0} icon={Car} loading={!makes} />
            <StatCard label="Global catalog" value={globalCount} icon={Globe} loading={!makes} />
            <StatCard label="Your custom makes" value={customCount} icon={Building2} loading={!makes} />
          </div>

          <div className="mt-8 rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
            <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Add car make</h3>
            <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[12px] font-medium text-slate-400">Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Make name"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:border-accent-500 focus:outline-none"
                />
              </div>
              <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                <Plus size={15} />
                {saving ? "Adding..." : "Add"}
              </button>
            </form>
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <h3 className="mt-10 text-[15px] font-semibold text-charcoal-900">Manage Make(s)</h3>
          <div className="mt-4">
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search makes..." onDownload={exportCsv} />
          </div>

          <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                    <th className="px-5 py-3.5 w-14">#</th>
                    <th className="px-5 py-3.5">Make name</th>
                    <th className="px-5 py-3.5">Source</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!makes ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-16 text-center">
                        <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-medium text-charcoal-900">No matching makes</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((m, i) => (
                      <tr key={m.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                        <td className="px-5 py-4 text-slate-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-5 py-4 font-medium">{m.name}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${m.orgId ? "bg-accent-500/10 text-accent-600" : "bg-slate-100 text-slate-500"}`}>
                            {m.orgId ? "Custom" : "Global"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {m.orgId ? (
                            <button onClick={() => remove(m)} title="Delete" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 size={15} strokeWidth={1.75} />
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
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
    </div>
  );
}
