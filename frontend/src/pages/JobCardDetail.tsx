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
  CreditCard,
  Layers,
  Edit3,
  Clock,
  Truck,
  X,
  XCircle,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { api, JobCardDetail, JobCardJobWork, Service, Product } from "../api";
import { downloadInvoicePdf, downloadJobCardDocumentPdf } from "../utils/invoicePdf";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/ui/TopBar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import SearchCombobox from "../components/ui/SearchCombobox";
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

  // Remarks
  const [remarks, setRemarks] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);

  // Advance Payment Modal
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmountInput, setAdvanceAmountInput] = useState("");
  const [advanceMode, setAdvanceMode] = useState<"cash" | "upi" | "card">("upi");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  // Job Work Modal
  const [showJobWorkModal, setShowJobWorkModal] = useState(false);
  const [jwVendorName, setJwVendorName] = useState("");
  const [jwWorkDescription, setJwWorkDescription] = useState("");
  const [jwCost, setJwCost] = useState("");
  const [jwStatus, setJwStatus] = useState<"sent" | "in_progress" | "completed" | "returned">("sent");
  const [jwVendorRef, setJwVendorRef] = useState("");
  const [jwNotes, setJwNotes] = useState("");
  const [submittingJobWork, setSubmittingJobWork] = useState(false);

  // Cancel & Delete Modals & User Roles
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [showDocMenu, setShowDocMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    return api
      .getJobCardDetail(id)
      .then((d) => {
        setDetail(d);
        setEditDiscount(d.jobCard.discount / 100);
        setEditTaxPercent(d.jobCard.taxPercent);
        setRemarks(d.jobCard.remarks || "");
      })
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => {
      setOrgName(me.org.name);
      setUserRoles(me.roles ?? []);
    }).catch(() => {});
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
      remarks: remarks.trim() || undefined,
      status: "in_progress",
    });
  }

  async function handleSaveRemarks() {
    setSavingRemarks(true);
    setError("");
    setNotice("");
    try {
      await api.updateJobCard(id, { remarks: remarks.trim() || undefined });
      setNotice("Remarks saved.");
      setTimeout(() => setNotice(""), 3000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save remarks");
    } finally {
      setSavingRemarks(false);
    }
  }

  async function handleRecordAdvance(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(advanceAmountInput);
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid advance amount greater than 0.");
      return;
    }
    setSubmittingAdvance(true);
    setError("");
    setNotice("");
    try {
      await api.recordJobCardAdvance(id, {
        amount: Math.round(amountNum * 100),
        mode: advanceMode,
        notes: advanceNotes.trim() || undefined,
      });
      setShowAdvanceModal(false);
      setAdvanceAmountInput("");
      setAdvanceNotes("");
      setNotice(`₹${amountNum.toLocaleString("en-IN")} advance recorded to customer account!`);
      setTimeout(() => setNotice(""), 4000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record advance");
    } finally {
      setSubmittingAdvance(false);
    }
  }

  async function handleCreateJobWork(e: React.FormEvent) {
    e.preventDefault();
    if (!jwVendorName.trim() || !jwWorkDescription.trim()) {
      setError("Please enter vendor name and work description.");
      return;
    }
    setSubmittingJobWork(true);
    setError("");
    setNotice("");
    try {
      await api.addJobCardJobWork(id, {
        vendorName: jwVendorName.trim(),
        workDescription: jwWorkDescription.trim(),
        vendorCost: Math.round((Number(jwCost) || 0) * 100),
        status: jwStatus,
        vendorRef: jwVendorRef.trim() || undefined,
        notes: jwNotes.trim() || undefined,
      });
      setShowJobWorkModal(false);
      setJwVendorName("");
      setJwWorkDescription("");
      setJwCost("");
      setJwVendorRef("");
      setJwNotes("");
      setNotice("Job work outsourced entry created.");
      setTimeout(() => setNotice(""), 3000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add job work");
    } finally {
      setSubmittingJobWork(false);
    }
  }

  async function handleDeleteJobWork(workId: string) {
    if (!confirm("Remove this outsourced job work entry?")) return;
    setError("");
    setNotice("");
    try {
      await api.deleteJobCardJobWork(id, workId);
      setNotice("Job work removed.");
      setTimeout(() => setNotice(""), 3000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete job work");
    }
  }

  async function handleUpdateJobWorkStatus(workId: string, newStatus: "sent" | "in_progress" | "completed" | "returned") {
    try {
      await api.updateJobCardJobWork(id, workId, { status: newStatus });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
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
      await api.reopenJobCard(id);
      setNotice("Job card reopened (In Progress). You can add or update items now.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen job card");
    } finally {
      setReopening(false);
    }
  }

  async function handleCancelJobCard(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setCancelling(true);
    setError("");
    try {
      await api.cancelJobCard(id, cancelReason.trim() || undefined);
      setShowCancelModal(false);
      setCancelReason("");
      setNotice("Job card has been marked as cancelled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel job card");
    } finally {
      setCancelling(false);
    }
  }

  async function handleDeleteJobCard() {
    setDeleting(true);
    setError("");
    try {
      await api.deleteJobCard(id);
      navigate("/job-cards", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete job card");
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
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

  const isAdmin = userRoles.some((r) => ["org_owner", "admin", "super_admin"].includes(r));
  const canRaiseInvoice = Boolean(
    detail && detail.jobCard.status !== "cancelled" && !detail.invoice
  );
  const canReopen = Boolean(
    detail && (detail.jobCard.status === "completed" || detail.jobCard.status === "cancelled") && (!detail.invoice || detail.invoice.status === "draft")
  );
  const canCancel = Boolean(
    detail && detail.jobCard.status !== "cancelled" && (!detail.invoice || detail.invoice.status === "draft")
  );
  const canDelete = Boolean(
    isAdmin && detail && (!detail.invoice || detail.invoice.status === "draft" || detail.invoice.status === "cancelled")
  );
  const busy = saving || completing || invoicing || reopening || cancelling || deleting;

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
                {/* 1. PDF Documents Dropdown (Estimate / Proforma) */}
                {detail.jobCard.status !== "cancelled" && !detail.invoice && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDocMenu((prev) => !prev)}
                      disabled={detail.lineItems.length === 0}
                      title="Download estimate or proforma PDF"
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      <span>PDF Docs</span>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>

                    {showDocMenu && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowDocMenu(false)} />
                        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated z-40 animate-slideUp">
                          <button
                            type="button"
                            onClick={() => {
                              setShowDocMenu(false);
                              handleDownloadJobCardDoc("estimate");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-charcoal-900 hover:bg-slate-50 transition-colors"
                          >
                            <FileText className="h-4 w-4 text-amber-600" />
                            <div>
                              <p className="font-semibold">Estimate PDF</p>
                              <p className="text-[10px] text-slate-400">Customer quote sheet</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDocMenu(false);
                              handleDownloadJobCardDoc("proforma");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-charcoal-900 hover:bg-slate-50 transition-colors"
                          >
                            <Download className="h-4 w-4 text-sky-600" />
                            <div>
                              <p className="font-semibold">Proforma PDF</p>
                              <p className="text-[10px] text-slate-400">Advance / insurance invoice</p>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 2. Secondary Save Button (only when editable) */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={saveChanges}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <Save className="h-3.5 w-3.5 text-slate-500" />
                    {saving ? "Saving..." : "Save"}
                  </button>
                )}

                {/* 3. Primary CTA based on lifecycle state */}
                {isEditable && (
                  <button
                    type="button"
                    onClick={markComplete}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {completing ? "Completing..." : "Mark as Complete"}
                  </button>
                )}

                {detail.jobCard.status === "completed" && !detail.invoice && (
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

                {/* Invoiced state CTAs */}
                {detail.invoice && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloadingPdf ? "Generating..." : "Download PDF"}
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

                {/* 4. More Actions Menu (Cancel, Re-open, Raise Invoice directly, Delete) */}
                {(canCancel || canReopen || canDelete || (isEditable && !detail.invoice)) && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu((prev) => !prev)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-charcoal-900 transition-colors"
                      title="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {showMoreMenu && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated z-40 animate-slideUp">
                          {isEditable && !detail.invoice && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                raiseInvoice();
                              }}
                              disabled={busy}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-charcoal-900 hover:bg-slate-50 transition-colors"
                            >
                              <Receipt className="h-3.5 w-3.5 text-slate-500" />
                              <span>Raise Invoice Directly</span>
                            </button>
                          )}
                          {canReopen && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                reopenJobCard();
                              }}
                              disabled={busy}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                              <span>Re-open to In-Progress</span>
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowMoreMenu(false);
                                setShowCancelModal(true);
                              }}
                              disabled={busy}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors"
                            >
                              <XCircle className="h-3.5 w-3.5 text-rose-500" />
                              <span>Cancel Job Card</span>
                            </button>
                          )}
                          {canDelete && (
                            <>
                              <div className="my-1 h-px bg-slate-100" />
                              <button
                                type="button"
                                onClick={() => {
                                  setShowMoreMenu(false);
                                  setShowDeleteModal(true);
                                }}
                                disabled={busy}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                                <span>Delete Job Card</span>
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
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
                          <label className="text-[11px] font-medium text-slate-500">Service / Labour</label>
                          <SearchCombobox
                            value={selServiceId}
                            onChange={onServicePick}
                            placeholder="Search service / labour..."
                            searchPlaceholder="Type service name..."
                            className="mt-1 w-full"
                            size="sm"
                            options={services
                              .filter((s) => s.name.trim().length > 0)
                              .map((s) => ({
                                value: s.id,
                                label: s.name,
                                sub: s.recurrenceDays ? `${s.recurrenceDays}d recurrence` : undefined,
                                price: s.defaultPrice / 100,
                              }))}
                            formatPrice={(p) => `₹${p.toLocaleString("en-IN")}`}
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
                            Search Catalogue Part / SKU
                          </label>
                          <SearchCombobox
                            value={selProductId}
                            onChange={onProductPick}
                            placeholder="Search catalogue parts..."
                            searchPlaceholder="Type part name, brand, or SKU..."
                            className="mt-1 w-full"
                            size="sm"
                            allowClear
                            options={products.map((p) => ({
                              value: p.id,
                              label: p.name,
                              sub: p.sku ? `SKU: ${p.sku}` : undefined,
                              price: p.mrp / 100,
                            }))}
                            formatPrice={(p) => `₹${p.toLocaleString("en-IN")}`}
                          />
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
                      {detail.jobCard.advanceAmount > 0 && (
                        <>
                          <div className="flex gap-8 text-[13px] text-emerald-600 font-medium">
                            <span>Advance Paid</span>
                            <span className="w-24 text-right">
                              −{rupees(detail.jobCard.advanceAmount)}
                            </span>
                          </div>
                          <div className="flex gap-8 text-[14px] font-bold text-charcoal-900 pt-1 border-t border-slate-100">
                            <span>Net Balance Due</span>
                            <span className="w-24 text-right text-rose-600">
                              {rupees(Math.max(totalPaise - detail.jobCard.advanceAmount, 0))}
                            </span>
                          </div>
                        </>
                      )}
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

                {/* Remarks & Advance Payment Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Job Card Remarks */}
                  <div className="rounded-xl2 border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Edit3 size={15} className="text-slate-400" />
                        <h3 className="text-[14px] font-semibold text-charcoal-900">Job Card Remarks / Note</h3>
                      </div>
                      {isEditable && (
                        <button
                          type="button"
                          onClick={handleSaveRemarks}
                          disabled={savingRemarks}
                          className="text-xs font-semibold text-accent-600 hover:text-accent-500 disabled:opacity-50"
                        >
                          {savingRemarks ? "Saving..." : "Save Note"}
                        </button>
                      )}
                    </div>
                    {isEditable ? (
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Enter customer requests, preexisting dents/scratches, or special technician notes..."
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:border-charcoal-900 focus:outline-none"
                      />
                    ) : (
                      <p className="text-[13px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                        {detail.jobCard.remarks || "No remarks noted."}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      Printed on Estimate, Proforma Invoice, and Tax Invoice PDFs.
                    </p>
                  </div>

                  {/* Customer Advance Card */}
                  <div className="rounded-xl2 border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CreditCard size={15} className="text-emerald-600" />
                          <h3 className="text-[14px] font-semibold text-charcoal-900">Parts / Service Advance</h3>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
                          Account Advance
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-charcoal-900">
                          {rupees(detail.jobCard.advanceAmount)}
                        </span>
                        <span className="text-xs text-slate-400">received for this job</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Credited to customer wallet account and deducted from the final invoice amount.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAdvanceModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 transition-colors w-full justify-center"
                      >
                        <Plus size={14} /> Record Advance Payment
                      </button>
                    </div>
                  </div>
                </div>

                {/* Outsourced Job Work (Lathe / Machining / Specialist) Section */}
                <div className="rounded-xl2 border border-slate-200/80 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-lg bg-sky-50 p-2 text-sky-700 border border-sky-100">
                        <Truck size={16} />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-semibold text-charcoal-900">
                          Job Work / Outsourced Work
                        </h3>
                        <p className="text-xs text-slate-400">
                          Track lathe, head machining, bumper plastic welding, or specialist vendor work
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {detail.jobWorks && detail.jobWorks.length > 0 && (
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                          Total Vendor Cost: {rupees(detail.jobWorks.reduce((s, j) => s + j.vendorCost, 0))}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowJobWorkModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal-900 shadow-sm hover:bg-slate-50 transition-colors"
                      >
                        <Plus size={14} /> Add Job Work
                      </button>
                    </div>
                  </div>

                  {(!detail.jobWorks || detail.jobWorks.length === 0) ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                      <p className="text-xs text-slate-400">
                        No outsourced vendor work recorded for this job card.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/70">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Vendor</th>
                            <th className="py-2.5 px-3">Work Description</th>
                            <th className="py-2.5 px-3">Challan / Ref</th>
                            <th className="py-2.5 px-3">Cost (₹)</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detail.jobWorks.map((jw) => (
                            <tr key={jw.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-semibold text-charcoal-900">{jw.vendorName}</td>
                              <td className="py-2.5 px-3 text-slate-700">
                                <div>{jw.workDescription}</div>
                                {jw.notes && <div className="text-[11px] text-slate-400 mt-0.5">{jw.notes}</div>}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{jw.vendorRef || "—"}</td>
                              <td className="py-2.5 px-3 font-semibold text-charcoal-900">{rupees(jw.vendorCost)}</td>
                              <td className="py-2.5 px-3">
                                <select
                                  value={jw.status}
                                  onChange={(e) => handleUpdateJobWorkStatus(jw.id, e.target.value as any)}
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium outline-none capitalize"
                                >
                                  <option value="sent">Sent</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="returned">Returned</option>
                                </select>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteJobWork(jw.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                  title="Delete entry"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

            {/* Advance Payment Modal */}
            {showAdvanceModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 p-4 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleUp">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                        <CreditCard size={18} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-charcoal-900">Record Advance Payment</h4>
                        <p className="text-xs text-slate-400">Parts / Labour deposit for this job</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanceModal(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleRecordAdvance} className="mt-4 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Advance Amount (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={advanceAmountInput}
                        onChange={(e) => setAdvanceAmountInput(e.target.value)}
                        placeholder="e.g. 5000"
                        required
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-charcoal-900 focus:border-charcoal-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">Payment Mode</label>
                      <div className="mt-1.5 grid grid-cols-3 gap-2">
                        {(["upi", "cash", "card"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setAdvanceMode(m)}
                            className={cn(
                              "rounded-xl border py-2 text-xs font-semibold uppercase transition-colors",
                              advanceMode === m
                                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">Notes / Purpose (optional)</label>
                      <input
                        type="text"
                        value={advanceNotes}
                        onChange={(e) => setAdvanceNotes(e.target.value)}
                        placeholder="e.g. Advance for special-order clutch plate & flywheel"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-charcoal-900 focus:outline-none"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      This will record the advance on this Job Card, credit the customer's wallet account, and reflect on the Estimate & final Invoice.
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAdvanceModal(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingAdvance}
                        className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {submittingAdvance ? "Recording..." : "Record Advance"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Add Job Work Modal */}
            {showJobWorkModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 p-4 backdrop-blur-xs">
                <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleUp">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-sky-50 p-2 text-sky-700">
                        <Truck size={18} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-charcoal-900">Add Outsourced Job Work</h4>
                        <p className="text-xs text-slate-400">Track vendor lathe, machining, welding, or specialist work</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowJobWorkModal(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleCreateJobWork} className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Vendor / Workshop Name *</label>
                        <input
                          type="text"
                          value={jwVendorName}
                          onChange={(e) => setJwVendorName(e.target.value)}
                          placeholder="e.g. Sri Balaji Lathe Works"
                          required
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-charcoal-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Vendor Challan / Ref No</label>
                        <input
                          type="text"
                          value={jwVendorRef}
                          onChange={(e) => setJwVendorRef(e.target.value)}
                          placeholder="e.g. CH-2024-88"
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-charcoal-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">Work Description *</label>
                      <textarea
                        value={jwWorkDescription}
                        onChange={(e) => setJwWorkDescription(e.target.value)}
                        placeholder="e.g. Cylinder head resurfacing, valve seat grinding, and leak test"
                        required
                        rows={2}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-charcoal-900 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Vendor Cost (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={jwCost}
                          onChange={(e) => setJwCost(e.target.value)}
                          placeholder="0"
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-charcoal-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Initial Status</label>
                        <select
                          value={jwStatus}
                          onChange={(e) => setJwStatus(e.target.value as any)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium focus:border-charcoal-900 focus:outline-none capitalize"
                        >
                          <option value="sent">Sent to Vendor</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="returned">Returned</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600">Internal Notes (optional)</label>
                      <input
                        type="text"
                        value={jwNotes}
                        onChange={(e) => setJwNotes(e.target.value)}
                        placeholder="e.g. Promised delivery by tomorrow 4 PM"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-charcoal-900 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowJobWorkModal(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingJobWork}
                        className="rounded-xl bg-charcoal-900 px-5 py-2 text-xs font-semibold text-white hover:bg-charcoal-800 disabled:opacity-50"
                      >
                        {submittingJobWork ? "Adding..." : "Add Job Work"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Cancel Job Card Modal */}
            {showCancelModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 p-4 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleUp">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
                        <XCircle size={18} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-charcoal-900">Cancel Job Card</h4>
                        <p className="text-xs text-slate-400">Mark this job card as cancelled</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(false)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <form onSubmit={handleCancelJobCard} className="mt-4 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Cancellation Reason (optional)</label>
                      <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="e.g. Customer declined repair estimate / parts unavailable"
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-charcoal-900 focus:outline-none"
                      />
                    </div>

                    <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                      Cancelling will mark the job card as cancelled. Admins can re-open it later if needed.
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(false)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Keep Active
                      </button>
                      <button
                        type="submit"
                        disabled={cancelling}
                        className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {cancelling ? "Cancelling..." : "Confirm Cancellation"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Admin Delete Confirmation Modal */}
            {showDeleteModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 p-4 backdrop-blur-xs">
                <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-2xl animate-scaleUp">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-rose-100 p-2.5 text-rose-600">
                      <Trash2 size={20} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-charcoal-900">Delete Job Card Permanently?</h4>
                      <p className="text-xs text-slate-400">Admin-only operation</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                    Are you sure you want to permanently delete this Job Card ({detail?.client?.name ?? "Customer"} - {detail?.vehicle?.plateNumber ?? ""})?
                    All linked items, lathe works, and mechanics will be deleted. <strong>This action cannot be undone.</strong>
                  </p>

                  <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(false)}
                      disabled={deleting}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteJobCard}
                      disabled={deleting}
                      className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm"
                    >
                      {deleting ? "Deleting..." : "Permanently Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
