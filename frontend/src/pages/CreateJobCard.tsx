import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Trash2, AlertCircle, CheckCircle2, Target } from "lucide-react";
import {
  api,
  Branch,
  VehicleMake,
  VehicleModel,
  Service,
  StaffListItem,
  ClientRecord,
  JobCardLineItemInput,
  Client360,
  Product,
} from "../api";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import FloatingInput from "../components/FloatingInput";
import MultiFileInput from "../components/MultiFileInput";
import { uid } from "../utils/id";

function rupees(paise?: number) {
  if (paise === undefined) return "₹0";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface LineItemRow extends JobCardLineItemInput {
  key: string;
}

export default function CreateJobCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const conversionData = location.state as {
    enquiryId?: string;
    contactNumber?: string;
    clientName?: string;
    email?: string;
    address?: string;
    vehicleNumber?: string;
    makeId?: string;
    modelId?: string;
    segment?: string;
    year?: number;
    color?: string;
    fuelType?: string;
    enquiryFor?: string;
  } | null;

  const [orgName, setOrgName] = useState("Workspace");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [branchId, setBranchId] = useState("");
  const [jobDate, setJobDate] = useState(new Date().toISOString().slice(0, 10));

  const [phone, setPhone] = useState(conversionData?.contactNumber || "");
  const [phoneMatches, setPhoneMatches] = useState<ClientRecord[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [clientName, setClientName] = useState(conversionData?.clientName || "");
  const [address, setAddress] = useState(conversionData?.address || "");
  const [gender, setGender] = useState<"male" | "female" | "other" | "unknown">("unknown");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [sourceOfClient, setSourceOfClient] = useState("");

  const [plateNumber, setPlateNumber] = useState(conversionData?.vehicleNumber || "");
  const [makeId, setMakeId] = useState(conversionData?.makeId || "");
  const [modelId, setModelId] = useState(conversionData?.modelId || "");
  const [segment, setSegment] = useState(conversionData?.segment || "");
  const [year, setYear] = useState(conversionData?.year ? String(conversionData.year) : "");
  const [color, setColor] = useState(conversionData?.color || "");
  const [fuelType, setFuelType] = useState<"petrol" | "diesel" | "cng" | "electric" | "hybrid" | "">((conversionData?.fuelType as any) || "");
  const [odometer, setOdometer] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [lineItems, setLineItems] = useState<LineItemRow[]>([{ key: uid(), serviceId: "", qty: 1, price: 0 }]);
  const [productItems, setProductItems] = useState<{ key: string; productName: string; qty: number; price: number; productId?: string }[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [serviceAdvisorId, setServiceAdvisorId] = useState("");

  const [loadingReference, setLoadingReference] = useState(true);
  const [client360, setClient360] = useState<Client360 | null>(null);
  const [appliedOfferId, setAppliedOfferId] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.me().catch(() => null),
      api.listBranches().catch(() => []),
      api.listVehicleMakes().catch(() => []),
      api.listVehicleModels().catch(() => []),
      api.listServices().catch(() => []),
      api.listStaff().catch(() => []),
      api.listProducts().catch(() => []),
    ]).then(([me, branchRows, makeRows, modelRows, serviceRows, staffRows, productRows]) => {
      if (cancelled) return;
      if (me) setOrgName(me.org.name);
      setBranches(branchRows);
      if (branchRows.length > 0) setBranchId(branchRows[0].id);
      setMakes(makeRows);
      setModels(modelRows);
      setServices(serviceRows);
      setStaff(staffRows);
      setProductsList(productRows);
      setLoadingReference(false);

      if (conversionData?.enquiryFor) {
        const query = conversionData.enquiryFor.toLowerCase().trim();
        const matched = serviceRows.find(
          (s) => s.name.toLowerCase().trim() === query
        );
        if (matched) {
          setLineItems([{ key: uid(), serviceId: matched.id, qty: 1, price: matched.defaultPrice / 100 }]);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  // debounced phone search
  useEffect(() => {
    if (phone.length < 3) {
      setPhoneMatches([]);
      return;
    }
    const t = setTimeout(() => {
      api.searchClients(phone).then(setPhoneMatches).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [phone]);

  function selectClient(c: ClientRecord) {
    setSelectedClient(c);
    setPhone(c.phone);
    setClientName(c.name);
    setAddress(c.address ?? "");
    setGender(c.gender);
    setDateOfBirth(c.dateOfBirth ?? "");
    setAnniversary(c.anniversary ?? "");
    setSourceOfClient(c.sourceOfClient ?? "");
    setPhoneMatches([]);
    setAppliedOfferId("");
    api.getClient360(c.id).then(setClient360).catch(() => {});
  }

  function onPhoneChange(value: string) {
    setPhone(value);
    setSelectedClient(null);
    setClient360(null);
    setAppliedOfferId("");
  }

  const modelsForMake = models.filter((m) => m.makeId === makeId);

  function onModelChange(id: string) {
    setModelId(id);
    const model = models.find((m) => m.id === id);
    if (model) setSegment(model.segment);
  }

  function addLineItem() {
    setLineItems((rows) => [...rows, { key: uid(), serviceId: "", qty: 1, price: 0 }]);
  }

  function removeLineItem(key: string) {
    setLineItems((rows) => rows.filter((r) => r.key !== key));
  }

  function updateLineItem(key: string, patch: Partial<LineItemRow>) {
    setLineItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onServiceSelect(key: string, serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    updateLineItem(key, { serviceId, price: svc ? svc.defaultPrice / 100 : 0 });
  }

  function addProductItem() {
    setProductItems((rows) => [...rows, { key: uid(), productName: "", qty: 1, price: 0 }]);
  }

  function removeProductItem(key: string) {
    setProductItems((rows) => rows.filter((r) => r.key !== key));
  }

  function updateProductItem(key: string, patch: Partial<{ productName: string; qty: number; price: number; productId?: string }>) {
    setProductItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onProductSelect(key: string, productId: string) {
    const prod = productsList.find((p) => p.id === productId);
    updateProductItem(key, { productId, productName: prod ? prod.name : "", price: prod ? prod.mrp / 100 : 0 });
  }

  const servicesSubtotal = lineItems.reduce((sum, li) => sum + li.qty * li.price, 0);
  const productsSubtotal = productItems.reduce((sum, pi) => sum + pi.qty * pi.price, 0);
  const subtotal = servicesSubtotal + productsSubtotal;
  const afterDiscount = Math.max(subtotal - discount, 0);
  const total = afterDiscount * (1 + taxPercent / 100);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validLineItems = lineItems.filter((li) => li.serviceId && li.qty > 0);
    const validProductItems = productItems.filter((pi) => pi.productName.trim() && pi.qty > 0);
    if (validLineItems.length === 0 && validProductItems.length === 0) {
      setError("add at least one service or product item");
      return;
    }

    setSaving(true);
    try {
      const result = await api.createJobCard({
        branchId,
        jobDate,
        serviceAdvisorId: serviceAdvisorId || undefined,
        client: {
          phone,
          name: clientName,
          address: address || undefined,
          gender,
          dateOfBirth: dateOfBirth || undefined,
          anniversary: anniversary || undefined,
          sourceOfClient: sourceOfClient || undefined,
        },
        vehicle: {
          plateNumber,
          makeId: makeId || undefined,
          modelId: modelId || undefined,
          segment: segment || undefined,
          year: year ? Number(year) : undefined,
          color: color || undefined,
          fuelType: fuelType || undefined,
          odometerReading: odometer ? Number(odometer) : undefined,
          nextServiceDate: nextServiceDate || undefined,
        },
        lineItems: validLineItems.map(({ serviceId, qty, price }) => ({ serviceId, qty, price: Math.round(price * 100) })),
        productItems: validProductItems.map(({ productId, productName, qty, price }) => ({
          productId: productId || undefined,
          productName,
          qty,
          price: Math.round(price * 100),
        })),
        discount: Math.round(discount * 100),
        taxPercent,
        images,
        appliedOfferId: appliedOfferId || undefined,
      });
      if (conversionData?.enquiryId) {
        await api.updateEnquiry(conversionData.enquiryId, { leadStatus: "converted" }).catch(() => {});
      }
      navigate(`/job-cards/${result.jobCard.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create job card");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="animate-slideUp">
            <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Create Job Card</h1>
            <p className="mt-1 text-[14px] text-slate-400">Capture client, vehicle, and service details for this visit.</p>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {loadingReference ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl2" />
              ))}
            </div>
          ) : (
          <>
          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600">
              <CheckCircle2 size={15} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={submit} className="mt-6 max-w-3xl space-y-6">
              {/* Basics */}
              <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Date *</label>
                  <input type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Branch *</label>
                  <Dropdown
                    value={branchId}
                    onChange={setBranchId}
                    placeholder="Select branch"
                    className="mt-1.5 w-full"
                    options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  />
                </div>
              </div>

              {/* Client */}
              <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Client details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <FloatingInput label="Client contact *" value={phone} onChange={(e) => onPhoneChange(e.target.value)} required />
                    {phoneMatches.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-elevated overflow-hidden">
                        {phoneMatches.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectClient(c)}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] hover:bg-slate-50"
                          >
                            <span className="font-medium text-charcoal-900">{c.name}</span>
                            <span className="text-slate-400">{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <FloatingInput label="Client name *" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
                  <FloatingInput label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  <div>
                    <label className="text-[13px] font-medium text-slate-500">Gender</label>
                    <div className="mt-1.5 flex gap-2">
                      {(["male", "female"] as const).map((g) => (
                        <button key={g} type="button" onClick={() => setGender(g)} className={`rounded-lg px-4 py-2 text-[13px] font-medium capitalize ${gender === g ? "bg-charcoal-900 text-white" : "bg-slate-100 text-slate-500"}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FloatingInput label="Date of birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  <FloatingInput label="Anniversary" type="date" value={anniversary} onChange={(e) => setAnniversary(e.target.value)} />
                  <FloatingInput label="Source of client" value={sourceOfClient} onChange={(e) => setSourceOfClient(e.target.value)} helperText="walkin, referral, whatsapp, google..." />
                </div>

                {client360 && (
                  <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/[0.02] p-4.5 animate-slideUp">
                    <div className="flex items-center gap-2 text-rose-700 font-semibold text-[13.5px]">
                      <Target size={15} />
                      <span>Client 360 Insights</span>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12px] border-b border-rose-100/30 pb-3.5">
                      <div>
                        <p className="text-slate-400 font-medium">Total Visits</p>
                        <p className="mt-0.5 font-bold text-charcoal-900">{client360.totalVisits} visits</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium">Total spendings</p>
                        <p className="mt-0.5 font-bold text-charcoal-900">
                          {rupees(client360.totalSpendings)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium">Last visit</p>
                        <p className="mt-0.5 font-bold text-charcoal-900">
                          {client360.lastVisitOn ? new Date(client360.lastVisitOn).toLocaleDateString("en-IN") : "Never"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-medium">Wallet balance</p>
                        <p className="mt-0.5 font-bold text-charcoal-900">
                          {rupees(client360.walletBalance)}
                        </p>
                      </div>
                    </div>

                    {client360.offers && client360.offers.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[12px] font-semibold text-rose-800">Targeted Offers & Upgrades:</p>
                        <div className="mt-2.5 space-y-2">
                          {client360.offers.map((off) => {
                            const isApplied = appliedOfferId === off.id;
                            return (
                              <div
                                key={off.id}
                                className={`flex items-start justify-between rounded-lg p-3 border text-[12px] shadow-sm transition-all duration-150 ${
                                  isApplied
                                    ? "bg-rose-50 border-rose-200"
                                    : "bg-white border-slate-100 hover:border-rose-100"
                                }`}
                              >
                                <div>
                                  <p className="font-bold text-charcoal-900 flex items-center gap-1.5">
                                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-600 font-mono border border-sky-100">
                                      {off.code}
                                    </span>
                                    {off.title}
                                  </p>
                                  <p className="mt-0.5 text-slate-500">{off.description}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isApplied) {
                                      setAppliedOfferId("");
                                      setDiscount(0);
                                      setSuccess("Offer unapplied.");
                                      setTimeout(() => setSuccess(""), 2000);
                                    } else {
                                      setAppliedOfferId(off.id);
                                      if (off.discountType === "flat") {
                                        setDiscount(off.value / 100);
                                        setSuccess(`Applied flat ${rupees(off.value)} discount!`);
                                        setTimeout(() => setSuccess(""), 3000);
                                      } else {
                                        setSuccess(`Upgraded bundle/offer pitched: ${off.title}!`);
                                        setTimeout(() => setSuccess(""), 3000);
                                      }
                                    }
                                  }}
                                  className={`shrink-0 font-semibold px-2.5 py-1 rounded text-[11px] border transition-all duration-150 ${
                                    isApplied
                                      ? "bg-charcoal-900 border-charcoal-900 text-white hover:bg-charcoal-800"
                                      : "bg-white border-slate-200 text-charcoal-700 hover:border-charcoal-900"
                                  }`}
                                >
                                  {isApplied ? "Unapply" : "Apply Offer"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Vehicle */}
              <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4">Vehicle details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FloatingInput label="Vehicle number *" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value.toUpperCase())} required helperText="XXXX-XX-XXXX" />
                  <div>
                    <label className="text-[13px] font-medium text-slate-500">Vehicle Make *</label>
                    <Dropdown
                      value={makeId}
                      onChange={(v) => { setMakeId(v); setModelId(""); setSegment(""); }}
                      placeholder="Select make"
                      className="mt-1.5 w-full"
                      options={makes.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  </div>
                  <div>
                    <label className="text-[13px] font-medium text-slate-500">Vehicle Model *</label>
                    <Dropdown
                      value={modelId}
                      onChange={onModelChange}
                      disabled={!makeId}
                      placeholder="Select model"
                      className="mt-1.5 w-full"
                      options={modelsForMake.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  </div>
                  <FloatingInput label="Segment *" value={segment} onChange={(e) => setSegment(e.target.value)} required />
                  <FloatingInput label="Year" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                  <FloatingInput label="Color" value={color} onChange={(e) => setColor(e.target.value)} />
                  <div>
                    <label className="text-[13px] font-medium text-slate-500">Fuel type</label>
                    <Dropdown
                      value={fuelType}
                      onChange={(v) => setFuelType(v as typeof fuelType)}
                      placeholder="Select fuel type"
                      className="mt-1.5 w-full"
                      capitalize
                      options={["petrol", "diesel", "cng", "electric", "hybrid"].map((f) => ({ value: f, label: f }))}
                    />
                  </div>
                  <FloatingInput label="Odometer Reading" type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
                  <FloatingInput label="Next service date" type="date" value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} />
                </div>
                <div className="mt-4">
                  <MultiFileInput urls={images} onChange={setImages} />
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
                <h3 className="text-[15px] font-semibold text-charcoal-900 mb-4 font-bold">Services</h3>
                <div className="space-y-2">
                  {lineItems.map((li) => (
                    <div key={li.key} className="flex items-center gap-2 animate-fadeIn">
                      <Dropdown
                        value={li.serviceId}
                        onChange={(v) => onServiceSelect(li.key, v)}
                        placeholder="Select service..."
                        className="flex-1"
                        size="sm"
                        options={services.map((s) => ({ value: s.id, label: s.name }))}
                      />
                      <input
                        type="number"
                        min={1}
                        value={li.qty}
                        onChange={(e) => updateLineItem(li.key, { qty: Number(e.target.value) })}
                        className="w-20 rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:border-accent-500 focus:outline-none"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={li.price}
                        onChange={(e) => updateLineItem(li.key, { price: Number(e.target.value) })}
                        className="w-28 rounded-lg border border-slate-200 px-3 py-2.5 text-[13.5px] focus:border-accent-500 focus:outline-none"
                      />
                      <button type="button" onClick={() => removeLineItem(li.key)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addLineItem} className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-accent-600 hover:text-accent-500">
                  <Plus size={14} /> Add service
                </button>

                <h3 className="text-[15px] font-semibold text-charcoal-900 mt-6 mb-4 font-bold">Parts / Products</h3>
                <div className="space-y-2">
                  {productItems.map((pi) => (
                    <div key={pi.key} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-slate-50/50 rounded-xl animate-fadeIn">
                      <select
                        value={pi.productId || ""}
                        onChange={(e) => onProductSelect(pi.key, e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] outline-none"
                      >
                        <option value="">-- Choose Catalogue Part --</option>
                        {productsList.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        placeholder="Or custom part name"
                        value={pi.productName}
                        onChange={(e) => updateProductItem(pi.key, { productName: e.target.value })}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]"
                        required
                      />
                      <div className="flex gap-2 shrink-0">
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={pi.qty || ""}
                          onChange={(e) => updateProductItem(pi.key, { qty: Number(e.target.value) })}
                          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[13px] text-center"
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={pi.price || ""}
                          onChange={(e) => updateProductItem(pi.key, { price: Number(e.target.value) })}
                          className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[13px] text-center"
                        />
                        <button type="button" onClick={() => removeProductItem(pi.key)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {productItems.length === 0 && (
                    <p className="text-[12.5px] text-slate-400 px-1 py-1">No parts/products added.</p>
                  )}
                </div>
                <button type="button" onClick={addProductItem} className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-accent-600 hover:text-accent-500">
                  <Plus size={14} /> Add product / part
                </button>

                <div className="mt-6 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-5">
                  <div>
                    <label className="text-[12px] font-medium text-slate-400">Discount (₹)</label>
                    <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="mt-1 block w-32 rounded-lg border border-slate-200 px-3 py-2 text-[13px]" />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-slate-400">Tax</label>
                    <Dropdown
                      value={String(taxPercent)}
                      onChange={(v) => setTaxPercent(Number(v))}
                      className="mt-1 w-40"
                      size="sm"
                      options={[
                        { value: "0", label: "No Tax" },
                        { value: "18", label: "18%" },
                      ]}
                    />
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[12px] font-medium text-slate-400">Subtotal</p>
                    <p className="text-[18px] font-semibold text-charcoal-900">₹{subtotal.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] font-medium text-slate-400">Total</p>
                    <p className="text-[20px] font-semibold text-charcoal-900">₹{total.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="text-[13px] font-medium text-slate-500">Service Advisor</label>
                  <Dropdown
                    value={serviceAdvisorId}
                    onChange={setServiceAdvisorId}
                    placeholder="Select advisor"
                    className="mt-1.5 w-full"
                    options={staff.map((s) => ({ value: s.userId, label: s.name }))}
                  />
                </div>
              </div>

              <button type="submit" disabled={saving} className="rounded-xl bg-charcoal-900 px-6 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Creating..." : "Create Job Card"}
              </button>
          </form>
          </>
          )}
        </div>
      </main>
    </div>
  );
}
