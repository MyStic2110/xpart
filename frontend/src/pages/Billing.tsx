import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, IndianRupee, Receipt } from "lucide-react";
import { api, InvoiceListItem } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import TopBar from "../components/ui/TopBar";
import MetricCard from "../components/ui/MetricCard";
import DataTable from "../components/ui/DataTable";
import { downloadCsv } from "../utils/csv";
import { cn } from "../lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border border-slate-200",
  partial: "bg-amber-50 text-amber-700 border border-amber-200/60",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  cancelled: "bg-rose-50 text-rose-700 border border-rose-200/60",
};

export default function Billing() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [invoices, setInvoices] = useState<InvoiceListItem[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const { branchParam } = useBranch();

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  useEffect(() => {
    setInvoices(null);
    api.listInvoices(branchParam).then(setInvoices).catch(() => {});
  }, [branchParam]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const filteredData = useMemo(() => {
    if (!invoices) return [];
    if (statusFilter === "all") return invoices;
    return invoices.filter((inv) => inv.status === statusFilter);
  }, [invoices, statusFilter]);

  const totalRevenue = invoices?.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.total, 0) ?? 0;
  const pendingCount = invoices?.filter((i) => i.status === "draft" || i.status === "partial").length ?? 0;
  const paidCount = invoices?.filter((i) => i.status === "paid").length ?? 0;

  const columns = useMemo<ColumnDef<InvoiceListItem>[]>(
    () => [
      {
        accessorKey: "clientName",
        header: "Client & Invoice",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-charcoal-900 leading-tight">{row.original.clientName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {row.original.invoiceNo ? `${row.original.invoiceNo} · ` : ""}
              {row.original.clientPhone}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "plateNumber",
        header: "Vehicle Plate",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-medium text-slate-700 tracking-wide">
            {row.original.plateNumber}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-semibold text-charcoal-900">
            ₹{(row.original.total / 100).toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
              STATUS_STYLES[row.original.status] ?? "bg-slate-100 text-slate-600"
            )}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created Date",
        cell: ({ row }) => (
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {new Date(row.original.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ),
      },
    ],
    []
  );

  function exportCsv() {
    downloadCsv(
      "invoices.csv",
      filteredData.map((inv) => ({
        Client: inv.clientName,
        Phone: inv.clientPhone,
        Vehicle: inv.plateNumber,
        Total: (inv.total / 100).toFixed(2),
        Status: inv.status,
        CreatedAt: inv.createdAt,
      }))
    );
  }

  const isLoading = invoices === null;

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar orgName={orgName} onLogout={logout} />

      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          title="Billing & Invoices"
          subtitle="Collect payments, manage credit balances, and track settlements"
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                title="Revenue Collected"
                value={`₹${(totalRevenue / 100).toLocaleString("en-IN")}`}
                icon={IndianRupee}
                loading={isLoading}
                subtext="Total collected from settled invoices"
              />
              <MetricCard
                title="Pending Invoices"
                value={pendingCount}
                icon={Clock}
                loading={isLoading}
                subtext="Awaiting full client collection"
              />
              <MetricCard
                title="Paid Invoices"
                value={paidCount}
                icon={CheckCircle2}
                loading={isLoading}
                delta={{
                  value: invoices?.length ? `${Math.round((paidCount / invoices.length) * 100)}%` : "0%",
                  trend: "up",
                  label: "Settlement rate",
                }}
              />
            </div>

            {/* Modern Headless Data Table */}
            <div className="mt-8">
              <DataTable
                columns={columns}
                data={filteredData}
                searchPlaceholder="Search client name, phone number, vehicle plate..."
                onExportCsv={exportCsv}
                onRowClick={(row) => navigate(`/billing/${row.id}`)}
                filters={
                  <Dropdown
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="w-40"
                    size="sm"
                    capitalize
                    options={[
                      { value: "all", label: "All statuses" },
                      ...["draft", "partial", "paid", "cancelled"].map((s) => ({
                        value: s,
                        label: s,
                      })),
                    ]}
                  />
                }
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
