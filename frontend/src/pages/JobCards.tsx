import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, ClipboardList, Receipt, CheckCircle2, IndianRupee } from "lucide-react";
import { api, JobCardListItem } from "../api";
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
  in_progress: "bg-amber-50 text-amber-700 border border-amber-200/60",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
  billed: "bg-accent-500/10 text-accent-700 border border-accent-500/20",
  cancelled: "bg-rose-50 text-rose-700 border border-rose-200/60",
};

export default function JobCards() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [jobCards, setJobCards] = useState<JobCardListItem[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const { branchParam } = useBranch();

  function load() {
    api.listJobCards(branchParam).then(setJobCards).catch(() => { });
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => { });
  }, []);

  useEffect(() => {
    setJobCards(null);
    load();
  }, [branchParam]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const filteredData = useMemo(() => {
    if (!jobCards) return [];
    if (statusFilter === "all") return jobCards;
    return jobCards.filter((jc) => jc.status === statusFilter);
  }, [jobCards, statusFilter]);

  const totalRevenue = jobCards?.reduce((sum, jc) => sum + jc.total, 0) ?? 0;
  const completedCount = jobCards?.filter((jc) => jc.status === "completed" || jc.status === "billed").length ?? 0;
  const invoicedCount = jobCards?.filter((jc) => jc.hasInvoice).length ?? 0;

  const columns = useMemo<ColumnDef<JobCardListItem>[]>(
    () => [
      {
        accessorKey: "jobDate",
        header: "Date",
        cell: ({ row }) => (
          <span className="font-medium text-slate-700 whitespace-nowrap">
            {row.original.jobDate}
          </span>
        ),
      },
      {
        accessorKey: "clientName",
        header: "Client",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-charcoal-900 leading-tight">{row.original.clientName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{row.original.clientPhone}</p>
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
            {row.original.status.replace("_", " ")}
          </span>
        ),
      },
      {
        accessorKey: "hasInvoice",
        header: "Invoice",
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
              row.original.hasInvoice
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "text-slate-400"
            )}
          >
            {row.original.hasInvoice ? "Generated" : "—"}
          </span>
        ),
      },
    ],
    []
  );

  function exportCsv() {
    downloadCsv(
      "job-cards.csv",
      filteredData.map((jc) => ({
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

  const isLoading = jobCards === null;

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar orgName={orgName} onLogout={logout} />

      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          title="Job Cards"
          subtitle="Every service visit, from vehicle intake to invoice collection"
          actions={
            <button
              onClick={() => navigate("/job-cards/new")}
              className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-charcoal-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Job Card
            </button>
          }
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Total Job Cards"
                value={jobCards?.length ?? 0}
                icon={ClipboardList}
                loading={isLoading}
                subtext="All intake records across current branch"
              />
              <MetricCard
                title="Completed Services"
                value={completedCount}
                icon={CheckCircle2}
                loading={isLoading}
                delta={{
                  value: jobCards?.length ? `${Math.round((completedCount / jobCards.length) * 100)}%` : "0%",
                  trend: "up",
                  label: "Completion rate",
                }}
              />
              <MetricCard
                title="Invoiced Jobs"
                value={invoicedCount}
                icon={Receipt}
                loading={isLoading}
                subtext="Converted to client billings"
              />
              <MetricCard
                title="Total Value"
                value={`₹${(totalRevenue / 100).toLocaleString("en-IN")}`}
                icon={IndianRupee}
                loading={isLoading}
                subtext="Gross intake revenue potential"
              />
            </div>

            {/* Modern Headless Data Table */}
            <div className="mt-8">
              <DataTable
                columns={columns}
                data={filteredData}
                searchPlaceholder="Search client name, phone number, vehicle plate..."
                onExportCsv={exportCsv}
                onRowClick={(row) => navigate(`/job-cards/${row.id}`)}
                filters={
                  <Dropdown
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="w-40"
                    size="sm"
                    capitalize
                    options={[
                      { value: "all", label: "All statuses" },
                      ...["draft", "in_progress", "completed", "billed", "cancelled"].map((s) => ({
                        value: s,
                        label: s.replace("_", " "),
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
