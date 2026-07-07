import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Receipt, CheckCircle2, Clock, XCircle } from "lucide-react";
import { api, InvoiceListItem } from "../api";
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
  partial: "bg-amber-50 text-amber-600",
  paid: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-red-50 text-red-600",
};

export default function Billing() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [invoices, setInvoices] = useState<InvoiceListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const { branchParam } = useBranch();

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  useEffect(() => {
    setInvoices(null);
    api.listInvoices(branchParam).then(setInvoices).catch(() => {});
  }, [branchParam]);

  useEffect(() => setPage(1), [search, statusFilter]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesSearch = !q || inv.clientName.toLowerCase().includes(q) || inv.clientPhone.includes(q) || inv.plateNumber.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue = invoices?.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.total, 0) ?? 0;
  const pendingCount = invoices?.filter((i) => i.status === "draft" || i.status === "partial").length ?? 0;
  const paidCount = invoices?.filter((i) => i.status === "paid").length ?? 0;

  function exportCsv() {
    downloadCsv(
      "invoices.csv",
      filtered.map((inv) => ({
        Client: inv.clientName,
        Phone: inv.clientPhone,
        Vehicle: inv.plateNumber,
        Total: (inv.total / 100).toFixed(2),
        Status: inv.status,
        CreatedAt: inv.createdAt,
      }))
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="animate-slideUp">
            <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Billing</h1>
            <p className="mt-1 text-[14px] text-slate-400">Collect payments and track what's been settled.</p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Revenue collected" value={`₹${(totalRevenue / 100).toLocaleString("en-IN")}`} icon={CheckCircle2} loading={!invoices} />
            <StatCard label="Pending invoices" value={pendingCount} icon={Clock} loading={!invoices} />
            <StatCard label="Paid invoices" value={paidCount} icon={Receipt} loading={!invoices} />
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
                    ...["draft", "partial", "paid", "cancelled"].map((s) => ({ value: s, label: s })),
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
                    <th className="px-5 py-3.5">Vehicle</th>
                    <th className="px-5 py-3.5">Total</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!invoices ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-16 text-center">
                        <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-medium text-charcoal-900">No invoices found</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((inv) => (
                      <tr key={inv.id} onClick={() => navigate(`/billing/${inv.id}`)} className="cursor-pointer text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="font-medium">{inv.clientName}</p>
                          <p className="text-[12px] text-slate-400">
                            {inv.invoiceNo ? `${inv.invoiceNo} · ` : ""}{inv.clientPhone}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{inv.plateNumber}</td>
                        <td className="px-5 py-4 font-medium whitespace-nowrap">₹{(inv.total / 100).toLocaleString("en-IN")}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-400 whitespace-nowrap text-[12px]">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</td>
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
