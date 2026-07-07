import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Package, Layers, Pencil, Trash2, XCircle } from "lucide-react";
import { api, Product, ProductInput } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import FloatingInput from "../components/FloatingInput";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 12;
const EMPTY: ProductInput = { name: "", mrp: 0, volume: "", barcode: "", category: "", subCategory: "", sku: "" };

export default function Products() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.listProducts().then(setProducts).catch((err) => setError(err.message));
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

  function openCreate() {
    setEditId(null);
    setForm(EMPTY);
    setError("");
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({
      name: p.name,
      mrp: p.mrp / 100,
      volume: p.volume ?? "",
      barcode: p.barcode ?? "",
      category: p.category ?? "",
      subCategory: p.subCategory ?? "",
      sku: p.sku ?? "",
    });
    setError("");
    setShowForm(true);
  }

  function set(field: keyof ProductInput, value: string) {
    setForm((f) => ({ ...f, [field]: field === "mrp" ? Number(value) : value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editId) await api.updateProduct(editId, form);
      else await api.createProduct(form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save product");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await api.deleteProduct(p.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not delete");
    }
  }

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    return q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.category ?? "").toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q) ||
            (p.barcode ?? "").toLowerCase().includes(q)
        )
      : products;
  }, [products, search]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const categories = new Set(products?.map((p) => p.category).filter(Boolean)).size;
  const stockValue = products?.reduce((s, p) => s + p.mrp, 0) ?? 0;

  function exportCsv() {
    downloadCsv(
      "products.csv",
      filtered.map((p) => ({
        Name: p.name,
        MRP: (p.mrp / 100).toFixed(2),
        Volume: p.volume ?? "",
        Barcode: p.barcode ?? "",
        Category: p.category ?? "",
        SubCategory: p.subCategory ?? "",
        SKU: p.sku ?? "",
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
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Products</h1>
              <p className="mt-1 text-[14px] text-slate-400">Parts and products master list with MRP.</p>
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800">
              <Plus size={15} /> Add product
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total products" value={products?.length ?? 0} icon={Package} loading={!products} />
            <StatCard label="Categories" value={categories} icon={Layers} loading={!products} />
            <StatCard label="Catalogue value (MRP)" value={`₹${(stockValue / 100).toLocaleString("en-IN")}`} icon={Package} loading={!products} />
          </div>

          <div className="mt-6">
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, category, SKU, barcode..." onDownload={exportCsv} />
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
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5">MRP</th>
                    <th className="px-5 py-3.5">Volume</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">SKU / Barcode</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!products ? (
                    Array.from({ length: 8 }).map((_, i) => (
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
                        <p className="mt-3 text-sm font-medium text-charcoal-900">No products found</p>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((p) => (
                      <tr key={p.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                        <td className="px-5 py-4 font-medium whitespace-nowrap">{p.name}</td>
                        <td className="px-5 py-4 whitespace-nowrap">₹{(p.mrp / 100).toLocaleString("en-IN")}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{p.volume ?? "—"}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{p.category ?? "—"}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{p.sku || p.barcode || "—"}</td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEdit(p)} title="Edit" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900">
                              <Pencil size={15} strokeWidth={1.75} />
                            </button>
                            <button onClick={() => remove(p)} title="Delete" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 size={15} strokeWidth={1.75} />
                            </button>
                          </div>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">{editId ? "Edit product" : "Add product"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput label="Product name" value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
              <FloatingInput label="MRP (₹)" type="number" value={form.mrp || ""} onChange={(e) => set("mrp", e.target.value)} required />
              <FloatingInput label="Volume / Unit" value={form.volume} onChange={(e) => set("volume", e.target.value)} helperText="e.g. 1 L, 1 Pcs, 1 Pkt" />
              <FloatingInput label="Category" value={form.category} onChange={(e) => set("category", e.target.value)} />
              <FloatingInput label="Sub category" value={form.subCategory} onChange={(e) => set("subCategory", e.target.value)} />
              <FloatingInput label="SKU" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
              <FloatingInput label="Barcode" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Saving..." : editId ? "Save changes" : "Add product"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
