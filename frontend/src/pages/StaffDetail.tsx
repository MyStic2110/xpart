import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle, CheckCircle2, Wallet, CalendarCheck, BarChart3, UserCog, Edit, X } from "lucide-react";
import {
  api,
  StaffListItem,
  AttendanceRecord,
  AttendanceMonthSummary,
  PayrollBreakdown,
  PayrollRecord,
  Branch,
} from "../api";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import FloatingInput from "../components/FloatingInput";
import FileInput from "../components/FileInput";

const STATUS_STYLES: Record<AttendanceRecord["status"], string> = {
  present: "bg-emerald-50 text-emerald-600",
  half_day: "bg-amber-50 text-amber-600",
  absent: "bg-red-50 text-red-600",
  leave: "bg-slate-100 text-slate-500",
  lop: "bg-red-100 text-red-700",
};

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function MonthlyChart({ data }: { data: AttendanceMonthSummary[] }) {
  const max = Math.max(...data.map((d) => d.avgHoursPerDay), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex items-end justify-center h-32">
            <div
              className="w-full max-w-[22px] rounded-t-md bg-accent-500/80 transition-all"
              style={{ height: `${(d.avgHoursPerDay / max) * 100}%`, minHeight: d.avgHoursPerDay > 0 ? 4 : 0 }}
              title={`${d.avgHoursPerDay}h/day avg`}
            />
          </div>
          <span className="text-[10px] text-slate-400">{d.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function GenderToggle({ value, onChange }: { value: "male" | "female"; onChange: (v: "male" | "female") => void }) {
  return (
    <div>
      <label className="text-[13px] font-medium text-slate-500">Gender *</label>
      <div className="mt-1.5 flex gap-2">
        {(["male", "female"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onChange(g)}
            className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
              value === g ? "bg-charcoal-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkingHours({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[13px] font-medium text-slate-500">Working hours *</label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="text"
          value={start}
          placeholder="09:00 AM"
          onChange={(e) => onStart(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none"
        />
        <span className="text-slate-400">to</span>
        <input
          type="text"
          value={end}
          placeholder="11:55 PM"
          onChange={(e) => onEnd(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function StaffDetail() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [staff, setStaff] = useState<StaffListItem | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mechanicForm, setMechanicForm] = useState<any>({
    name: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    gender: "male",
    dateOfBirth: "",
    workingHoursStart: "09:00 AM",
    workingHoursEnd: "11:55 PM",
    monthlySalary: 0,
    dateOfJoining: new Date().toISOString().slice(0, 10),
    emergencyContactNumber: "",
    emergencyContactPerson: "",
    address: "",
    idProofUrl: "",
    photoUrl: "",
    branchId: "",
    mechanicType: "",
    serviceCommissionPct: undefined,
    productCommissionPct: undefined,
  });

  const [staffForm, setStaffForm] = useState<any>({
    name: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    gender: "male",
    dateOfBirth: "",
    workingHoursStart: "09:00 AM",
    workingHoursEnd: "11:55 PM",
    monthlySalary: 0,
    dateOfJoining: new Date().toISOString().slice(0, 10),
    emergencyContactNumber: "",
    emergencyContactPerson: "",
    address: "",
    idProofUrl: "",
    photoUrl: "",
    branchId: "",
    userType: "admin",
    department: "",
  });

  const [markDate, setMarkDate] = useState(new Date().toISOString().slice(0, 10));
  const [markStatus, setMarkStatus] = useState<AttendanceRecord["status"]>("present");
  const [markHours, setMarkHours] = useState("9");
  const [marking, setMarking] = useState(false);

  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [summary, setSummary] = useState<AttendanceMonthSummary[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const [month, setMonth] = useState(thisMonth());
  const [preview, setPreview] = useState<PayrollBreakdown | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<PayrollRecord[] | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  function loadAll() {
    api.listBranches().then(setBranches).catch(() => {});
    api.listStaff().then((rows) => {
      const found = rows.find((r) => r.userId === userId);
      if (!found) setError("staff member not found");
      setStaff(found ?? null);
    }).catch((err) => setError(err.message));

    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = `${now.getFullYear()}-12-31`;
    api.listAttendance(userId, from, to).then(setHistory).catch(() => {});
    api.attendanceSummary(userId, year).then(setSummary).catch(() => {});
    api.payrollHistory(userId).then(setPayoutHistory).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    loadAll();
  }, [userId]);

  useEffect(() => {
    api.attendanceSummary(userId, year).then(setSummary).catch(() => {});
  }, [year, userId]);

  useEffect(() => {
    if (!staff || !staff.profile) {
      setPreview(null);
      return;
    }
    setPreview(null);
    api.payrollPreview(userId, month).then(setPreview).catch((err) => setError(err.message));
  }, [month, userId, staff]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function openEdit() {
    if (!staff) return;
    const isMechanic = staff.profile?.category === "mechanic";
    if (isMechanic) {
      setMechanicForm({
        name: staff.name,
        phone: staff.phone,
        email: staff.email ?? "",
        username: staff.username ?? "",
        password: "",
        confirmPassword: "",
        gender: staff.profile?.gender ?? "male",
        dateOfBirth: staff.profile?.dateOfBirth ?? "",
        workingHoursStart: staff.profile?.workingHoursStart ?? "09:00 AM",
        workingHoursEnd: staff.profile?.workingHoursEnd ?? "11:55 PM",
        monthlySalary: (staff.profile?.monthlySalary || 0) / 100,
        dateOfJoining: staff.profile?.dateOfJoining ?? new Date().toISOString().slice(0, 10),
        emergencyContactNumber: staff.profile?.emergencyContactNumber ?? "",
        emergencyContactPerson: staff.profile?.emergencyContactPerson ?? "",
        address: staff.profile?.address ?? "",
        idProofUrl: staff.profile?.idProofUrl ?? "",
        photoUrl: staff.profile?.photoUrl ?? "",
        branchId: staff.branchId ?? "",
        mechanicType: staff.profile?.mechanicType ?? "",
        serviceCommissionPct: staff.profile?.serviceCommissionPct ? Number(staff.profile.serviceCommissionPct) : undefined,
        productCommissionPct: staff.profile?.productCommissionPct ? Number(staff.profile.productCommissionPct) : undefined,
      });
    } else {
      setStaffForm({
        name: staff.name,
        phone: staff.phone,
        email: staff.email ?? "",
        username: staff.username ?? "",
        password: "",
        confirmPassword: "",
        gender: staff.profile?.gender ?? "male",
        dateOfBirth: staff.profile?.dateOfBirth ?? "",
        workingHoursStart: staff.profile?.workingHoursStart ?? "09:00 AM",
        workingHoursEnd: staff.profile?.workingHoursEnd ?? "11:55 PM",
        monthlySalary: (staff.profile?.monthlySalary || 0) / 100,
        dateOfJoining: staff.profile?.dateOfJoining ?? new Date().toISOString().slice(0, 10),
        emergencyContactNumber: staff.profile?.emergencyContactNumber ?? "",
        emergencyContactPerson: staff.profile?.emergencyContactPerson ?? "",
        address: staff.profile?.address ?? "",
        idProofUrl: staff.profile?.idProofUrl ?? "",
        photoUrl: staff.profile?.photoUrl ?? "",
        branchId: staff.branchId ?? "",
        userType: staff.profile?.userType ?? "admin",
        department: staff.profile?.department ?? "",
      });
    }
    setShowEditForm(true);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!staff) return;
    const isMechanic = staff.profile?.category === "mechanic";
    setSaving(true);
    try {
      if (isMechanic) {
        if (mechanicForm.password && mechanicForm.password !== mechanicForm.confirmPassword) {
          setError("passwords do not match");
          setSaving(false);
          return;
        }
        await api.updateMechanic(userId, mechanicForm);
      } else {
        if (staffForm.password && staffForm.password !== staffForm.confirmPassword) {
          setError("passwords do not match");
          setSaving(false);
          return;
        }
        await api.updateStaffMember(userId, staffForm);
      }
      setNotice("Details updated successfully");
      setTimeout(() => setNotice(""), 2000);
      setShowEditForm(false);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not update staff member");
    } finally {
      setSaving(false);
    }
  }

  async function submitMark(e: React.FormEvent) {
    e.preventDefault();
    setMarking(true);
    setError("");
    try {
      await api.markAttendance({
        userId,
        date: markDate,
        status: markStatus,
        hoursWorked: markStatus === "present" || markStatus === "half_day" ? Number(markHours) : 0,
      });
      setNotice("Attendance saved");
      setTimeout(() => setNotice(""), 2000);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not mark attendance");
    } finally {
      setMarking(false);
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError("");
    try {
      await api.finalizePayroll(userId, month);
      setNotice("Payroll finalized and marked paid");
      setTimeout(() => setNotice(""), 2500);
      api.payrollHistory(userId).then(setPayoutHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not finalize payroll");
    } finally {
      setFinalizing(false);
    }
  }

  const alreadyPaid = payoutHistory?.some((p) => p.month === month && p.status === "paid");

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 sm:px-12 py-10">
          <Link to="/users" className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-charcoal-900">
            <ArrowLeft size={14} />
            Back to users
          </Link>

          {!staff ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-between animate-slideUp">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">{staff.name}</h1>
                  <button
                    onClick={openEdit}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-charcoal-900 active:scale-95"
                  >
                    <Edit size={12} />
                    Edit Details
                  </button>
                </div>
                <p className="mt-1 text-[14px] text-slate-400 capitalize">
                  {staff.profile?.category || "staff"} · {staff.phone}
                  {staff.profile?.category === "mechanic" && staff.profile?.mechanicType ? ` · ${staff.profile.mechanicType}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-slate-400">Monthly salary</p>
                <p className="text-[20px] font-semibold text-charcoal-900">{staff.profile ? rupees(staff.profile.monthlySalary) : "—"}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600 animate-fadeIn">
              <CheckCircle2 size={15} />
              <span>{notice}</span>
            </div>
          )}

          {staff && !staff.profile ? (
            <div className="mt-8 bg-white border border-slate-100 rounded-xl p-8 text-center max-w-2xl mx-auto shadow-card">
              <UserCog size={40} className="mx-auto text-slate-400 mb-3 animate-pulse" />
              <h3 className="text-[16px] font-semibold text-charcoal-900">Administrative Owner Account</h3>
              <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">
                This user is the primary administrative organization owner. Administrative owner accounts hold global access credentials but do not have active staff profiles for shift assignment, hourly attendance tracking, payroll computation, or service commission splits.
              </p>
              <p className="mt-4 text-[12.5px] text-slate-400">
                To track attendance or compute payroll for this individual, add them as a staff member or mechanic in the Users tab.
              </p>
            </div>
          ) : (
            <>
              {/* Mark attendance */}
              <div className="mt-8 rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarCheck size={16} className="text-slate-400" />
                  <h3 className="text-[15px] font-semibold text-charcoal-900">Mark attendance</h3>
                </div>
                <form onSubmit={submitMark} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-[12px] font-medium text-slate-400">Date</label>
                    <input type="date" value={markDate} onChange={(e) => setMarkDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-slate-400">Status</label>
                    <Dropdown
                      value={markStatus}
                      onChange={(v) => setMarkStatus(v as AttendanceRecord["status"])}
                      className="mt-1 w-36"
                      size="sm"
                      capitalize
                      options={(["present", "half_day", "absent", "leave", "lop"] as const).map((s) => ({ value: s, label: s.replace("_", " ") }))}
                    />
                  </div>
                  {(markStatus === "present" || markStatus === "half_day") && (
                    <div>
                      <label className="text-[12px] font-medium text-slate-400">Hours worked</label>
                      <input type="number" step="0.5" value={markHours} onChange={(e) => setMarkHours(e.target.value)} className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                    </div>
                  )}
                  <button type="submit" disabled={marking} className="rounded-lg bg-charcoal-900 px-4 py-2 text-[13px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                    {marking ? "Saving..." : "Save attendance"}
                  </button>
                </form>
              </div>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance history */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                  <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Attendance history</h3>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {!history ? (
                      <Skeleton className="h-32 w-full" />
                    ) : history.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-400">No attendance recorded yet.</p>
                    ) : (
                      [...history].reverse().map((h) => (
                        <div key={h.id} className="flex items-center justify-between py-2.5 text-[13px]">
                          <span className="text-charcoal-900 font-medium">{h.date}</span>
                          <span className="text-slate-400">{Number(h.hoursWorked) > 0 ? `${h.hoursWorked}h` : "—"}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${STATUS_STYLES[h.status]}`}>
                            {h.status.replace("_", " ")}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Yearly chart */}
                <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} className="text-slate-400" />
                      <h3 className="text-[15px] font-semibold text-charcoal-900">Avg hours/day by month</h3>
                    </div>
                    <Dropdown
                      value={year}
                      onChange={setYear}
                      className="w-24"
                      size="sm"
                      options={[year, (Number(year) - 1).toString()].map((y) => ({ value: y, label: y }))}
                    />
                  </div>
                  {!summary ? <Skeleton className="h-40 w-full" /> : <MonthlyChart data={summary} />}
                </div>
              </div>

              {/* Payroll */}
              <div className="mt-6 rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} className="text-slate-400" />
                    <h3 className="text-[15px] font-semibold text-charcoal-900">Payroll</h3>
                  </div>
                  <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px]" />
                </div>

                {!preview ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Base salary", value: rupees(preview.baseSalary) },
                        { label: "Present days", value: preview.presentDays },
                        { label: "LOP days", value: preview.lopDays },
                        { label: "LOP deduction", value: `−${rupees(preview.lopDeduction)}` },
                        { label: "Revenue generated", value: rupees(preview.revenueGenerated) },
                        { label: "Service commission", value: `+${rupees(preview.serviceCommissionEarned)}` },
                        { label: "Other deductions", value: `−${rupees(preview.otherDeductions)}` },
                        { label: "Net payout", value: rupees(preview.netPayout) },
                      ].map((m) => (
                        <div key={m.label}>
                          <p className="text-[11px] font-medium text-slate-400">{m.label}</p>
                          <p className="mt-1 text-[15px] font-semibold text-charcoal-900">{m.value}</p>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={finalize}
                      disabled={finalizing || alreadyPaid}
                      className="mt-6 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
                    >
                      {alreadyPaid ? "Already paid for this month" : finalizing ? "Finalizing..." : "Finalize & mark paid"}
                    </button>
                  </>
                )}

                <div className="mt-8 border-t border-slate-100 pt-5">
                  <h4 className="text-[13px] font-semibold text-charcoal-900 mb-3">Payout history</h4>
                  {!payoutHistory ? (
                    <Skeleton className="h-20 w-full" />
                  ) : payoutHistory.length === 0 ? (
                    <p className="text-sm text-slate-400">No payouts finalized yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {payoutHistory.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2.5 text-[13px]">
                          <span className="font-medium text-charcoal-900">{p.month}</span>
                          <span className="text-slate-400">Net {rupees(p.netPayout)}</span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 capitalize">{p.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {showEditForm && staff && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">
                Edit {staff.profile?.category === "mechanic" ? "mechanic" : "staff member"}
              </h2>
              <button onClick={() => setShowEditForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitEdit} className="flex flex-col gap-4 px-6 py-6">
              {staff.profile?.category === "mechanic" ? (
                <>
                  <FloatingInput
                    label="Mechanic name"
                    value={mechanicForm.name}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                  />

                  <div>
                    <label className="text-[13px] font-medium text-slate-500">Branch *</label>
                    <Dropdown
                      value={mechanicForm.branchId}
                      onChange={(v) => setMechanicForm((f: any) => ({ ...f, branchId: v }))}
                      placeholder="Select branch"
                      className="mt-1.5 w-full"
                      options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.city }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FloatingInput
                      label="Service commission %"
                      type="number"
                      value={mechanicForm.serviceCommissionPct ?? ""}
                      onChange={(e) =>
                        setMechanicForm((f: any) => ({
                          ...f,
                          serviceCommissionPct: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                    />
                    <FloatingInput
                      label="Product commission %"
                      type="number"
                      value={mechanicForm.productCommissionPct ?? ""}
                      onChange={(e) =>
                        setMechanicForm((f: any) => ({
                          ...f,
                          productCommissionPct: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <FloatingInput
                    label="Date of birth"
                    type="date"
                    value={mechanicForm.dateOfBirth}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, dateOfBirth: e.target.value }))}
                  />

                  <WorkingHours
                    start={mechanicForm.workingHoursStart}
                    end={mechanicForm.workingHoursEnd}
                    onStart={(v) => setMechanicForm((f: any) => ({ ...f, workingHoursStart: v }))}
                    onEnd={(v) => setMechanicForm((f: any) => ({ ...f, workingHoursEnd: v }))}
                  />

                  <FloatingInput
                    label="Monthly salary"
                    type="number"
                    value={mechanicForm.monthlySalary || ""}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, monthlySalary: Number(e.target.value) }))}
                    required
                  />

                  <FloatingInput
                    label="Emergency contact number"
                    value={mechanicForm.emergencyContactNumber}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, emergencyContactNumber: e.target.value }))}
                  />
                  <FloatingInput
                    label="Emergency contact person"
                    value={mechanicForm.emergencyContactPerson}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, emergencyContactPerson: e.target.value }))}
                  />
                  <FloatingInput
                    label="Address"
                    value={mechanicForm.address}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, address: e.target.value }))}
                  />

                  <FloatingInput
                    label="Username"
                    value={mechanicForm.username}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, username: e.target.value }))}
                  />
                  <FloatingInput
                    label="New Password (optional)"
                    type="password"
                    value={mechanicForm.password || ""}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, password: e.target.value }))}
                    helperText="Leave empty to keep existing password"
                  />
                  <FloatingInput
                    label="Confirm New Password"
                    type="password"
                    value={mechanicForm.confirmPassword || ""}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, confirmPassword: e.target.value }))}
                  />

                  <GenderToggle
                    value={mechanicForm.gender}
                    onChange={(g) => setMechanicForm((f: any) => ({ ...f, gender: g }))}
                  />

                  <FloatingInput
                    label="Date of joining"
                    type="date"
                    value={mechanicForm.dateOfJoining}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, dateOfJoining: e.target.value }))}
                    required
                  />

                  <FloatingInput
                    label="Mechanic Type"
                    value={mechanicForm.mechanicType}
                    onChange={(e) => setMechanicForm((f: any) => ({ ...f, mechanicType: e.target.value }))}
                    required
                    helperText="Helper, Junior, Senior, Specialist etc."
                  />

                  <FileInput
                    label="Upload ID proof"
                    onUploaded={(url) => setMechanicForm((f: any) => ({ ...f, idProofUrl: url }))}
                  />
                  <FileInput
                    label="Upload photo"
                    onUploaded={(url) => setMechanicForm((f: any) => ({ ...f, photoUrl: url }))}
                  />
                </>
              ) : (
                <>
                  <FloatingInput
                    label="Employee name"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                  />

                  <div>
                    <label className="text-[13px] font-medium text-slate-500">Branch *</label>
                    <Dropdown
                      value={staffForm.branchId}
                      onChange={(v) => setStaffForm((f: any) => ({ ...f, branchId: v }))}
                      placeholder="Select branch"
                      className="mt-1.5 w-full"
                      options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.city }))}
                    />
                  </div>

                  <FloatingInput
                    label="Date of birth"
                    type="date"
                    value={staffForm.dateOfBirth}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                  <FloatingInput
                    label="Contact number"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, phone: e.target.value }))}
                    required
                  />
                  <FloatingInput
                    label="Email address"
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, email: e.target.value }))}
                  />

                  <WorkingHours
                    start={staffForm.workingHoursStart}
                    end={staffForm.workingHoursEnd}
                    onStart={(v) => setStaffForm((f: any) => ({ ...f, workingHoursStart: v }))}
                    onEnd={(v) => setStaffForm((f: any) => ({ ...f, workingHoursEnd: v }))}
                  />

                  <FloatingInput
                    label="Monthly salary"
                    type="number"
                    value={staffForm.monthlySalary || ""}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, monthlySalary: Number(e.target.value) }))}
                    required
                  />

                  <FloatingInput
                    label="Emergency contact number"
                    value={staffForm.emergencyContactNumber}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, emergencyContactNumber: e.target.value }))}
                  />
                  <FloatingInput
                    label="Emergency contact person"
                    value={staffForm.emergencyContactPerson}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, emergencyContactPerson: e.target.value }))}
                  />
                  <FloatingInput
                    label="Address"
                    value={staffForm.address}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, address: e.target.value }))}
                  />

                  <FloatingInput
                    label="Username"
                    value={staffForm.username}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, username: e.target.value }))}
                  />
                  <FloatingInput
                    label="New Password (optional)"
                    type="password"
                    value={staffForm.password || ""}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, password: e.target.value }))}
                    helperText="Leave empty to keep existing password"
                  />
                  <FloatingInput
                    label="Confirm New Password"
                    type="password"
                    value={staffForm.confirmPassword || ""}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, confirmPassword: e.target.value }))}
                  />

                  <GenderToggle value={staffForm.gender} onChange={(g) => setStaffForm((f: any) => ({ ...f, gender: g }))} />

                  <FloatingInput
                    label="Date of joining"
                    type="date"
                    value={staffForm.dateOfJoining}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, dateOfJoining: e.target.value }))}
                    required
                  />

                  <div>
                    <label className="text-[13px] font-medium text-slate-500">User type *</label>
                    <Dropdown
                      value={staffForm.userType}
                      onChange={(v) => setStaffForm((f: any) => ({ ...f, userType: v }))}
                      className="mt-1.5 w-full"
                      options={[
                        { value: "admin", label: "Admin" },
                        { value: "frontdesk", label: "Front desk" },
                        { value: "branch_manager", label: "Branch manager" },
                        { value: "viewer", label: "Viewer" },
                      ]}
                    />
                  </div>

                  <FloatingInput
                    label="Department"
                    value={staffForm.department}
                    onChange={(e) => setStaffForm((f: any) => ({ ...f, department: e.target.value }))}
                    required
                    helperText="Sales, Management, Accounts, Operations etc."
                  />

                  <FileInput
                    label="Upload photo"
                    onUploaded={(url) => setStaffForm((f: any) => ({ ...f, photoUrl: url }))}
                  />
                  <FileInput
                    label="Upload ID proof"
                    onUploaded={(url) => setStaffForm((f: any) => ({ ...f, idProofUrl: url }))}
                  />
                </>
              )}

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
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
