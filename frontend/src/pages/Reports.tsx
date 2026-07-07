import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Download, Calendar, Filter, AlertCircle, FileText } from "lucide-react";
import { api, StaffListItem } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import { downloadCsv } from "../utils/csv";

type ReportType =
  | "daily-reports"
  | "day-summary"
  | "job-cards"
  | "billing"
  | "enquiries"
  | "mechanics"
  | "payments"
  | "balance-due"
  | "attendance"
  | "sms-history";

interface ReportCategory {
  id: ReportType;
  name: string;
  description: string;
  supportsUserFilter: boolean;
  userFilterLabel?: string;
}

const REPORT_CATEGORIES: ReportCategory[] = [
  { id: "daily-reports", name: "Daily Reports", description: "Summary of days: job cards, invoices, payments, and discounts.", supportsUserFilter: false },
  { id: "day-summary", name: "Day Summary", description: "Detailed log of individual entries (job cards, invoices, payments) in date order.", supportsUserFilter: false },
  { id: "job-cards", name: "Job Card Report", description: "Detailed listing of job cards with client details, advisor, mechanics, and value.", supportsUserFilter: true, userFilterLabel: "Service Advisor" },
  { id: "billing", name: "Billing Reports", description: "Details of invoices raised, final status, and total billing values.", supportsUserFilter: false },
  { id: "enquiries", name: "Enquiry Reports", description: "Lead tracking, enquiry type, follow-up schedule, and representative performance.", supportsUserFilter: true, userFilterLabel: "Representative" },
  { id: "mechanics", name: "Mechanic Reports", description: "Performance auditing showing completed cards, total attributed revenue, and commissions.", supportsUserFilter: true, userFilterLabel: "Mechanic" },
  { id: "payments", name: "Received Payments", description: "Payment transactional log grouped by mode, invoice reference, and date.", supportsUserFilter: false },
  { id: "balance-due", name: "Balance Reports", description: "Outstanding client ledger tracking invoices billed vs payments received.", supportsUserFilter: false },
  { id: "attendance", name: "Attendance report", description: "Attendance records showing hours worked, status, and check-in times.", supportsUserFilter: true, userFilterLabel: "Employee" },
  { id: "sms-history", name: "SMS History", description: "Outbound/Inbound enquiry communications channel log (SMS/WhatsApp).", supportsUserFilter: false },
];

type Preset = "today" | "yesterday" | "last7" | "last30" | "custom";

export default function Reports() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [activeReport, setActiveReport] = useState<ReportType>("daily-reports");
  
  // Filters
  const { branchId, branches } = useBranch();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [preset, setPreset] = useState<Preset>("last7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Data
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    api.listStaff().then(setStaff).catch(() => {});
  }, []);

  // Sync selected branch context default
  useEffect(() => {
    setSelectedBranch(branchId);
  }, [branchId]);

  // Set date ranges on preset change
  useEffect(() => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === "today") {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (preset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      setStartDate(formatDate(yesterday));
      setEndDate(formatDate(yesterday));
    } else if (preset === "last7") {
      const last7 = new Date();
      last7.setDate(today.getDate() - 6);
      setStartDate(formatDate(last7));
      setEndDate(formatDate(today));
    } else if (preset === "last30") {
      const last30 = new Date();
      last30.setDate(today.getDate() - 29);
      setStartDate(formatDate(last30));
      setEndDate(formatDate(today));
    }
  }, [preset]);

  // Fetch report data when filter details change
  const fetchReportData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError("");
    setReportData(null);
    try {
      const params = {
        branchId: selectedBranch === "all" ? undefined : selectedBranch,
        userId: selectedUser === "all" ? undefined : selectedUser,
        startDate,
        endDate,
      };
      const res = await api.getReport<any>(activeReport, params);
      setReportData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeReport, selectedBranch, selectedUser, startDate, endDate]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  // Columns definition based on active report
  const columns = useMemo((): { header: string; cell: (row: any) => React.ReactNode; key: string }[] => {
    const fmtMoney = (v: number) => `₹${((v || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    const fmtDate = (v: string) => (v ? new Date(v).toLocaleDateString("en-IN") : "—");
    
    switch (activeReport) {
      case "daily-reports":
        return [
          { header: "Date", key: "date", cell: (r) => fmtDate(r.date) },
          { header: "Job Cards", key: "jobCardsCount", cell: (r) => r.jobCardsCount },
          { header: "Invoices", key: "invoicesCount", cell: (r) => r.invoicesCount },
          { header: "Invoiced Total", key: "invoicedAmount", cell: (r) => fmtMoney(r.invoicedAmount) },
          { header: "Collected Amount", key: "paymentsCollected", cell: (r) => fmtMoney(r.paymentsCollected) },
          { header: "Discounts Given", key: "discountsGiven", cell: (r) => fmtMoney(r.discountsGiven) },
        ];
      case "day-summary":
        return [
          { header: "Date", key: "date", cell: (r) => fmtDate(r.date) },
          { header: "Type", key: "type", cell: (r) => r.type },
          { header: "Reference", key: "referenceId", cell: (r) => `#${r.referenceId}` },
          { header: "Client", key: "clientName", cell: (r) => r.clientName },
          { header: "Details", key: "detail", cell: (r) => r.detail },
          { header: "Value", key: "value", cell: (r) => r.value > 0 ? fmtMoney(r.value) : "—" },
        ];
      case "job-cards":
        return [
          { header: "Date", key: "jobDate", cell: (r) => fmtDate(r.jobDate) },
          { header: "Plate", key: "plateNumber", cell: (r) => r.plateNumber },
          { header: "Client Name", key: "clientName", cell: (r) => r.clientName },
          { header: "Advisor", key: "advisorName", cell: (r) => r.advisorName || "—" },
          { header: "Mechanics", key: "mechanics", cell: (r) => r.mechanics || "—" },
          { header: "Status", key: "status", cell: (r) => <span className={`capitalize font-medium ${r.status === "completed" || r.status === "billed" ? "text-emerald-600" : "text-amber-600"}`}>{r.status}</span> },
          { header: "Total Value", key: "total", cell: (r) => fmtMoney(r.total) },
        ];
      case "billing":
        return [
          { header: "Date", key: "createdAt", cell: (r) => fmtDate(r.createdAt) },
          { header: "Client", key: "clientName", cell: (r) => r.clientName },
          { header: "Plate", key: "plateNumber", cell: (r) => r.plateNumber },
          { header: "Subtotal", key: "subtotal", cell: (r) => fmtMoney(r.subtotal) },
          { header: "Discount", key: "discount", cell: (r) => fmtMoney(r.discount) },
          { header: "Invoice Total", key: "total", cell: (r) => fmtMoney(r.total) },
          { header: "Status", key: "status", cell: (r) => <span className="capitalize font-medium">{r.status}</span> },
        ];
      case "enquiries":
        return [
          { header: "Date", key: "createdAt", cell: (r) => fmtDate(r.createdAt) },
          { header: "Client", key: "clientName", cell: (r) => r.clientName },
          { header: "Contact", key: "contactNumber", cell: (r) => r.contactNumber },
          { header: "Interest", key: "enquiryFor", cell: (r) => r.enquiryFor },
          { header: "Source", key: "sourceOfEnquiry", cell: (r) => r.sourceOfEnquiry },
          { header: "Channel", key: "channel", cell: (r) => <span className="uppercase text-[11px] font-bold text-slate-500">{r.channel}</span> },
          { header: "Representative", key: "repName", cell: (r) => r.repName || "—" },
          { header: "Status", key: "leadStatus", cell: (r) => <span className="capitalize">{r.leadStatus}</span> },
        ];
      case "mechanics":
        return [
          { header: "Mechanic", key: "name", cell: (r) => r.name },
          { header: "Job Cards", key: "jobCardsCount", cell: (r) => r.jobCardsCount },
          { header: "Invoices Completed", key: "invoicesCount", cell: (r) => r.invoicesCount },
          { header: "Attributed Revenue", key: "attributedRevenue", cell: (r) => fmtMoney(r.attributedRevenue) },
          { header: "Commission Rate", key: "commissionPct", cell: (r) => `${r.commissionPct}%` },
          { header: "Est. Commission", key: "estimatedCommission", cell: (r) => fmtMoney(r.estimatedCommission) },
        ];
      case "payments":
        return [
          { header: "Paid At", key: "paidAt", cell: (r) => fmtDate(r.paidAt) },
          { header: "Client Name", key: "clientName", cell: (r) => r.clientName },
          { header: "Plate", key: "plateNumber", cell: (r) => r.plateNumber },
          { header: "Mode", key: "mode", cell: (r) => <span className="uppercase font-medium text-slate-600">{r.mode}</span> },
          { header: "Txn Ref", key: "txnRef", cell: (r) => r.txnRef || "—" },
          { header: "Amount Received", key: "amount", cell: (r) => fmtMoney(r.amount) },
        ];
      case "balance-due":
        return [
          { header: "Billing Date", key: "createdAt", cell: (r) => fmtDate(r.createdAt) },
          { header: "Client Name", key: "clientName", cell: (r) => r.clientName },
          { header: "Phone", key: "clientPhone", cell: (r) => r.clientPhone },
          { header: "Total Value", key: "total", cell: (r) => fmtMoney(r.total) },
          { header: "Paid So Far", key: "paidSoFar", cell: (r) => fmtMoney(r.paidSoFar) },
          { header: "Outstanding Balance", key: "balanceDue", cell: (r) => <span className={`font-semibold ${r.balanceDue > 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtMoney(r.balanceDue)}</span> },
          { header: "Status", key: "status", cell: (r) => <span className="capitalize">{r.status}</span> },
        ];
      case "attendance":
        return [
          { header: "Date", key: "date", cell: (r) => fmtDate(r.date) },
          { header: "Employee", key: "employeeName", cell: (r) => r.employeeName },
          { header: "Status", key: "status", cell: (r) => <span className="capitalize">{(r.status || "").replace("_", " ")}</span> },
          { header: "In", key: "checkIn", cell: (r) => r.checkIn || "—" },
          { header: "Out", key: "checkOut", cell: (r) => r.checkOut || "—" },
          { header: "Hours", key: "hoursWorked", cell: (r) => r.hoursWorked },
          { header: "Notes", key: "notes", cell: (r) => r.notes || "—" },
        ];
      case "sms-history":
        return [
          { header: "Date", key: "createdAt", cell: (r) => fmtDate(r.createdAt) },
          { header: "Client Name", key: "clientName", cell: (r) => r.clientName },
          { header: "Phone", key: "contactNumber", cell: (r) => r.contactNumber },
          { header: "Channel", key: "channel", cell: (r) => <span className="uppercase text-[11px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">{r.channel}</span> },
          { header: "Type/Interest", key: "enquiryFor", cell: (r) => r.enquiryFor },
          { header: "Scheduled Follow-Up", key: "followUpDate", cell: (r) => fmtDate(r.followUpDate) },
          { header: "Status", key: "leadStatus", cell: (r) => <span className="capitalize">{r.leadStatus}</span> },
        ];
      default:
        return [];
    }
  }, [activeReport]);

  const activeCategory = useMemo(() => REPORT_CATEGORIES.find((c) => c.id === activeReport)!, [activeReport]);

  // CSV Exporter
  const handleExport = () => {
    if (!reportData) return;

    if (activeReport === "balance-due") {
      const csvRows: any[] = [];
      const fmtMoney = (v: number) => (v / 100).toFixed(2);
      const fmtDate = (v: string) => v ? new Date(v).toLocaleDateString("en-IN") : "";

      // Opening Balance
      csvRows.push({
        Date: "",
        Type: "Opening Balance",
        Details: "",
        Inflow: "",
        Outflow: "",
        Balance: fmtMoney(reportData.openingBalance),
      });

      // Received (Inflow) rows
      for (const r of reportData.received) {
        csvRows.push({
          Date: fmtDate(r.date),
          Type: r.type,
          Details: `${r.clientName} (${r.clientPhone}) ${r.invoiceNo ? `· Invoice: ${r.invoiceNo}` : ""}`,
          Inflow: fmtMoney(r.amountReceived),
          Outflow: "",
          Balance: "",
        });
      }

      // Expense (Outflow) rows
      for (const e of reportData.expenses) {
        csvRows.push({
          Date: fmtDate(e.date),
          Type: "Expense",
          Details: `${e.category} · Paid by: ${e.paidBy}`,
          Inflow: "",
          Outflow: fmtMoney(e.amountPaid),
          Balance: "",
        });
      }

      // Closing Balance
      csvRows.push({
        Date: "",
        Type: "Closing Balance",
        Details: "",
        Inflow: "",
        Outflow: "",
        Balance: fmtMoney(reportData.closingBalance),
      });

      downloadCsv(`balance-report-${startDate}-to-${endDate}.csv`, csvRows);
      return;
    }

    if (reportData.length === 0) return;
    
    // Convert report data into standard readable CSV rows
    const csvRows = reportData.map((row: any) => {
      const cleanRow: Record<string, any> = {};
      columns.forEach((col) => {
        // Evaluate cells to clean text (strip out React HTML tags/classes for clean raw values)
        const cellVal = col.cell(row);
        let strVal = "";
        if (typeof cellVal === "object" && cellVal !== null) {
          // If it returned a React node (like a styled span), extract child text if possible
          strVal = (cellVal as any).props?.children?.toString() || (cellVal as any).toString();
        } else {
          strVal = cellVal?.toString() || "";
        }
        cleanRow[col.header] = strVal;
      });
      return cleanRow;
    });

    const filename = `${activeReport}-${startDate}-to-${endDate}.csv`;
    downloadCsv(filename, csvRows);
  };

  const hasData = useMemo(() => {
    if (!reportData) return false;
    if (activeReport === "balance-due") {
      return reportData.received?.length > 0 || reportData.expenses?.length > 0;
    }
    return reportData.length > 0;
  }, [reportData, activeReport]);

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          
          {/* Header */}
          <div className="flex items-center justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Reports & Audits</h1>
              <p className="mt-1 text-[14px] text-slate-400">Download formatted business CSV intelligence with dynamic criteria mapping.</p>
            </div>
            {hasData && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 transition-colors shadow-sm"
              >
                <Download size={14} /> Download CSV
              </button>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar list of Reports */}
            <div className="lg:col-span-1 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3">Report Category</span>
              <div className="bg-white rounded-xl border border-slate-100 p-1.5 shadow-card space-y-0.5">
                {REPORT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveReport(cat.id);
                      setSelectedUser("all");
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                      activeReport === cat.id
                        ? "bg-charcoal-900 text-white font-semibold"
                        : "text-slate-500 hover:bg-slate-50 hover:text-charcoal-900"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Main reporting panel & preview */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Dynamic Filters Card */}
              <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4 text-charcoal-900 font-semibold text-[14px]">
                  <Filter size={15} />
                  <span>Configure Report Filters</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Branch filter */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Scope Branch</label>
                    <Dropdown
                      value={selectedBranch}
                      onChange={setSelectedBranch}
                      className="mt-1.5 w-full"
                      size="sm"
                      options={[
                        { value: "all", label: "All branches" },
                        ...branches.map((b) => ({ value: b.id, label: b.name, sub: b.city })),
                      ]}
                    />
                  </div>

                  {/* Optional User filter */}
                  {activeCategory.supportsUserFilter && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">
                        Filter By {activeCategory.userFilterLabel}
                      </label>
                      <Dropdown
                        value={selectedUser}
                        onChange={setSelectedUser}
                        className="mt-1.5 w-full"
                        size="sm"
                        options={[
                          { value: "all", label: `All ${activeCategory.userFilterLabel}s` },
                          ...staff
                            .filter((s) => (activeReport === "mechanics" ? s.profile?.category === "mechanic" : true))
                            .map((s) => ({ value: s.userId, label: s.name, sub: s.profile?.category || "staff" })),
                        ]}
                      />
                    </div>
                  )}

                  {/* Date Preset filter */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 uppercase">Date Range Criteria</label>
                    <Dropdown
                      value={preset}
                      onChange={(v) => setPreset(v as Preset)}
                      className="mt-1.5 w-full"
                      size="sm"
                      options={[
                        { value: "today", label: "Today" },
                        { value: "yesterday", label: "Yesterday" },
                        { value: "last7", label: "Last 7 Days" },
                        { value: "last30", label: "Last 30 Days" },
                        { value: "custom", label: "Custom Range" },
                      ]}
                    />
                  </div>
                </div>

                {/* Custom Date Inputs */}
                {preset === "custom" && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 animate-slideUp">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">From Date</label>
                      <div className="relative mt-1.5">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[13px] text-charcoal-900 focus:border-accent-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 uppercase">To Date</label>
                      <div className="relative mt-1.5">
                        <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[13px] text-charcoal-900 focus:border-accent-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Balance Report Summary Cards */}
              {activeReport === "balance-due" && reportData && !Array.isArray(reportData) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                  <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-card">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Opening Balance</span>
                    <p className="text-[20px] font-bold text-charcoal-900 mt-1">₹{(reportData.openingBalance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-card">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Received</span>
                    <p className="text-[20px] font-bold text-emerald-600 mt-1">+₹{(reportData.totalReceived / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-card">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Paid (Expenses)</span>
                    <p className="text-[20px] font-bold text-red-600 mt-1">-₹{(reportData.totalPaid / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-card text-white">
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Closing Balance</span>
                    <p className="text-[20px] font-bold text-sky-400 mt-1">₹{(reportData.closingBalance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}

              {/* Data Preview Grid */}
              {activeReport === "balance-due" ? (
                loading ? (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-card p-8 text-center"><Skeleton className="h-6 w-32 mx-auto" /><Skeleton className="h-40 w-full mt-4" /></div>
                ) : error ? (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-card p-8 text-center text-red-500 flex items-center justify-center gap-2"><AlertCircle size={15} /><span>{error}</span></div>
                ) : (!reportData || Array.isArray(reportData)) ? (
                  <div className="bg-white rounded-xl border border-slate-100 shadow-card p-12 text-center text-slate-400 text-[13px]">Select date range to view report.</div>
                ) : (
                  <div className="space-y-6">
                    {/* Inflow Table */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
                      <div className="border-b border-slate-100 px-6 py-4 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-semibold text-charcoal-900 text-[13px]">Amount Received</span>
                        <span className="text-[11px] font-bold text-emerald-600">Total: ₹{((reportData.totalReceived || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 bg-white">
                              <th className="px-6 py-3.5 whitespace-nowrap">Date</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Branch</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Invoice id</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Client name</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Client contact</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Advance received</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Pending payment</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Amount received</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportData.received.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-6 py-8 text-center text-slate-400 text-[13px]">No receipts found for this period.</td>
                              </tr>
                            ) : (
                              reportData.received.map((row: any, idx: number) => (
                                <tr key={idx} className="text-[13px] text-charcoal-900 hover:bg-slate-50/50">
                                  <td className="px-6 py-3.5 whitespace-nowrap">{new Date(row.date).toLocaleDateString("en-IN")}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap text-slate-500">{row.branchName}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap font-medium text-slate-600">{row.invoiceNo || "—"}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap font-semibold">{row.clientName}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap text-slate-400">{row.clientPhone}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap text-slate-400">₹{(row.advanceReceived / 100).toFixed(2)}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap text-slate-400">₹{(row.pendingPayment / 100).toFixed(2)}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap font-bold text-emerald-600">₹{(row.amountReceived / 100).toFixed(2)}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                      row.type === "Wallet" ? "bg-blue-50 text-blue-600 border-blue-100" :
                                      row.type === "Bill" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                      "bg-amber-50 text-amber-600 border-amber-100"
                                    }`}>{row.type}</span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Expenses Table */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
                      <div className="border-b border-slate-100 px-6 py-4 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-semibold text-charcoal-900 text-[13px]">Expenses</span>
                        <span className="text-[11px] font-bold text-red-600">Total: ₹{((reportData.totalPaid || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 bg-white">
                              <th className="px-6 py-3.5 whitespace-nowrap">Date</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Category</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Amount paid</th>
                              <th className="px-6 py-3.5 whitespace-nowrap">Paid by</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportData.expenses.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-[13px]">No expenses found for this period.</td>
                              </tr>
                            ) : (
                              reportData.expenses.map((row: any, idx: number) => (
                                <tr key={idx} className="text-[13px] text-charcoal-900 hover:bg-slate-50/50">
                                  <td className="px-6 py-3.5 whitespace-nowrap">{new Date(row.date).toLocaleDateString("en-IN")}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap font-medium">{row.category}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap font-bold text-red-600">₹{(row.amountPaid / 100).toFixed(2)}</td>
                                  <td className="px-6 py-3.5 whitespace-nowrap text-slate-500">{row.paidBy}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
                  <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-slate-400" />
                      <span className="font-semibold text-charcoal-900 text-[13px]">
                        {activeCategory.name} Preview (showing first 10 rows)
                      </span>
                    </div>
                    {reportData && Array.isArray(reportData) && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        Total filtered rows: {reportData.length}
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 bg-white">
                          {columns.map((col) => (
                            <th key={col.key} className="px-6 py-3.5 whitespace-nowrap">
                              {col.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                              {columns.map((col) => (
                                <td key={col.key} className="px-6 py-4">
                                  <Skeleton className="h-3 w-16" />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : error ? (
                          <tr>
                            <td colSpan={columns.length} className="px-6 py-8 text-center text-red-500">
                              <div className="flex items-center justify-center gap-2">
                                <AlertCircle size={15} />
                                <span>{error}</span>
                              </div>
                            </td>
                          </tr>
                        ) : (!reportData || !Array.isArray(reportData) || reportData.length === 0) ? (
                          <tr>
                            <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 text-[13px]">
                              No records found matching filters for this period.
                            </td>
                          </tr>
                        ) : (
                          reportData.slice(0, 10).map((row: any, idx: number) => (
                            <tr key={row.id || idx} className="text-[13px] text-charcoal-900 hover:bg-slate-50/50">
                              {columns.map((col) => (
                                <td key={col.key} className="px-6 py-3.5 whitespace-nowrap">
                                  {col.cell(row)}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
