import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Users as UsersIcon, Eye, Wrench, UserCog, Wallet, XCircle } from "lucide-react";
import { api, StaffListItem, MechanicFormInput, StaffMemberFormInput, Branch } from "../api";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import FloatingInput from "../components/FloatingInput";
import FileInput from "../components/FileInput";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import { downloadCsv } from "../utils/csv";

type Tab = "mechanics" | "staff";
const PAGE_SIZE = 8;

const EMPTY_MECHANIC: MechanicFormInput = {
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
};

const EMPTY_STAFF: StaffMemberFormInput = {
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
};

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
          onChange={(e) => onStart(e.target.value)}
          placeholder="09:00 AM"
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none"
        />
        <span className="text-slate-400">—</span>
        <input
          type="text"
          value={end}
          onChange={(e) => onEnd(e.target.value)}
          placeholder="11:55 PM"
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("mechanics");
  const [orgName, setOrgName] = useState("Workspace");
  const [staff, setStaff] = useState<StaffListItem[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showMechanicForm, setShowMechanicForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [mechanicForm, setMechanicForm] = useState<MechanicFormInput>(EMPTY_MECHANIC);
  const [staffForm, setStaffForm] = useState<StaffMemberFormInput>(EMPTY_STAFF);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  function load() {
    api.listStaff().then(setStaff).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    api.listBranches().then(setBranches).catch(() => {});
    load();
  }, []);

  useEffect(() => setPage(1), [search, tab]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const mechanics = staff?.filter((s) => s.profile?.category === "mechanic") ?? null;
  const staffMembers = staff?.filter((s) => s.profile?.category === "staff" || !s.profile) ?? null;

  const totalMonthlyPayroll = staff?.reduce((sum, s) => sum + (s.profile?.monthlySalary || 0), 0) ?? 0;

  async function submitMechanic(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mechanicForm.password !== mechanicForm.confirmPassword) {
      setError("passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.createMechanic(mechanicForm);
      setMechanicForm(EMPTY_MECHANIC);
      setShowMechanicForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not add mechanic");
    } finally {
      setSaving(false);
    }
  }

  async function submitStaff(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (staffForm.password !== staffForm.confirmPassword) {
      setError("passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.createStaffMember(staffForm);
      setStaffForm(EMPTY_STAFF);
      setShowStaffForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not add staff");
    } finally {
      setSaving(false);
    }
  }

  const baseRows = tab === "mechanics" ? mechanics : staffMembers;

  const filtered = useMemo(() => {
    if (!baseRows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.branchName ?? "").toLowerCase().includes(q)
    );
  }, [baseRows, search]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    downloadCsv(
      tab === "mechanics" ? "mechanics.csv" : "staff.csv",
      filtered.map((s) => ({
        Name: s.name,
        Branch: s.branchName ?? "",
        Phone: s.phone,
        Email: s.email ?? "",
        WorkingHours: s.profile ? `${s.profile.workingHoursStart} - ${s.profile.workingHoursEnd}` : "—",
        MonthlySalary: s.profile ? (s.profile.monthlySalary / 100).toFixed(2) : "0.00",
        ...(tab === "mechanics"
          ? {
              MechanicType: s.profile?.mechanicType ?? "",
              ServiceCommissionPct: s.profile?.serviceCommissionPct ?? "",
              ProductCommissionPct: s.profile?.productCommissionPct ?? "",
            }
          : { UserType: s.profile?.userType ?? "owner", Department: s.profile?.department ?? "Executive" }),
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
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Users</h1>
              <p className="mt-1 text-[14px] text-slate-400">Manage mechanics and staff across your business.</p>
            </div>
            <button
              onClick={() => {
                const defaultBranch = branches[0]?.id ?? "";
                if (tab === "mechanics") {
                  setMechanicForm((f) => ({ ...f, branchId: f.branchId || defaultBranch }));
                  setShowMechanicForm(true);
                } else {
                  setStaffForm((f) => ({ ...f, branchId: f.branchId || defaultBranch }));
                  setShowStaffForm(true);
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-charcoal-800"
            >
              <Plus size={15} />
              {tab === "mechanics" ? "Add mechanic" : "Add staff"}
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard label="Total users" value={staff?.length ?? 0} icon={UserCog} loading={!staff} />
            <StatCard label="Mechanics" value={mechanics?.length ?? 0} icon={Wrench} loading={!staff} />
            <StatCard label="Staff" value={staffMembers?.length ?? 0} icon={UsersIcon} loading={!staff} />
            <StatCard label="Total monthly payroll" value={`₹${(totalMonthlyPayroll / 100).toLocaleString("en-IN")}`} icon={Wallet} loading={!staff} />
          </div>

          <div className="mt-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {(["mechanics", "staff"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
                  tab === t ? "bg-white text-charcoal-900 shadow-card" : "text-slate-500 hover:text-charcoal-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {error && !showMechanicForm && !showStaffForm && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6">
            <TableToolbar
              search={search}
              onSearch={setSearch}
              placeholder={`Search ${tab}...`}
              onDownload={exportCsv}
            />
          </div>

          <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                    <th className="px-5 py-3.5 whitespace-nowrap">Name</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Branch</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Contact number</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Working hours</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Monthly salary</th>
                    {tab === "mechanics" ? (
                      <>
                        <th className="px-5 py-3.5 whitespace-nowrap">Mechanic type</th>
                        <th className="px-5 py-3.5 whitespace-nowrap">Service comm.</th>
                        <th className="px-5 py-3.5 whitespace-nowrap">Product comm.</th>
                      </>
                    ) : (
                      <>
                        <th className="px-5 py-3.5 whitespace-nowrap">User type</th>
                        <th className="px-5 py-3.5 whitespace-nowrap">Department</th>
                      </>
                    )}
                    <th className="px-5 py-3.5 whitespace-nowrap text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!baseRows ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td key={j} className="px-5 py-4">
                            <Skeleton className="h-4 w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-16 text-center">
                        {baseRows.length === 0 ? (
                          <>
                            <UsersIcon size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">
                              No {tab === "mechanics" ? "mechanics" : "staff"} yet
                            </p>
                            <p className="mt-1 text-sm text-slate-400">Add your first {tab === "mechanics" ? "mechanic" : "staff member"} to get started.</p>
                          </>
                        ) : (
                          <>
                            <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">No matching results</p>
                            <p className="mt-1 text-sm text-slate-400">Try a different search term.</p>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((s) => (
                      <tr
                        key={s.userId}
                        onClick={() => navigate(`/users/${s.userId}`)}
                        className="cursor-pointer text-[13.5px] text-charcoal-900 hover:bg-slate-50/60"
                      >
                        <td className="px-5 py-4 font-medium whitespace-nowrap">{s.name}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{s.branchName || "—"}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{s.phone}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {s.profile ? `${s.profile.workingHoursStart} – ${s.profile.workingHoursEnd}` : "—"}
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {s.profile ? `₹${(s.profile.monthlySalary / 100).toLocaleString("en-IN")}` : "—"}
                        </td>
                        {tab === "mechanics" ? (
                          <>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{s.profile?.mechanicType || "—"}</td>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{s.profile?.serviceCommissionPct ? `${s.profile.serviceCommissionPct}%` : "—"}</td>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{s.profile?.productCommissionPct ? `${s.profile.productCommissionPct}%` : "—"}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap capitalize">{s.profile?.userType || "owner"}</td>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{s.profile?.department || "Executive"}</td>
                          </>
                        )}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/users/${s.userId}`);
                            }}
                            title="View staff detail"
                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-charcoal-900"
                          >
                            <Eye size={16} strokeWidth={1.75} />
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

      {showMechanicForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Add mechanic</h2>
              <button onClick={() => setShowMechanicForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitMechanic} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput label="Mechanic name" value={mechanicForm.name} onChange={(e) => setMechanicForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />

              <div>
                <label className="text-[13px] font-medium text-slate-500">Branch *</label>
                <Dropdown
                  value={mechanicForm.branchId}
                  onChange={(v) => setMechanicForm((f) => ({ ...f, branchId: v }))}
                  placeholder="Select branch"
                  className="mt-1.5 w-full"
                  options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.city }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FloatingInput label="Service commission %" type="number" value={mechanicForm.serviceCommissionPct ?? ""} onChange={(e) => setMechanicForm((f) => ({ ...f, serviceCommissionPct: e.target.value === "" ? undefined : Number(e.target.value) }))} />
                <FloatingInput label="Product commission %" type="number" value={mechanicForm.productCommissionPct ?? ""} onChange={(e) => setMechanicForm((f) => ({ ...f, productCommissionPct: e.target.value === "" ? undefined : Number(e.target.value) }))} />
              </div>

              <FloatingInput label="Date of birth" type="date" value={mechanicForm.dateOfBirth} onChange={(e) => setMechanicForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />

              <WorkingHours
                start={mechanicForm.workingHoursStart}
                end={mechanicForm.workingHoursEnd}
                onStart={(v) => setMechanicForm((f) => ({ ...f, workingHoursStart: v }))}
                onEnd={(v) => setMechanicForm((f) => ({ ...f, workingHoursEnd: v }))}
              />

              <FloatingInput label="Monthly salary" type="number" value={mechanicForm.monthlySalary || ""} onChange={(e) => setMechanicForm((f) => ({ ...f, monthlySalary: Number(e.target.value) }))} required />

              <FloatingInput label="Mechanic type" value={mechanicForm.mechanicType} onChange={(e) => setMechanicForm((f) => ({ ...f, mechanicType: e.target.value }))} required helperText="e.g. Two-wheeler, Four-wheeler, Both" />

              <FloatingInput label="Contact number" value={mechanicForm.phone} onChange={(e) => setMechanicForm((f) => ({ ...f, phone: e.target.value }))} required />
              <FloatingInput label="Email address" type="email" value={mechanicForm.email} onChange={(e) => setMechanicForm((f) => ({ ...f, email: e.target.value }))} />

              <FloatingInput label="Emergency contact number" value={mechanicForm.emergencyContactNumber} onChange={(e) => setMechanicForm((f) => ({ ...f, emergencyContactNumber: e.target.value }))} />
              <FloatingInput label="Emergency contact person" value={mechanicForm.emergencyContactPerson} onChange={(e) => setMechanicForm((f) => ({ ...f, emergencyContactPerson: e.target.value }))} />
              <FloatingInput label="Address" value={mechanicForm.address} onChange={(e) => setMechanicForm((f) => ({ ...f, address: e.target.value }))} />

              <FloatingInput label="Username" value={mechanicForm.username} onChange={(e) => setMechanicForm((f) => ({ ...f, username: e.target.value }))} />
              <FloatingInput label="Password" type="password" value={mechanicForm.password} onChange={(e) => setMechanicForm((f) => ({ ...f, password: e.target.value }))} required />
              <FloatingInput label="Confirm password" type="password" value={mechanicForm.confirmPassword} onChange={(e) => setMechanicForm((f) => ({ ...f, confirmPassword: e.target.value }))} required />

              <GenderToggle value={mechanicForm.gender} onChange={(g) => setMechanicForm((f) => ({ ...f, gender: g }))} />

              <FloatingInput label="Date of joining" type="date" value={mechanicForm.dateOfJoining} onChange={(e) => setMechanicForm((f) => ({ ...f, dateOfJoining: e.target.value }))} required />

              <FileInput label="Upload ID proof" onUploaded={(url) => setMechanicForm((f) => ({ ...f, idProofUrl: url }))} />
              <FileInput label="Upload photo" onUploaded={(url) => setMechanicForm((f) => ({ ...f, photoUrl: url }))} />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Adding..." : "Add mechanic"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showStaffForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Add staff</h2>
              <button onClick={() => setShowStaffForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitStaff} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput label="Employee name" value={staffForm.name} onChange={(e) => setStaffForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />

              <div>
                <label className="text-[13px] font-medium text-slate-500">Branch *</label>
                <Dropdown
                  value={staffForm.branchId}
                  onChange={(v) => setStaffForm((f) => ({ ...f, branchId: v }))}
                  placeholder="Select branch"
                  className="mt-1.5 w-full"
                  options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.city }))}
                />
              </div>

              <FloatingInput label="Date of birth" type="date" value={staffForm.dateOfBirth} onChange={(e) => setStaffForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
              <FloatingInput label="Contact number" value={staffForm.phone} onChange={(e) => setStaffForm((f) => ({ ...f, phone: e.target.value }))} required />
              <FloatingInput label="Email address" type="email" value={staffForm.email} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} />

              <WorkingHours
                start={staffForm.workingHoursStart}
                end={staffForm.workingHoursEnd}
                onStart={(v) => setStaffForm((f) => ({ ...f, workingHoursStart: v }))}
                onEnd={(v) => setStaffForm((f) => ({ ...f, workingHoursEnd: v }))}
              />

              <FloatingInput label="Monthly salary" type="number" value={staffForm.monthlySalary || ""} onChange={(e) => setStaffForm((f) => ({ ...f, monthlySalary: Number(e.target.value) }))} required />

              <FloatingInput label="Emergency contact number" value={staffForm.emergencyContactNumber} onChange={(e) => setStaffForm((f) => ({ ...f, emergencyContactNumber: e.target.value }))} />
              <FloatingInput label="Emergency contact person" value={staffForm.emergencyContactPerson} onChange={(e) => setStaffForm((f) => ({ ...f, emergencyContactPerson: e.target.value }))} />
              <FloatingInput label="Address" value={staffForm.address} onChange={(e) => setStaffForm((f) => ({ ...f, address: e.target.value }))} />

              <FloatingInput label="Username" value={staffForm.username} onChange={(e) => setStaffForm((f) => ({ ...f, username: e.target.value }))} />
              <FloatingInput label="Password" type="password" value={staffForm.password} onChange={(e) => setStaffForm((f) => ({ ...f, password: e.target.value }))} required />
              <FloatingInput label="Confirm password" type="password" value={staffForm.confirmPassword} onChange={(e) => setStaffForm((f) => ({ ...f, confirmPassword: e.target.value }))} required />

              <GenderToggle value={staffForm.gender} onChange={(g) => setStaffForm((f) => ({ ...f, gender: g }))} />

              <FloatingInput label="Date of joining" type="date" value={staffForm.dateOfJoining} onChange={(e) => setStaffForm((f) => ({ ...f, dateOfJoining: e.target.value }))} required />

              <div>
                <label className="text-[13px] font-medium text-slate-500">User type *</label>
                <Dropdown
                  value={staffForm.userType}
                  onChange={(v) => setStaffForm((f) => ({ ...f, userType: v }))}
                  className="mt-1.5 w-full"
                  options={[
                    { value: "admin", label: "Admin" },
                    { value: "frontdesk", label: "Front desk" },
                    { value: "branch_manager", label: "Branch manager" },
                    { value: "viewer", label: "Viewer" },
                  ]}
                />
              </div>

              <FloatingInput label="Department" value={staffForm.department} onChange={(e) => setStaffForm((f) => ({ ...f, department: e.target.value }))} required helperText="Sales, Management, Accounts, Operations etc." />

              <FileInput label="Upload photo" onUploaded={(url) => setStaffForm((f) => ({ ...f, photoUrl: url }))} />
              <FileInput label="Upload ID proof" onUploaded={(url) => setStaffForm((f) => ({ ...f, idProofUrl: url }))} />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white transition-colors hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Adding..." : "Add staff"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
