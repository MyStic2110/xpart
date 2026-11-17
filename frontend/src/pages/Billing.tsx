import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Clock, IndianRupee, Receipt, AlertCircle, ArrowUpRight, MessageSquare } from "lucide-react";
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
  const [viewTab, setViewTab] = useState<"all" | "pending">("all");
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

  const pendingInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter(
      (inv) =>
        inv.status !== "cancelled" &&
        ((inv.balanceDue !== undefined && inv.balanceDue > 0) || inv.status === "draft" || inv.status === "partial")
    );
  }, [invoices]);

  const filteredData = useMemo(() => {
    if (!invoices) return [];
    const baseList = viewTab === "pending" ? pendingInvoices : invoices;
    if (statusFilter === "all") return baseList;
    return baseList.filter((inv) => inv.status === statusFilter);
  }, [invoices, viewTab, pendingInvoices, statusFilter]);

  const totalOutstandingDue = useMemo(() => {
    if (!invoices) return 0;
    return invoices
      .filter((i) => i.status !== "cancelled")
      .reduce((sum, i) => sum + (i.balanceDue !== undefined ? i.balanceDue : (i.status === "paid" ? 0 : i.total)), 0);
  }, [invoices]);

  const totalRevenue = useMemo(() => {
    if (!invoices) return 0;
    return invoices.reduce(
      (sum, i) => sum + (i.paidAmount !== undefined ? i.paidAmount : (i.status === "paid" ? i.total : 0)),
      0
    );
  }, [invoices]);

  const pendingCount = pendingInvoices.length;
  const paidCount = invoices?.filter((i) => i.status === "paid").length ?? 0;

  function openWhatsAppReminder(inv: InvoiceListItem, e: React.MouseEvent) {
    e.stopPropagation();
    const cleanPhone = inv.clientPhone.replace(/[^0-9]/g, "");
    const dueFormatted = `₹${((inv.balanceDue || inv.total) / 100).toLocaleString("en-IN")}`;
    const text = encodeURIComponent(
      `Dear ${inv.clientName}, greeting from ${orgName}. Your invoice ${inv.invoiceNo || ""} for vehicle ${inv.plateNumber} has a pending balance of ${dueFormatted}. Please clear the outstanding dues. Thank you!`
    );
    window.open(`https://wa.me/91${cleanPhone}?text=${text}`, "_blank");
  }

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
        header: "Bill Total",
        cell: ({ row }) => (
          <span className="font-semibold text-charcoal-900">
            ₹{(row.original.total / 100).toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        accessorKey: "paidAmount",
        header: "Paid So Far",
        cell: ({ row }) => {
          const paid = row.original.paidAmount !== undefined
            ? row.original.paidAmount
            : (row.original.status === "paid" ? row.original.total : 0);
          return (
            <span className="font-medium text-emerald-700">
              ₹{(paid / 100).toLocaleString("en-IN")}
            </span>
          );
        },
      },
      {
        accessorKey: "balanceDue",
        header: "Balance Due",
        cell: ({ row }) => {
          const due = row.original.balanceDue !== undefined
            ? row.original.balanceDue
            : (row.original.status === "paid" ? 0 : row.original.total);
          return (
            <span className={cn(
              "font-bold",
              due > 0 ? "text-rose-600" : "text-slate-400"
            )}>
              ₹{(due / 100).toLocaleString("en-IN")}
            </span>
          );
        },
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
        header: "Date",
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
      {
        id: "actions",
        header: () => <span className="text-right block">Action</span>,
        cell: ({ row }) => {
          const due = row.original.balanceDue !== undefined
            ? row.original.balanceDue
            : (row.original.status === "paid" ? 0 : row.original.total);
          return (
            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              {due > 0 && row.original.clientPhone && (
                <button
                  type="button"
                  onClick={(e) => openWhatsAppReminder(row.original, e)}
                  title="Send WhatsApp payment reminder"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <MessageSquare size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(`/billing/${row.original.id}`)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors",
                  due > 0
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "border border-slate-200 bg-white text-charcoal-900 hover:bg-slate-50"
                )}
              >
                {due > 0 ? "Collect" : "View"}
              </button>
            </div>
          );
        },
      },
    ],
    [orgName]
  );

  function exportCsv() {
    downloadCsv(
      viewTab === "pending" ? "pending-dues.csv" : "invoices.csv",
      filteredData.map((inv) => ({
        InvoiceNo: inv.invoiceNo || "",
        Client: inv.clientName,
        Phone: inv.clientPhone,
        Vehicle: inv.plateNumber,
        Total: (inv.total / 100).toFixed(2),
        PaidAmount: ((inv.paidAmount ?? 0) / 100).toFixed(2),
        BalanceDue: ((inv.balanceDue ?? 0) / 100).toFixed(2),
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
          subtitle="Collect payments, manage receivables, and track settlements"
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                title="Total Outstanding Dues"
                value={`₹${(totalOutstandingDue / 100).toLocaleString("en-IN")}`}
                icon={AlertCircle}
                loading={isLoading}
                subtext={`${pendingCount} unpaid / partial invoices pending`}
              />
              <MetricCard
                title="Revenue Collected"
                value={`₹${(totalRevenue / 100).toLocaleString("en-IN")}`}
                icon={IndianRupee}
                loading={isLoading}
                subtext="Total collected across all settlements"
              />
              <MetricCard
                title="Settlement Rate"
                value={invoices?.length ? `${Math.round((paidCount / invoices.length) * 100)}%` : "0%"}
                icon={CheckCircle2}
                loading={isLoading}
                subtext={`${paidCount} of ${invoices?.length ?? 0} invoices fully settled`}
              />
            </div>

            {/* Pending Dues vs All Invoices Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center rounded-xl bg-slate-200/60 p-1">
                <button
                  type="button"
                  onClick={() => setViewTab("all")}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                    viewTab === "all"
                      ? "bg-white text-charcoal-900 shadow-sm"
                      : "text-slate-600 hover:text-charcoal-900"
                  )}
                >
                  All Invoices ({invoices?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("pending")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                    viewTab === "pending"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-charcoal-900"
                  )}
                >
                  <span>Pending Dues ({pendingCount})</span>
                  {totalOutstandingDue > 0 && (
                    <span className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      viewTab === "pending" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                    )}>
                      ₹{(totalOutstandingDue / 100).toLocaleString("en-IN")}
                    </span>
                  )}
                </button>
              </div>

              {viewTab === "pending" && (
                <p className="text-xs text-rose-700 font-medium bg-rose-50 border border-rose-200/60 rounded-lg px-3 py-1.5">
                  Showing invoices with pending receivables. Click <strong>Collect</strong> or <strong>WhatsApp</strong> to request payment.
                </p>
              )}
            </div>

            {/* Modern Headless Data Table */}
            <div className="mt-4">
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
