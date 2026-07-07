import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Boxes, AlertTriangle, CreditCard, Wallet, Trash2, XCircle, Search } from "lucide-react";
import { api, InventoryItem, InventorySummary, PurchaseInput, InventoryConsumption, Vendor, VehicleSearchResult } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import FloatingInput from "../components/FloatingInput";
import { downloadCsv } from "../utils/csv";
import { uid } from "../utils/id";

type Tab = "available" | "expired" | "history" | "all";
const PAGE_SIZE = 12;
const SOURCE_LABELS: Record<string, string> = { vendor: "Vendor", client: "Client", mechanic: "Mechanic", unknown: "—" };

interface ItemRow {
  key: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number; // Cost Price
  salePrice: number; // MRP/Selling Price
  vehicleId: string;
  vehiclePlate: string;
  expiryDate: string;
}

const EMPTY_ITEM = (): ItemRow => ({ key: uid(), productName: "", quantity: 1, unit: "Pcs", purchasePrice: 0, salePrice: 0, vehicleId: "", vehiclePlate: "", expiryDate: "" });

export default function Inventory() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [tab, setTab] = useState<Tab>("available");
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [consumptions, setConsumptions] = useState<InventoryConsumption[] | null>(null);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [lotNo, setLotNo] = useState("");
  const [sourceType, setSourceType] = useState<PurchaseInput["sourceType"]>("vendor");
  const [sourceName, setSourceName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorsList, setVendorsList] = useState<Vendor[]>([]);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [isCredit, setIsCredit] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [lotItems, setLotItems] = useState<ItemRow[]>([EMPTY_ITEM()]);
  const [saving, setSaving] = useState(false);
  const { branchParam } = useBranch();

  const [vehicleSearchText, setVehicleSearchText] = useState<Record<string, string>>({});
  const [vehicleSuggestions, setVehicleSuggestions] = useState<Record<string, VehicleSearchResult[]>>({});

  function loadItems() {
    if (tab === "history") return;
    api.listInventory(tab, branchParam).then(setItems).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    api.listVendors().then(setVendorsList).catch(() => {});
  }, []);

  useEffect(() => {
    api.inventorySummary(branchParam).then(setSummary).catch(() => {});
  }, [branchParam]);

  function loadConsumptions() {
    api.listInventoryConsumptions().then(setConsumptions).catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (tab === "history") {
      setConsumptions(null);
      loadConsumptions();
    } else {
      setItems(null);
      loadItems();
    }
    setPage(1);
  }, [tab, branchParam]);

  useEffect(() => setPage(1), [search]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    return q
      ? items.filter(
          (i) => i.productName.toLowerCase().includes(q) || i.lotNo.includes(q) || (i.sourceName ?? "").toLowerCase().includes(q) || (i.invoiceNo ?? "").toLowerCase().includes(q)
        )
      : items;
  }, [items, search]);

  const filteredConsumptions = useMemo(() => {
    if (!consumptions) return [];
    const q = search.trim().toLowerCase();
    return q
      ? consumptions.filter(
          (c) => c.productName.toLowerCase().includes(q) || (c.notes ?? "").toLowerCase().includes(q)
        )
      : consumptions;
  }, [consumptions, search]);

  const isHistory = tab === "history";
  const activeListLength = isHistory ? filteredConsumptions.length : filtered.length;
  const pageCount = Math.max(Math.ceil(activeListLength / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageRowsConsumptions = filteredConsumptions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    downloadCsv(
      `inventory-${tab}.csv`,
      filtered.map((i) => ({
        Product: i.productName,
        Qty: i.quantity,
        Unit: i.unit ?? "",
        SalePrice: (i.salePrice / 100).toFixed(2),
        Expiry: i.expiryDate ?? "",
        Lot: i.lotNo,
        Source: `${SOURCE_LABELS[i.sourceType]}${i.sourceName ? ` - ${i.sourceName}` : ""}`,
        Invoice: i.invoiceNo ?? "",
        Credit: i.isCredit ? "Yes" : "No",
      }))
    );
  }

  function setItem(key: string, patch: Partial<ItemRow>) {
    setLotItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onVehicleSearch(key: string, query: string) {
    setVehicleSearchText((prev) => ({ ...prev, [key]: query }));
    if (query.trim().length < 2) {
      setVehicleSuggestions((prev) => ({ ...prev, [key]: [] }));
      return;
    }
    api.searchVehicles(query).then((res) => {
      setVehicleSuggestions((prev) => ({ ...prev, [key]: res }));
    }).catch(() => {});
  }

  function selectVehicle(key: string, v: VehicleSearchResult) {
    setItem(key, { vehicleId: v.id, vehiclePlate: v.plateNumber });
    setVehicleSearchText((prev) => ({ ...prev, [key]: v.plateNumber }));
    setVehicleSuggestions((prev) => ({ ...prev, [key]: [] }));
  }

  async function submitPurchase(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const valid = lotItems.filter((i) => i.productName.trim());
    if (valid.length === 0) {
      setError("add at least one product");
      return;
    }

    if (sourceType === "vendor" && !vendorId) {
      setError("please select a vendor");
      return;
    }

    setSaving(true);
    try {
      const selectedVendor = vendorsList.find((v) => v.id === vendorId);
      await api.recordPurchase({
        lotNo,
        sourceType,
        sourceName: sourceType === "vendor" ? (selectedVendor?.name || "") : sourceName,
        vendorId: sourceType === "vendor" ? vendorId : undefined,
        invoiceNo: invoiceNo || undefined,
        purchaseDate,
        isCredit,
        totalAmount,
        amountPaid,
        items: valid.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          purchasePrice: i.purchasePrice,
          salePrice: i.salePrice,
          vehicleId: i.vehicleId || undefined,
          expiryDate: i.expiryDate || undefined,
        })),
      });
      setShowForm(false);
      setLotNo(""); setSourceName(""); setVendorId(""); setInvoiceNo(""); setIsCredit(false); setTotalAmount(0); setAmountPaid(0);
      setLotItems([EMPTY_ITEM()]);
      setVehicleSearchText({});
      setVehicleSuggestions({});
      api.inventorySummary(branchParam).then(setSummary).catch(() => {});
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not record purchase");
    } finally {
      setSaving(false);
    }
  }

  async function handleConsume(itemId: string, qty: number, notes?: string) {
    try {
      await api.consumeInventoryItem(itemId, qty, notes);
      loadItems();
      api.inventorySummary(branchParam).then(setSummary).catch(() => {});
    } catch (err) {
      alert(err instanceof Error ? err.message : "could not record consumption");
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex items-center justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Inventory</h1>
              <p className="mt-1 text-[14px] text-slate-400">Stock by lot, expiry, source and credit.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800">
              <Plus size={15} /> Record purchase
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard label="Available items" value={summary?.availableItems ?? 0} icon={Boxes} loading={!summary} />
            <StatCard label="Stock value" value={`₹${((summary?.availableValue ?? 0) / 100).toLocaleString("en-IN")}`} icon={Wallet} loading={!summary} info="Quantity × sale price across in-stock, non-expired items." />
            <StatCard label="Expired items" value={summary?.expiredItems ?? 0} icon={AlertTriangle} loading={!summary} />
            <StatCard label="Credit outstanding" value={`₹${((summary?.creditOutstanding ?? 0) / 100).toLocaleString("en-IN")}`} icon={CreditCard} loading={!summary} info="Amount still owed to suppliers on credit purchases." />
          </div>

          <div className="mt-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {(["available", "expired", "history", "all"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize transition-colors ${tab === t ? "bg-white text-charcoal-900 shadow-card" : "text-slate-500 hover:text-charcoal-900"}`}>
                {t === "available" ? "Available stock" : t === "expired" ? "Expired stock" : t === "history" ? "Consumption History" : "All"}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <TableToolbar search={search} onSearch={setSearch} placeholder="Search product, lot, source, invoice..." onDownload={exportCsv} />
          </div>

          {error && !showForm && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}

          <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                {tab === "history" ? (
                  <>
                    <thead>
                      <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                        <th className="px-5 py-3.5">Date</th>
                        <th className="px-5 py-3.5">Product</th>
                        <th className="px-5 py-3.5">Quantity</th>
                        <th className="px-5 py-3.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!consumptions ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>{Array.from({ length: 4 }).map((__, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                        ))
                      ) : filteredConsumptions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-16 text-center">
                            <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">No consumption history found</p>
                          </td>
                        </tr>
                      ) : (
                        pageRowsConsumptions.map((c) => (
                          <tr key={c.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                            <td className="px-5 py-4 whitespace-nowrap text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                            <td className="px-5 py-4 font-medium whitespace-nowrap">{c.productName}</td>
                            <td className="px-5 py-4 whitespace-nowrap">{c.quantity}</td>
                            <td className="px-5 py-4 text-slate-500">{c.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                        <th className="px-5 py-3.5">Product</th>
                        <th className="px-5 py-3.5">In stock</th>
                        <th className="px-5 py-3.5">Sale price</th>
                        <th className="px-5 py-3.5">Expiry</th>
                        <th className="px-5 py-3.5">Lot</th>
                        <th className="px-5 py-3.5">Source</th>
                        <th className="px-5 py-3.5">Invoice</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!items ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                        ))
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-5 py-16 text-center">
                            <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">No {tab === "expired" ? "expired" : "stock"} found</p>
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((i) => (
                          <tr key={i.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                            <td className="px-5 py-4 font-medium whitespace-nowrap">{i.productName}</td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className={i.quantity <= 0 ? "text-slate-400" : ""}>{i.quantity} {i.unit ?? ""}</span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">₹{(i.salePrice / 100).toLocaleString("en-IN")}</td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className={i.expired ? "text-red-600 font-medium" : "text-slate-500"}>{i.expiryDate ?? "—"}{i.expired ? " (expired)" : ""}</span>
                            </td>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">#{i.lotNo}</td>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                              {SOURCE_LABELS[i.sourceType]}{i.sourceName ? ` · ${i.sourceName}` : ""}
                              {i.isCredit && <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">credit</span>}
                            </td>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{i.invoiceNo ?? "—"}</td>
                            <td className="px-5 py-4 whitespace-nowrap text-right">
                              {i.quantity > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const qtyStr = prompt(`How many ${i.unit || "units"} of "${i.productName}" were consumed? (Max: ${i.quantity})`);
                                    if (!qtyStr) return;
                                    const qty = Number(qtyStr);
                                    if (isNaN(qty) || qty <= 0 || qty > i.quantity) {
                                      alert("Please enter a valid quantity within available stock range.");
                                      return;
                                    }
                                    const notes = prompt("Enter a reason or note for this consumption (optional):") || undefined;
                                    handleConsume(i.id, qty, notes);
                                  }}
                                  className="text-[12px] font-bold text-accent-700 hover:text-accent-950 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  Consume
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </>
                )}
              </table>
            </div>
            <Pagination page={page} pageCount={pageCount} total={activeListLength} pageSize={PAGE_SIZE} onPage={setPage} />
          </div>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-lg bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Record purchase</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>
            <form onSubmit={submitPurchase} className="flex flex-col gap-4 px-6 py-6 pb-20">
              <div className="grid grid-cols-2 gap-3">
                <FloatingInput label="Lot no" value={lotNo} onChange={(e) => setLotNo(e.target.value)} required />
                <FloatingInput label="Purchase date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>

              <div>
                <label className="text-[13px] font-medium text-slate-500">Bought from</label>
                <div className="mt-1.5 flex gap-2">
                  {(["vendor", "client", "mechanic"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setSourceType(s)} className={`rounded-lg px-3 py-2 text-[13px] font-medium capitalize ${sourceType === s ? "bg-charcoal-900 text-white" : "bg-slate-100 text-slate-500"}`}>{s}</button>
                  ))}
                </div>
              </div>

              {sourceType === "vendor" ? (
                <div>
                  <label className="text-[12px] font-semibold text-slate-400">Select Vendor Supplier</label>
                  <select
                    value={vendorId}
                    onChange={(e) => setVendorId(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-charcoal-900"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {vendorsList.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <FloatingInput label="Source name" value={sourceName} onChange={(e) => setSourceName(e.target.value)} helperText="Client / mechanic name" />
              )}
              
              <FloatingInput label="Supplier invoice no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />

              <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600 select-none">
                <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} className="rounded" />
                Bought on credit
              </label>
              {isCredit && (
                <div className="grid grid-cols-2 gap-3 animate-slideUp">
                  <FloatingInput label="Total amount (₹)" type="number" value={totalAmount || ""} onChange={(e) => setTotalAmount(Number(e.target.value))} />
                  <FloatingInput label="Amount paid (₹)" type="number" value={amountPaid || ""} onChange={(e) => setAmountPaid(Number(e.target.value))} />
                </div>
              )}

              <div className="border-t border-slate-100 pt-4">
                <p className="text-[13px] font-bold text-charcoal-900 mb-2">Products / Parts List</p>
                <div className="space-y-3">
                  {lotItems.map((it) => (
                    <div key={it.key} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3 relative">
                      <div>
                        <input
                          placeholder="Product / Part name"
                          value={it.productName}
                          onChange={(e) => setItem(it.key, { productName: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-charcoal-900 bg-white"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-slate-400 px-1">Qty</span>
                          <input type="number" placeholder="Qty" value={it.quantity || ""} onChange={(e) => setItem(it.key, { quantity: Number(e.target.value) })} className="rounded-lg border border-slate-200 px-2 py-2 text-[13px] bg-white focus:border-charcoal-900" required />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-slate-400 px-1">Unit</span>
                          <input placeholder="Unit" value={it.unit} onChange={(e) => setItem(it.key, { unit: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-[13px] bg-white focus:border-charcoal-900" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-slate-400 px-1">Cost (₹)</span>
                          <input type="number" placeholder="Cost ₹" value={it.purchasePrice || ""} onChange={(e) => setItem(it.key, { purchasePrice: Number(e.target.value) })} className="rounded-lg border border-slate-200 px-2 py-2 text-[13px] bg-white focus:border-charcoal-900" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-slate-400 px-1">Sale (₹)</span>
                          <input type="number" placeholder="Sale ₹" value={it.salePrice || ""} onChange={(e) => setItem(it.key, { salePrice: Number(e.target.value) })} className="rounded-lg border border-slate-200 px-2 py-2 text-[13px] bg-white focus:border-charcoal-900" required />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="flex flex-col relative">
                          <span className="text-[10px] font-medium text-slate-400 px-1">Customer Vehicle Link</span>
                          <div className="relative">
                            <input
                              placeholder="Search Plate Number..."
                              value={vehicleSearchText[it.key] !== undefined ? vehicleSearchText[it.key] : it.vehiclePlate}
                              onChange={(e) => onVehicleSearch(it.key, e.target.value)}
                              className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-[13px] bg-white focus:border-charcoal-900"
                            />
                            <Search size={13} className="absolute left-2.5 top-3 text-slate-400" />
                          </div>

                          {/* Suggestions drop */}
                          {vehicleSuggestions[it.key] && vehicleSuggestions[it.key].length > 0 && (
                            <div className="absolute left-0 right-0 top-12 z-20 max-h-36 overflow-y-auto rounded-lg border border-slate-100 bg-white shadow-elevated">
                              {vehicleSuggestions[it.key].map((vs) => (
                                <button
                                  key={vs.id}
                                  type="button"
                                  onClick={() => selectVehicle(it.key, vs)}
                                  className="w-full px-3 py-2 text-left text-[12.5px] hover:bg-slate-50 text-charcoal-900 border-b border-slate-50 last:border-b-0"
                                >
                                  <span className="font-bold">{vs.plateNumber}</span>
                                  <span className="ml-1.5 text-slate-400">({vs.clientName})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] font-medium text-slate-400 px-1">Expiry Date</span>
                          <input type="date" value={it.expiryDate} onChange={(e) => setItem(it.key, { expiryDate: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-2 text-[13px] bg-white focus:border-charcoal-900" />
                        </div>
                      </div>

                      {lotItems.length > 1 && (
                        <button type="button" onClick={() => setLotItems((rows) => rows.filter((r) => r.key !== it.key))} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors p-1"><Trash2 size={15} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setLotItems((rows) => [...rows, EMPTY_ITEM()])} className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-accent-700 hover:text-accent-950"><Plus size={14} /> Add product</button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600"><AlertCircle size={15} /> <span>{error}</span></div>
              )}
              <button type="submit" disabled={saving} className="mt-4 w-full rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50 shadow-md">
                {saving ? "Saving..." : "Record purchase"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
