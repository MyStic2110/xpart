import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Car,
  User,
  Plus,
  Trash2,
  Wrench,
  Package,
  Save,
  Download,
  RotateCcw,
  FileText,
} from "lucide-react";
import { api, JobCardDetail, Service, Product } from "../api";
import { downloadInvoicePdf, downloadJobCardDocumentPdf } from "../utils/invoicePdf";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/ui/TopBar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import { cn } from "../lib/utils";

function rupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 border border-slate-200",
  in_progress: "bg-amber-50 text-amber-700 border border-amber-200/70",
  completed: "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
  billed: "bg-accent-500/10 text-accent-700 border border-accent-500/20",
  cancelled: "bg-rose-50 text-rose-700 border border-rose-200/70",
};

export default function JobCardDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [detail, setDetail] = useState<JobCardDetail | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Add item panels (for ongoing/extended work)
  const [addMode, setAddMode] = useState<"none" | "service" | "product">("none");
  const [selServiceId, setSelServiceId] = useState("");
  const [svcQty, setSvcQty] = useState(1);
  const [svcPrice, setSvcPrice] = useState(0);

  const [selProductId, setSelProductId] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodQty, setProdQty] = useState(1);
  const [prodPrice, setProdPrice] = useState(0);
  const [submittingItem, setSubmittingItem] = useState(false);

  // Editable discount & tax while job card is open
  const [editDiscount, setEditDiscount] = useState(0);
  const [editTaxPercent, setEditTaxPercent] = useState(0);

  function load() {
    return api
      .getJobCardDetail(id)
      .then((d) => {
        setDetail(d);
        setEditDiscount(d.jobCard.discount / 100);
        setEditTaxPercent(d.jobCard.taxPercent);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    api.listServices().then(setServices).catch(() => {});
    api.listProducts().then(setProducts).catch(() => {});
    load();
  }, [id]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const isEditable =
    detail?.jobCard.status === "draft" || detail?.jobCard.status === "in_progress";

  function onServicePick(serviceId: string) {
    setSelServiceId(serviceId);
    const svc = services.find((s) => s.id === serviceId);
    setSvcPrice(svc ? svc.defaultPrice / 100 : 0);
  }

  function onProductPick(productId: string) {
    setSelProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setProdName(prod.name);
      setProdPrice(prod.mrp / 100);
    }
  }

  async function submitServiceItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selServiceId || !Number.isFinite(svcQty) || svcQty <= 0 || !Number.isFinite(svcPrice) || svcPrice < 0) {
      setError("Please select a service with a valid quantity and price.");
      return;
    }
    setSubmittingItem(true);
    setError("");
    setNotice("");
    try {
      await api.addJobCardItems(id, {
        services: [{ serviceId: selServiceId, qty: Math.round(svcQty), price: Math.round(svcPrice * 100) }],
      });
      setSelServiceId("");
      setSvcQty(1);
      setSvcPrice(0);
      setAddMode("none");
      setNotice("Added service to job card.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add service");
    } finally {
      setSubmittingItem(false);
    }
  }

  async function submitProductItem(e: React.FormEvent) {
    e.preventDefault();
    if (!prodName.trim() || !Number.isFinite(prodQty) || prodQty <= 0 || !Number.isFinite(prodPrice) || prodPrice < 0) {
      setError("Please enter a part/product name with a valid quantity and price.");
      return;
    }
    setSubmittingItem(true);
    setError("");
    setNotice("");
    try {
      await api.addJobCardItems(id, {
        products: [
          {
            productId: selProductId || null,
            productName: prodName.trim(),
            qty: Math.round(prodQty),
            price: Math.round(prodPrice * 100),
          },
        ],
      });
      setSelProductId("");
      setProdName("");
      setProdQty(1);
      setProdPrice(0);
      setAddMode("none");
      setNotice("Added product/part to job card.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add product");
    } finally {
      setSubmittingItem(false);
    }
  }

  async function removeItem(itemId: string, type: "service" | "product", name: string) {
    if (!confirm(`Remove "${name}" from this job card?`)) return;
    setError("");
    setNotice("");
    try {
      await api.removeJobCardItem(id, itemId, type);
      setNotice(`Removed "${name}" from job card.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove item");
    }
  }

  // Commits any pending inline add-item form and pricing updates before Save or Complete.
  async function persistPendingChanges() {
    if (addMode === "service" && selServiceId) {
      if (!Number.isFinite(svcQty) || svcQty <= 0 || !Number.isFinite(svcPrice) || svcPrice < 0) {
        throw new Error("Please enter a valid quantity and price for the selected service.");
      }
      await api.addJobCardItems(id, {
        services: [{ serviceId: selServiceId, qty: Math.round(svcQty), price: Math.round(svcPrice * 100) }],
      });
      setSelServiceId("");
      setSvcQty(1);
      setSvcPrice(0);
      setAddMode("none");
    } else if (addMode === "product" && prodName.trim()) {
      if (!Number.isFinite(prodQty) || prodQty <= 0 || !Number.isFinite(prodPrice) || prodPrice < 0) {
        throw new Error("Please enter a valid quantity and price for the product/part.");
      }
      await api.addJobCardItems(id, {
        products: [
          {
            productId: selProductId || null,
            productName: prodName.trim(),
            qty: Math.round(prodQty),
            price: Math.round(prodPrice * 100),
          },
        ],
      });
      setSelProductId("");
      setProdName("");
      setProdQty(1);
      setProdPrice(0);
      setAddMode("none");
    }

    const safeDiscount = Number.isFinite(editDiscount) ? Math.max(0, Math.round(editDiscount * 100)) : 0;
    const safeTaxPercent = Number.isFinite(editTaxPercent)
      ? Math.min(100, Math.max(0, Math.round(editTaxPercent)))
      : 0;

    await api.updateJobCard(id, {
      discount: safeDiscount,
      taxPercent: safeTaxPercent,
      status: "in_progress",
    });
  }

  async function saveChanges() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await persistPendingChanges();
      setNotice("Job card saved (In Progress). You can continue adding work anytime.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save job card");
    } finally {
      setSaving(false);
    }
  }

  async function markComplete() {
    setCompleting(true);
    setError("");
    setNotice("");
    try {
      await persistPendingChanges();
      const result = await api.markJobCardComplete(id);
      setNotice(
        result.alreadyCompleted
          ? "Job card is already marked complete."
          : "Job card marked complete. Click \"Raise Invoice\" when ready to bill."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark job card complete");
    } finally {
      setCompleting(false);
    }
  }

  async function raiseInvoice() {
    setInvoicing(true);
    setError("");
    setNotice("");
    try {
      if (isEditable) {
        await persistPendingChanges();
      }
      const result = await api.raiseJobCardInvoice(id);
      setNotice(
        result.alreadyExisted
          ? "Invoice already exists for this job card."
          : "Invoice raised successfully — ready for payment collection."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not raise invoice");
    } finally {
      setInvoicing(false);
    }
  }

  async function handleDownloadPdf() {
    if (!detail?.invoice) return;
    setDownloadingPdf(true);
    setError("");
    try {
      const invDetail = await api.getInvoiceDetail(detail.invoice.id);
      downloadInvoicePdf(invDetail, orgName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download invoice PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function reopenJobCard() {
    setReopening(true);
    setError("");
    setNotice("");
    try {
      await api.updateJobCard(id, { status: "in_progress" });
      setNotice("Job card reopened (In Progress). You can add or update items now.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen job card");
    } finally {
      setReopening(false);
    }
  }

  function handleDownloadJobCardDoc(docType: "estimate" | "proforma") {
    if (!detail) return;
    if ((addMode === "service" && selServiceId) || (addMode === "product" && prodName.trim())) {
      setError("Please add or save your pending item before downloading the PDF.");
      return;
    }
    if (detail.lineItems.length === 0) {
      setError("Add at least one service or product before downloading a document.");
      return;
    }
    setError("");
    downloadJobCardDocumentPdf(detail, orgName, docType, {
      discountPaise: previewDiscountPaise,
      taxPercent: previewTaxPct,
    });
  }

  const canRaiseInvoice = Boolean(
    detail && detail.jobCard.status !== "cancelled" && !detail.invoice
  );
  const canReopen = Boolean(
    detail && detail.jobCard.status === "completed" && !detail.invoice
  );
  const busy = saving || completing || invoicing || reopening;

  // Live preview totals while editing discount/tax
  const previewDiscountPaise = isEditable
    ? Math.max(0, Math.round((Number.isFinite(editDiscount) ? editDiscount : 0) * 100))
    : detail?.jobCard.discount ?? 0;
  const previewTaxPct = isEditable
    ? Math.min(100, Math.max(0, Number.isFinite(editTaxPercent) ? editTaxPercent : 0))
    : detail?.jobCard.taxPercent ?? 0;
  const subtotalPaise = detail?.jobCard.subtotal ?? 0;
  const discountedPaise = Math.max(subtotalPaise - previewDiscountPaise, 0);
  const taxAmountPaise = Math.round(discountedPaise * (previewTaxPct / 100));
  const totalPaise = discountedPaise + taxAmountPaise;

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <Sidebar orgName={orgName} onLogout={logout} />

      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          title={detail ? `Job Card · ${detail.jobCard.jobDate}` : "Job Card Details"}
          subtitle={
            detail
              ? `${detail.client?.name ?? ""} · ${detail.vehicle?.plateNumber ?? ""}`
              : "Loading job card details..."
          }
          actions={
            detail ? (
              <div className="flex flex-wrap items-center gap-2">
                {detail.jobCard.status !== "cancelled" && !detail.invoice && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDownloadJobCardDoc("estimate")}
                      disabled={detail.lineItems.length === 0}
                      title="Download Estimate PDF to share with customer"
                      className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Estimate PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadJobCardDoc("proforma")}
                      disabled={detail.lineItems.length === 0}
                      title="Download Proforma Invoice PDF for payment approval"
                      className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 shadow-sm hover:bg-sky-100 disabled:opacity-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Proforma PDF
                    </button>
                  </>
                )}
                {isEditable && (
                  <>
                    <button
                      type="button"
                      onClick={saveChanges}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={markComplete}
                      disabled={busy}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {completing ? "Completing..." : "Mark as Complete"}
                    </button>
                  </>
                )}
                {canRaiseInvoice && (
                  <button
                    type="button"
                    onClick={raiseInvoice}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-charcoal-800 disabled:opacity-50 transition-colors"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    {invoicing ? "Raising..." : "Raise Invoice"}
                  </button>
                )}
                {detail.invoice && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloadingPdf ? "Generating PDF..." : "Download PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/billing/${detail.invoice!.id}`)}
                      className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-charcoal-800 transition-colors"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      View Invoice
                    </button>
                  </>
                )}
              </div>
            ) : undefined
          }
        />

        <main className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            <Link
              to="/job-cards"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-charcoal-900"
            >
              <ArrowLeft size={14} /> Back to job cards
            </Link>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-600">
                <AlertCircle size={15} /> <span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={15} /> <span>{notice}</span>
              </div>
            )}

            {!detail ? (
              <div className="mt-6 space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <div className="mt-4 space-y-6 animate-slideUp">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize",
                        STATUS_STYLES[detail.jobCard.status] ?? "bg-slate-100 text-slate-600"
                      )}
                    >
                      {detail.jobCard.status.replace("_", " ")}
                    </span>
                    {isEditable && (
                      <span className="text-xs text-slate-500">
                        Work in progress — add newly discovered faults/parts and click <strong>Save</strong>, or <strong>Mark as Complete</strong> when ready to invoice.
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="rounded-xl2 border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <User size={15} className="text-slate-400" />
                      <h3 className="text-[14px] font-semibold text-charcoal-900">Client</h3>
                    </div>
                    <p className="text-[14px] font-semibold text-charcoal-900">{detail.client?.name}</p>
                    <p className="text-[13px] text-slate-500">{detail.client?.phone}</p>
                    {detail.client?.address && (
                      <p className="text-[13px] text-slate-400 mt-1">{detail.client.address}</p>
                    )}
                  </div>

                  <div className="rounded-xl2 border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Car size={15} className="text-slate-400" />
                      <h3 className="text-[14px] font-semibold text-charcoal-900">Vehicle</h3>
                    </div>
                    <p className="text-[14px] font-semibold font-mono text-charcoal-900">
                      {detail.vehicle?.plateNumber}
                    </p>
                    <p className="text-[13px] text-slate-500">
                      {detail.vehicle?.makeName} {detail.vehicle?.modelName}{" "}
                      {detail.vehicle?.segment ? `· ${detail.vehicle.segment}` : ""}
                    </p>
                    {detail.vehicle?.odometerReading && (
                      <p className="text-[13px] text-slate-400 mt-1">
                        {detail.vehicle.odometerReading.toLocaleString("en-IN")} km
                      </p>
                    )}
                  </div>
                </div>

                {/* Line Items Card with Ongoing Work Add/Remove Controls */}
                <div className="rounded-xl2 border border-slate-200/80 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-[15px] font-semibold text-charcoal-900">
                        Services & Spare Parts
                      </h3>
                      <p className="text-xs text-slate-400">
                        {detail.lineItems.length} line item{detail.lineItems.length === 1 ? "" : "s"} recorded
                      </p>
                    </div>

                    {isEditable && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAddMode(addMode === "service" ? "none" : "service")}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                            addMode === "service"
                              ? "border-charcoal-900 bg-charcoal-900 text-white"
                              : "border-slate-200 bg-white text-charcoal-900 hover:bg-slate-50"
                          )}
                        >
                          <Plus size={14} />
                          Add Service
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddMode(addMode === "product" ? "none" : "product")}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                            addMode === "product"
                              ? "border-charcoal-900 bg-charcoal-900 text-white"
                              : "border-slate-200 bg-white text-charcoal-900 hover:bg-slate-50"
                          )}
                        >
                          <Plus size={14} />
                          Add Part / Product
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Add Service Panel */}
                  {isEditable && addMode === "service" && (
                    <form
                      onSubmit={submitServiceItem}
                      className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 animate-slideUp"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-charcoal-900 flex items-center gap-1.5">
                          <Wrench className="h-3.5 w-3.5 text-sky-600" /> Add Additional Service
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddMode("none")}
                          className="text-xs text-slate-400 hover:text-charcoal-900"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                        <div className="flex-1">
                          <label className="text-[11px] font-medium text-slate-500">Service</label>
                          <Dropdown
                            value={selServiceId}
                            onChange={onServicePick}
                            placeholder="Select service..."
                            className="mt-1 w-full"
                            size="sm"
                            options={services
                              .filter((s) => s.name.trim().length > 0)
                              .map((s) => ({ value: s.id, label: s.name }))}
                          />
                        </div>
                        <div className="w-full sm:w-20">
                          <label className="text-[11px] font-medium text-slate-500">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={svcQty}
                            onChange={(e) => setSvcQty(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-accent-500 focus:outline-none"
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <label className="text-[11px] font-medium text-slate-500">Unit Price (₹)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={svcPrice}
                            onChange={(e) => setSvcPrice(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-accent-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submittingItem}
                          className="rounded-lg bg-charcoal-900 px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal-800 disabled:opacity-50 shrink-0"
                        >
                          {submittingItem ? "Adding..." : "Add to Card"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Quick Add Product/Part Panel */}
                  {isEditable && addMode === "product" && (
                    <form
                      onSubmit={submitProductItem}
                      className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 animate-slideUp"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-charcoal-900 flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-emerald-600" /> Add Additional Part / Product
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddMode("none")}
                          className="text-xs text-slate-400 hover:text-charcoal-900"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500">
                            Choose from Catalogue (optional)
                          </label>
                          <select
                            value={selProductId}
                            onChange={(e) => onProductPick(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-accent-500"
                          >
                            <option value="">-- Custom / Other Part --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (₹{(p.mrp / 100).toLocaleString("en-IN")})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Part / Product Name *</label>
                          <input
                            type="text"
                            value={prodName}
                            onChange={(e) => setProdName(e.target.value)}
                            placeholder="e.g. Brake Pad Set Front"
                            required
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-none focus:border-accent-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-24">
                          <label className="text-[11px] font-medium text-slate-500">Qty</label>
                          <input
                            type="number"
                            min={1}
                            value={prodQty}
                            onChange={(e) => setProdQty(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-accent-500 focus:outline-none"
                          />
                        </div>
                        <div className="w-36">
                          <label className="text-[11px] font-medium text-slate-500">Unit Price (₹)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={prodPrice}
                            onChange={(e) => setProdPrice(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] focus:border-accent-500 focus:outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submittingItem}
                          className="ml-auto rounded-lg bg-charcoal-900 px-4 py-2 text-xs font-semibold text-white hover:bg-charcoal-800 disabled:opacity-50"
                        >
                          {submittingItem ? "Adding..." : "Add to Card"}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Recorded Items Table */}
                  <div className="divide-y divide-slate-100">
                    {detail.lineItems.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400">
                        No services or parts added yet.
                      </p>
                    ) : (
                      detail.lineItems.map((li) => {
                        const itemType = li.type ?? "service";
                        return (
                          <div
                            key={`${itemType}-${li.id}`}
                            className="flex items-center justify-between gap-4 py-3 text-[13.5px]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span
                                className={cn(
                                  "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border",
                                  itemType === "product"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-sky-200 bg-sky-50 text-sky-700"
                                )}
                              >
                                {itemType === "product" ? "Part" : "Service"}
                              </span>
                              <span className="font-medium text-charcoal-900 truncate">
                                {li.serviceName}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-xs text-slate-400">
                                {li.qty} × {rupees(li.price)}
                              </span>
                              <span className="font-semibold text-charcoal-900 w-24 text-right">
                                {rupees(li.qty * li.price)}
                              </span>
                              {isEditable && (
                                <button
                                  type="button"
                                  onClick={() => removeItem(li.id, itemType, li.serviceName)}
                                  title="Remove item"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Totals & Discount/Tax Controls */}
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {isEditable && (
                      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200/70">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Discount (₹)</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={editDiscount}
                            onChange={(e) => setEditDiscount(Number(e.target.value))}
                            className="mt-1 block w-32 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Tax</label>
                          <Dropdown
                            value={String(editTaxPercent)}
                            onChange={(v) => setEditTaxPercent(Number(v))}
                            className="mt-1 w-36"
                            size="sm"
                            options={[
                              { value: "0", label: "No Tax (0%)" },
                              { value: "18", label: "GST 18%" },
                            ]}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col items-end gap-1.5 text-[13px]">
                      <div className="flex gap-8">
                        <span className="text-slate-400">Subtotal</span>
                        <span className="font-medium text-charcoal-900 w-24 text-right">
                          {rupees(subtotalPaise)}
                        </span>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-slate-400">Discount</span>
                        <span className="font-medium text-charcoal-900 w-24 text-right">
                          −{rupees(previewDiscountPaise)}
                        </span>
                      </div>
                      <div className="flex gap-8">
                        <span className="text-slate-400">Tax ({previewTaxPct}%)</span>
                        <span className="font-medium text-charcoal-900 w-24 text-right">
                          {taxAmountPaise > 0 ? rupees(taxAmountPaise) : "—"}
                        </span>
                      </div>
                      <div className="flex gap-8 text-[15px] pt-1 border-t border-slate-100 mt-1">
                        <span className="font-semibold text-charcoal-900">Total</span>
                        <span className="font-bold text-charcoal-900 w-24 text-right">
                          {rupees(totalPaise)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {detail.serviceAdvisorName && (
                    <p className="mt-3 text-[12px] text-slate-400">
                      Service Advisor: {detail.serviceAdvisorName}
                    </p>
                  )}

                  {/* Bottom Save, Mark as Complete, Reopen & Raise Invoice Bar */}
                  {(isEditable || canRaiseInvoice || canReopen) && (
                    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
                      {canReopen && (
                        <button
                          type="button"
                          onClick={reopenJobCard}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-50 transition-colors"
                        >
                          <RotateCcw size={15} />
                          {reopening ? "Reopening..." : "Reopen for Edits"}
                        </button>
                      )}
                      {isEditable && (
                        <>
                          <button
                            type="button"
                            onClick={saveChanges}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          >
                            <Save size={15} />
                            {saving ? "Saving..." : "Save (Keep In Progress)"}
                          </button>
                          <button
                            type="button"
                            onClick={markComplete}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle2 size={15} />
                            {completing ? "Completing..." : "Mark as Complete"}
                          </button>
                        </>
                      )}
                      {canRaiseInvoice && (
                        <button
                          type="button"
                          onClick={raiseInvoice}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl bg-charcoal-900 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-charcoal-800 disabled:opacity-50 transition-colors"
                        >
                          <Receipt size={15} />
                          {invoicing ? "Raising Invoice..." : "Raise Invoice"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {detail.invoice && (
                  <div className="w-full rounded-xl2 border border-accent-500/20 bg-accent-500/5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13.5px] font-semibold text-accent-700">
                            Invoice raised — share PDF or collect payment
                          </p>
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-accent-600 capitalize border border-accent-500/15">
                            {detail.invoice.status}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                          #{detail.invoice.id.slice(0, 8)} · {rupees(detail.invoice.total)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={downloadingPdf}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingPdf ? "Generating PDF..." : "Download PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/billing/${detail.invoice!.id}`)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-charcoal-800 transition-colors"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          View Invoice
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
