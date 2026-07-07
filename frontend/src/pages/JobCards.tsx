import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ClipboardList, Receipt, TrendingUp, XCircle } from "lucide-react";
import { api, JobCardListItem } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-500",
  in_progress: "bg-amber-50 text-amber-600",
  completed: "bg-emerald-50 text-emerald-600",
  billed: "bg-accent-500/10 text-accent-600",
  cancelled: "bg-red-50 text-red-600",
};

export default function JobCards() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [jobCards, setJobCards] = useState<JobCardListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { branchParam } = useBranch();

  function load() {
    api.listJobCards(branchParam).then(setJobCards).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  useEffect(() => {
    setJobCards(null);
    load();
  }, [branchParam]);

  useEffect(() => setPage(1), [search, statusFilter]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const filtered = useMemo(() => {
    if (!jobCards) return [];
    const q = search.trim().toLowerCase();
    return jobCards.filter((jc) => {
      const matchesSearch = !q || jc.clientName.toLowerCase().includes(q) || jc.clientPhone.includes(q) || jc.plateNumber.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || jc.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobCards, search, statusFilter]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue = jobCards?.reduce((sum, jc) => sum + jc.total, 0) ?? 0;
  const completedCount = jobCards?.filter((jc) => jc.status === "completed" || jc.status === "billed").length ?? 0;
  const invoicedCount = jobCards?.filter((jc) => jc.hasInvoice).length ?? 0;

  function exportCsv() {
    downloadCsv(
      "job-cards.csv",
      filtered.map((jc) => ({
        Date: jc.jobDate,
        Client: jc.clientName,
        Phone: jc.clientPhone,
        Vehicle: jc.plateNumber,
        Total: (jc.total / 100).toFixed(2),
        Status: jc.status,
        Invoiced: jc.hasInvoice ? "Yes" : "No",
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
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Job Cards</h1>
              <p className="mt-1 text-[14px] text-slate-400">Every service visit, from intake to invoice.</p>
            </div>
            <button
              onClick={() => navigate("/job-cards/new")}
              className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800"
            >
              <Plus size={15} />
              Create Job Card
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard label="Total job cards" value={jobCards?.length ?? 0} icon={ClipboardList} loading={!jobCards} />
            <StatCard label="Completed" value={completedCount} icon={TrendingUp} loading={!jobCards} />
            <StatCard label="Invoiced" value={invoicedCount} icon={Receipt} loading={!jobCards} />
            <StatCard label="Total value" value={`₹${(totalRevenue / 100).toLocaleString("en-IN")}`} icon={Receipt} loading={!jobCards} />
          </div>

          <div className="mt-6">
            <TableToolbar
              search={search}
              onSearch={setSearch}
              placeholder="Search client, phone, vehicle..."
              onDownload={exportCsv}
              filters={
                <Dropdown
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-44"
                  size="sm"
                  capitalize
                  options={[
                    { value: "all", label: "All statuses" },
                    ...["draft", "in_progress", "completed", "billed", "cancelled"].map((s) => ({ value: s, label: s.replace("_", " ") })),
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
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Client</th>
                    <th className="px-5 py-3.5">Vehicle</th>
                    <th className="px-5 py-3.5">Total</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!jobCards ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-medium text-charcoal-900">No job cards found</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((jc) => (
                      <tr
                        key={jc.id}
                        onClick={() => navigate(`/job-cards/${jc.id}`)}
                        className="cursor-pointer text-[13.5px] text-charcoal-900 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4 whitespace-nowrap">{jc.jobDate}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="font-medium">{jc.clientName}</p>
                          <p className="text-[12px] text-slate-400">{jc.clientPhone}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{jc.plateNumber}</td>
                        <td className="px-5 py-4 font-medium whitespace-nowrap">₹{(jc.total / 100).toLocaleString("en-IN")}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${STATUS_STYLES[jc.status]}`}>
                            {jc.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-[12px] text-slate-400">
                          {jc.hasInvoice ? "Generated" : "—"}
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
