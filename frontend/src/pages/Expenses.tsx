import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Wallet, Receipt, CalendarDays, Pencil, Trash2, XCircle, Tag, Layers } from "lucide-react";
import { api, Expense, ExpenseCategory, ExpenseInput, ExpenseSummary } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import FloatingInput from "../components/FloatingInput";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 12;

// Free-text payment modes — these are just the common suggestions in the dropdown.
const PAYMENT_MODES = ["Cash", "Online payment", "UPI", "Card", "Cheque", "Bank transfer"];

const emptyForm = (branchId?: string): ExpenseInput => ({
  branchId: branchId && branchId !== "all" ? branchId : "",
  categoryId: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  amount: 0,
  paymentMode: "Cash",
  recipient: "",
  paidBy: "",
  notes: "",
});

// Native select styled to match FloatingInput's resting state.
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <label className="mb-1 block px-1 text-[11px] font-medium text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-charcoal-900 hover:border-slate-300 focus:border-accent-500 focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,102,245,0.12)]"
      >
        {children}
      </select>
    </div>
  );
}

export default function Expenses() {
  const navigate = useNavigate();
  const { branchId, branchParam, branches } = useBranch();
  const [orgName, setOrgName] = useState("Workspace");

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  // Expense drawer
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseInput>(emptyForm(branchId));
  const [saving, setSaving] = useState(false);

  // Category drawer
  const [showCats, setShowCats] = useState(false);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catEditId, setCatEditId] = useState<string | null>(null);
  const [catError, setCatError] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  function loadExpenses() {
    api.listExpenses(branchParam).then(setExpenses).catch((err) => setError(err.message));
  }
  function loadCategories() {
    api.listExpenseCategories().then(setCategories).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    loadCategories();
  }, []);

  useEffect(() => {
    setExpenses(null);
    loadExpenses();
    api.expenseSummary(branchParam).then(setSummary).catch(() => {});
    setPage(1);
  }, [branchParam]);

  useEffect(() => setPage(1), [search]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  // ---- Expense form ----
  function openCreate() {
    setEditId(null);
    setForm(emptyForm(branchId));
    setError("");
    setShowForm(true);
  }
  function openEdit(x: Expense) {
    setEditId(x.id);
    setForm({
      branchId: x.branchId ?? "",
      categoryId: x.categoryId ?? "",
      expenseDate: x.expenseDate,
      amount: x.amount / 100,
      paymentMode: x.paymentMode,
      recipient: x.recipient ?? "",
      paidBy: x.paidBy ?? "",
      notes: x.notes ?? "",
    });
    setError("");
    setShowForm(true);
  }
  function set<K extends keyof ExpenseInput>(field: K, value: ExpenseInput[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.expenseDate) return setError("pick a date");
    if (!form.amount || form.amount <= 0) return setError("enter an amount");
    setSaving(true);
    try {
      if (editId) await api.updateExpense(editId, form);
      else await api.createExpense(form);
      setShowForm(false);
      loadExpenses();
      api.expenseSummary(branchParam).then(setSummary).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save expense");
    } finally {
      setSaving(false);
    }
  }
  async function removeExpense(x: Expense) {
    if (!confirm(`Delete this ${x.paymentMode} expense of ₹${(x.amount / 100).toLocaleString("en-IN")}?`)) return;
    try {
      await api.deleteExpense(x.id);
      loadExpenses();
      api.expenseSummary(branchParam).then(setSummary).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not delete");
    }
  }

  // ---- Category management ----
  function resetCatForm() {
    setCatEditId(null);
    setCatName("");
    setCatDesc("");
    setCatError("");
  }
  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError("");
    if (!catName.trim()) return setCatError("enter a category name");
    setCatSaving(true);
    try {
      if (catEditId) await api.updateExpenseCategory(catEditId, { name: catName.trim(), description: catDesc.trim() });
      else await api.createExpenseCategory({ name: catName.trim(), description: catDesc.trim() });
      resetCatForm();
      loadCategories();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "could not save category");
    } finally {
      setCatSaving(false);
    }
  }
  async function removeCategory(c: ExpenseCategory) {
    if (!confirm(`Delete category "${c.name}"? Existing expenses keep their history but lose this label.`)) return;
    try {
      await api.deleteExpenseCategory(c.id);
      if (catEditId === c.id) resetCatForm();
      loadCategories();
      loadExpenses();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "could not delete category");
    }
  }

  const filtered = useMemo(() => {
    if (!expenses) return [];
    const q = search.trim().toLowerCase();
    return q
      ? expenses.filter(
          (x) =>
            (x.categoryName ?? "").toLowerCase().includes(q) ||
            (x.recipient ?? "").toLowerCase().includes(q) ||
            (x.paidBy ?? "").toLowerCase().includes(q) ||
            (x.notes ?? "").toLowerCase().includes(q) ||
            x.paymentMode.toLowerCase().includes(q)
        )
      : expenses;
  }, [expenses, search]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredTotal = filtered.reduce((s, x) => s + x.amount, 0);

  function exportCsv() {
    downloadCsv(
      "expenses.csv",
      filtered.map((x) => ({
        Date: x.expenseDate,
        Type: x.categoryName ?? "",
        Amount: (x.amount / 100).toFixed(2),
        "Payment mode": x.paymentMode,
        Recipient: x.recipient ?? "",
        "Paid by": x.paidBy ?? "",
        Notes: x.notes ?? "",
      }))
    );
  }

  const branchPickerNeeded = branchId === "all";

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex flex-wrap items-center justify-between gap-3 animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Expenses</h1>
              <p className="mt-1 text-[14px] text-slate-400">Track what each branch spends, by category.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { resetCatForm(); setCatEditId("new"); setShowCats(true); }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-charcoal-900 hover:bg-slate-50"
              >
                <Plus size={15} /> Add category
              </button>
              <button
                onClick={() => { resetCatForm(); setShowCats(true); }}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] font-medium text-charcoal-900 hover:bg-slate-50"
              >
                <Layers size={15} /> Manage categories
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800"
              >
                <Plus size={15} /> Add expense
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total expenses" value={summary?.count ?? 0} icon={Receipt} loading={!summary} />
            <StatCard label="This month" value={`₹${((summary?.monthTotal ?? 0) / 100).toLocaleString("en-IN")}`} icon={CalendarDays} loading={!summary} />
            <StatCard label="All-time spend" value={`₹${((summary?.total ?? 0) / 100).toLocaleString("en-IN")}`} icon={Wallet} loading={!summary} />
          </div>

          <div className="mt-6">
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search type, recipient, paid by, notes..." onDownload={exportCsv} />
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
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Payment mode</th>
                    <th className="px-5 py-3.5">Recipient</th>
                    <th className="px-5 py-3.5">Paid by</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!expenses ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-medium text-charcoal-900">No expenses found</p>
                        <p className="mt-1 text-[13px] text-slate-400">Record your first expense to start tracking spend.</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((x) => (
                      <tr key={x.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                        <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                          {new Date(x.expenseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {x.categoryName ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-charcoal-900">
                              <Tag size={11} /> {x.categoryName}
                            </span>
                          ) : (
                            <span className="text-slate-400">Uncategorized</span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-medium whitespace-nowrap">₹{(x.amount / 100).toLocaleString("en-IN")}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-500">{x.paymentMode}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-500">{x.recipient || "—"}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-500">{x.paidBy || "—"}</td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEdit(x)} title="Edit" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900">
                              <Pencil size={15} strokeWidth={1.75} />
                            </button>
                            <button onClick={() => removeExpense(x)} title="Delete" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 size={15} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-100 text-[13px] font-semibold text-charcoal-900">
                      <td className="px-5 py-3.5" colSpan={2}>Total ({filtered.length})</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">₹{(filteredTotal / 100).toLocaleString("en-IN")}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        </div>
      </main>

      {/* Expense drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">{editId ? "Edit expense" : "Add expense"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
              {branchPickerNeeded && (
                <Select label="Branch" value={form.branchId ?? ""} onChange={(v) => set("branchId", v)}>
                  <option value="">Select a branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              )}
              <Select label="Type / Category" value={form.categoryId ?? ""} onChange={(v) => set("categoryId", v)}>
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <FloatingInput label="Date" type="date" value={form.expenseDate} onChange={(e) => set("expenseDate", e.target.value)} required />
              <FloatingInput label="Amount (₹)" type="number" min="0" step="0.01" value={form.amount || ""} onChange={(e) => set("amount", Number(e.target.value))} required />
              <Select label="Payment mode" value={form.paymentMode} onChange={(v) => set("paymentMode", v)}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
              <FloatingInput label="Recipient (paid to)" value={form.recipient ?? ""} onChange={(e) => set("recipient", e.target.value)} helperText="Vendor, landlord, person…" />
              <FloatingInput label="Paid by" value={form.paidBy ?? ""} onChange={(e) => set("paidBy", e.target.value)} helperText="Who made the payment, e.g. Admin" />
              <FloatingInput label="Notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}
              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Saving..." : editId ? "Save changes" : "Add expense"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Category management drawer */}
      {showCats && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Expense categories</h2>
              <button onClick={() => { setShowCats(false); resetCatForm(); }} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>

            <form onSubmit={submitCategory} className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5">
              <p className="text-[12px] font-medium text-slate-400">{catEditId && catEditId !== "new" ? "Edit category" : "Add a category"}</p>
              <FloatingInput label="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} helperText="e.g. Rent, Salaries, Utilities" />
              <FloatingInput label="Description (optional)" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
              {catError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{catError}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button type="submit" disabled={catSaving} className="rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                  {catSaving ? "Saving..." : catEditId && catEditId !== "new" ? "Save changes" : "Add category"}
                </button>
                {catEditId && catEditId !== "new" && (
                  <button type="button" onClick={resetCatForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13.5px] font-medium text-slate-500 hover:bg-slate-50">
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="px-6 py-5">
              <p className="mb-2 text-[12px] font-medium text-slate-400">All categories ({categories.length})</p>
              {categories.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-slate-400">No categories yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {categories.map((c) => (
                    <li key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-2.5 hover:bg-slate-50/60">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-charcoal-900">{c.name}</p>
                        {c.description && <p className="truncate text-[12px] text-slate-400">{c.description}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => { setCatEditId(c.id); setCatName(c.name); setCatDesc(c.description ?? ""); setCatError(""); }} title="Edit" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900">
                          <Pencil size={14} strokeWidth={1.75} />
                        </button>
                        <button onClick={() => removeCategory(c)} title="Delete" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
