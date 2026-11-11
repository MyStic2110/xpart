import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  Pencil,
  Trash2,
  Wrench,
  Repeat,
  IndianRupee,
} from "lucide-react";
import { api, Product, ProductInput, Service, ServiceInput } from "../api";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/ui/TopBar";
import MetricCard from "../components/ui/MetricCard";
import DataTable from "../components/ui/DataTable";
import FloatingInput from "../components/FloatingInput";
import { downloadCsv } from "../utils/csv";
import { cn } from "../lib/utils";

type ActiveTab = "products" | "services";

const EMPTY_PRODUCT: ProductInput = {
  name: "",
  mrp: 0,
  volume: "",
  barcode: "",
  category: "",
  subCategory: "",
  sku: "",
};

const EMPTY_SERVICE: ServiceInput = {
  name: "",
  defaultPrice: 0,
  recurrenceDays: null,
};

const RECURRENCE_PRESETS: { label: string; days: number | null }[] = [
  { label: "One-time", days: null },
  { label: "30 days (Wash)", days: 30 },
  { label: "90 days (Polish)", days: 90 },
  { label: "180 days (Detailing)", days: 180 },
  { label: "365 days (PPF / Ceramic)", days: 365 },
];

export default function Products() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: ActiveTab = searchParams.get("tab") === "services" ? "services" : "products";
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  const [orgName, setOrgName] = useState("Workspace");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Product drawer state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductInput>(EMPTY_PRODUCT);
  const [savingProduct, setSavingProduct] = useState(false);

  // Service drawer state
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceInput>(EMPTY_SERVICE);
  const [savingService, setSavingService] = useState(false);

  function loadProducts() {
    api.listProducts().then(setProducts).catch((err) => setError(err.message));
  }

  function loadServices() {
    api.listServices().then(setServices).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    loadProducts();
    loadServices();
  }, []);

  function switchTab(tab: ActiveTab) {
    setActiveTab(tab);
    setError("");
    setNotice("");
    if (tab === "services") {
      searchParams.set("tab", "services");
    } else {
      searchParams.delete("tab");
    }
    setSearchParams(searchParams, { replace: true });
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  // --- Product CRUD ---
  function openCreateProduct() {
    setEditProductId(null);
    setProductForm(EMPTY_PRODUCT);
    setError("");
    setShowProductForm(true);
  }

  function openEditProduct(p: Product) {
    setEditProductId(p.id);
    setProductForm({
      name: p.name,
      mrp: p.mrp / 100,
      volume: p.volume ?? "",
      barcode: p.barcode ?? "",
      category: p.category ?? "",
      subCategory: p.subCategory ?? "",
      sku: p.sku ?? "",
    });
    setError("");
    setShowProductForm(true);
  }

  function setProdField(field: keyof ProductInput, value: string) {
    setProductForm((f) => ({ ...f, [field]: field === "mrp" ? Number(value) : value }));
  }

  async function submitProduct(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSavingProduct(true);
    try {
      if (editProductId) {
        await api.updateProduct(editProductId, productForm);
        setNotice(`Updated product "${productForm.name}".`);
      } else {
        await api.createProduct(productForm);
        setNotice(`Added product "${productForm.name}".`);
      }
      setShowProductForm(false);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSavingProduct(false);
    }
  }

  async function removeProduct(p: Product) {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    setError("");
    setNotice("");
    try {
      await api.deleteProduct(p.id);
      setNotice(`Deleted product "${p.name}".`);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete product");
    }
  }

  // --- Service CRUD ---
  function openCreateService() {
    setEditServiceId(null);
    setServiceForm(EMPTY_SERVICE);
    setError("");
    setShowServiceForm(true);
  }

  function openEditService(s: Service) {
    setEditServiceId(s.id);
    setServiceForm({
      name: s.name,
      defaultPrice: s.defaultPrice / 100,
      recurrenceDays: s.recurrenceDays ?? null,
    });
    setError("");
    setShowServiceForm(true);
  }

  async function submitService(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!serviceForm.name.trim()) {
      setError("Service name is required.");
      return;
    }
    setSavingService(true);
    try {
      const payload: ServiceInput = {
        name: serviceForm.name.trim(),
        defaultPrice: Number(serviceForm.defaultPrice) || 0,
        recurrenceDays: serviceForm.recurrenceDays && serviceForm.recurrenceDays > 0
          ? Math.round(serviceForm.recurrenceDays)
          : null,
      };
      if (editServiceId) {
        await api.updateService(editServiceId, payload);
        setNotice(`Updated service "${payload.name}".`);
      } else {
        await api.createService(payload);
        setNotice(`Added service "${payload.name}".`);
      }
      setShowServiceForm(false);
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save service");
    } finally {
      setSavingService(false);
    }
  }

  async function removeService(s: Service) {
    const label = s.name.trim() || "(Unnamed service)";
    if (!confirm(`Remove service "${label}"?`)) return;
    setError("");
    setNotice("");
    try {
      const res = await api.deleteService(s.id);
      setNotice(
        res.archived
          ? `Archived "${label}" (kept on past invoices, hidden from new job cards).`
          : `Deleted service "${label}".`
      );
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete service");
    }
  }

  // --- Metrics ---
  const categories = useMemo(
    () => new Set(products?.map((p) => p.category).filter(Boolean)).size,
    [products]
  );
  const stockValue = useMemo(
    () => products?.reduce((s, p) => s + p.mrp, 0) ?? 0,
    [products]
  );

  const recurringServicesCount = useMemo(
    () => services?.filter((s) => s.recurrenceDays != null && s.recurrenceDays > 0).length ?? 0,
    [services]
  );
  const avgServicePrice = useMemo(() => {
    if (!services || services.length === 0) return 0;
    return Math.round(services.reduce((sum, s) => sum + s.defaultPrice, 0) / services.length);
  }, [services]);

  // --- Table Columns ---
  const productColumns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-charcoal-900">{row.original.name}</p>
            {row.original.subCategory && (
              <p className="text-[11px] text-slate-400">{row.original.subCategory}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "mrp",
        header: "MRP",
        cell: ({ row }) => (
          <span className="font-semibold text-charcoal-900">
            ₹{(row.original.mrp / 100).toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        accessorKey: "volume",
        header: "Volume",
        cell: ({ row }) => (
          <span className="text-slate-600">{row.original.volume ?? "—"}</span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) =>
          row.original.category ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {row.original.category}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        accessorFn: (row) => row.sku || row.barcode || "",
        id: "skuBarcode",
        header: "SKU / Barcode",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-500">
            {row.original.sku || row.original.barcode || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="ml-auto">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditProduct(row.original);
              }}
              title="Edit product"
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900 transition-colors"
            >
              <Pencil size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeProduct(row.original);
              }}
              title="Delete product"
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  const serviceColumns = useMemo<ColumnDef<Service>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Service Name",
        cell: ({ row }) =>
          row.original.name.trim() ? (
            <span className="font-semibold text-charcoal-900">{row.original.name}</span>
          ) : (
            <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Unnamed service
            </span>
          ),
      },
      {
        accessorKey: "defaultPrice",
        header: "Default Price",
        cell: ({ row }) => (
          <span className="font-semibold text-charcoal-900">
            ₹{(row.original.defaultPrice / 100).toLocaleString("en-IN")}
          </span>
        ),
      },
      {
        accessorKey: "recurrenceDays",
        header: "Follow-up Recurrence",
        cell: ({ row }) =>
          row.original.recurrenceDays ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
              <Repeat className="h-3 w-3" />
              Every {row.original.recurrenceDays} days
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              One-time
            </span>
          ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: () => (
          <span className="inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Active
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="ml-auto">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditService(row.original);
              }}
              title="Edit service"
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900 transition-colors"
            >
              <Pencil size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeService(row.original);
              }}
              title="Delete service"
              className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  function exportProductsCsv() {
    downloadCsv(
      "products.csv",
      (products ?? []).map((p) => ({
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

  function exportServicesCsv() {
    downloadCsv(
      "services.csv",
      (services ?? []).map((s) => ({
        Name: s.name,
        DefaultPrice: (s.defaultPrice / 100).toFixed(2),
        RecurrenceDays: s.recurrenceDays ?? "",
      }))
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar orgName={orgName} onLogout={logout} />

      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          title="Products & Services"
          subtitle="Manage spare parts catalogue and billable workshop services"
          actions={
            activeTab === "products" ? (
              <button
                onClick={openCreateProduct}
                className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-charcoal-800 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </button>
            ) : (
              <button
                onClick={openCreateService}
                className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-charcoal-800 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Service
              </button>
            )
          }
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
            {/* Two-Tab Switcher: Products & Services */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
                <button
                  type="button"
                  onClick={() => switchTab("products")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all",
                    activeTab === "products"
                      ? "bg-white text-charcoal-900 shadow-sm"
                      : "text-slate-600 hover:text-charcoal-900"
                  )}
                >
                  <Package className="h-3.5 w-3.5" />
                  Products
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                      activeTab === "products"
                        ? "bg-slate-100 text-charcoal-900"
                        : "bg-slate-200/80 text-slate-500"
                    )}
                  >
                    {products?.length ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => switchTab("services")}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all",
                    activeTab === "services"
                      ? "bg-white text-charcoal-900 shadow-sm"
                      : "text-slate-600 hover:text-charcoal-900"
                  )}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Services
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                      activeTab === "services"
                        ? "bg-slate-100 text-charcoal-900"
                        : "bg-slate-200/80 text-slate-500"
                    )}
                  >
                    {services?.length ?? 0}
                  </span>
                </button>
              </div>
            </div>

            {notice && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 animate-slideUp">
                <CheckCircle2 size={15} />
                <span>{notice}</span>
              </div>
            )}

            {error && !showProductForm && !showServiceForm && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-600 animate-slideUp">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {activeTab === "products" ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <MetricCard
                    title="Total Products"
                    value={products?.length ?? 0}
                    icon={Package}
                    loading={!products}
                    subtext="Parts & accessories in master catalogue"
                  />
                  <MetricCard
                    title="Categories"
                    value={categories}
                    icon={Layers}
                    loading={!products}
                    subtext="Distinct product classifications"
                  />
                  <MetricCard
                    title="Catalogue Value (MRP)"
                    value={`₹${(stockValue / 100).toLocaleString("en-IN")}`}
                    icon={IndianRupee}
                    loading={!products}
                    subtext="Combined unit MRP across catalogue"
                  />
                </div>

                <DataTable
                  columns={productColumns}
                  data={products ?? []}
                  searchPlaceholder="Search product name, category, SKU, barcode..."
                  onExportCsv={exportProductsCsv}
                  initialPageSize={20}
                />
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <MetricCard
                    title="Total Services"
                    value={services?.length ?? 0}
                    icon={Wrench}
                    loading={!services}
                    subtext="Available for job cards & enquiries"
                  />
                  <MetricCard
                    title="Recurring Services"
                    value={recurringServicesCount}
                    icon={Repeat}
                    loading={!services}
                    subtext="Tracked automatically by Client 360°"
                  />
                  <MetricCard
                    title="Average Service Price"
                    value={`₹${(avgServicePrice / 100).toLocaleString("en-IN")}`}
                    icon={IndianRupee}
                    loading={!services}
                    subtext="Default rate across active services"
                  />
                </div>

                <DataTable
                  columns={serviceColumns}
                  data={services ?? []}
                  searchPlaceholder="Search service name..."
                  onExportCsv={exportServicesCsv}
                  initialPageSize={20}
                />
              </>
            )}
          </div>
        </main>
      </div>

      {/* Product Drawer */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">
                {editProductId ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={() => setShowProductForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitProduct} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput label="Product name" value={productForm.name} onChange={(e) => setProdField("name", e.target.value)} required autoFocus />
              <FloatingInput label="MRP (₹)" type="number" step="0.01" value={productForm.mrp || ""} onChange={(e) => setProdField("mrp", e.target.value)} required />
              <FloatingInput label="Volume / Unit" value={productForm.volume} onChange={(e) => setProdField("volume", e.target.value)} helperText="e.g. 1 L, 1 Pcs, 1 Pkt" />
              <FloatingInput label="Category" value={productForm.category} onChange={(e) => setProdField("category", e.target.value)} />
              <FloatingInput label="Sub category" value={productForm.subCategory} onChange={(e) => setProdField("subCategory", e.target.value)} />
              <FloatingInput label="SKU" value={productForm.sku} onChange={(e) => setProdField("sku", e.target.value)} />
              <FloatingInput label="Barcode" value={productForm.barcode} onChange={(e) => setProdField("barcode", e.target.value)} />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingProduct}
                className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
              >
                {savingProduct ? "Saving..." : editProductId ? "Save Changes" : "Add Product"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Service Drawer */}
      {showServiceForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">
                {editServiceId ? "Edit Service" : "Add Service"}
              </h2>
              <button onClick={() => setShowServiceForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitService} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput
                label="Service name"
                value={serviceForm.name}
                onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
                helperText="e.g. Full Wash, Car Polish, Ceramic Coating, General Service"
              />
              <FloatingInput
                label="Default Price (₹)"
                type="number"
                step="0.01"
                value={serviceForm.defaultPrice || ""}
                onChange={(e) => setServiceForm((f) => ({ ...f, defaultPrice: Number(e.target.value) }))}
                required
              />

              <div>
                <FloatingInput
                  label="Follow-up Recurrence (days)"
                  type="number"
                  min={1}
                  value={serviceForm.recurrenceDays ?? ""}
                  onChange={(e) =>
                    setServiceForm((f) => ({
                      ...f,
                      recurrenceDays: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  helperText="Drives Client 360° automated follow-up reminders. Leave blank for one-time repairs."
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {RECURRENCE_PRESETS.map((preset) => {
                    const active = (serviceForm.recurrenceDays ?? null) === preset.days;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setServiceForm((f) => ({ ...f, recurrenceDays: preset.days }))}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          active
                            ? "border-charcoal-900 bg-charcoal-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingService}
                className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
              >
                {savingService ? "Saving..." : editServiceId ? "Save Changes" : "Add Service"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
