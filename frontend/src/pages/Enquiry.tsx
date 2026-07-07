import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Inbox, Target, CheckCircle2, XCircle, Phone, MessageCircle, FilePlus } from "lucide-react";
import { api, Enquiry as EnquiryT, EnquiryInput, LeadStatus, StaffListItem, Service, Product, VehicleMake, VehicleModel } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import FloatingInput from "../components/FloatingInput";

const ENQUIRY_TYPES = ["New", "Service", "Product", "Package", "Membership", "General"];
const SOURCES = ["Walk-in", "Phone", "WhatsApp", "Google", "Instagram", "Facebook", "Referral", "Other"];
const STATUS_OPTS: LeadStatus[] = ["pending", "contacted", "follow_up", "converted", "lost"];
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600",
  contacted: "bg-accent-500/10 text-accent-600",
  follow_up: "bg-slate-100 text-slate-500",
  converted: "bg-emerald-50 text-emerald-600",
  lost: "bg-red-50 text-red-600",
};

const EMPTY: EnquiryInput = {
  contactNumber: "", clientName: "", email: "", address: "", enquiryFor: "", enquiryType: "New",
  response: "", dateToFollow: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  sourceOfEnquiry: "Walk-in", leadStatus: "pending", channel: "sms",
  vehicleNumber: "", segment: "", color: "", fuelType: "",
};

export default function Enquiry() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [enquiries, setEnquiries] = useState<EnquiryT[] | null>(null);
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EnquiryInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const { branchParam } = useBranch();

  function load() {
    api.listEnquiries(branchParam ? { branchId: branchParam } : undefined).then(setEnquiries).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    api.listStaff().then(setStaff).catch(() => {});
    Promise.all([api.listServices().catch(() => [] as Service[]), api.listProducts().catch(() => [] as Product[])]).then(
      ([s, p]) => setCatalog([...s.map((x) => x.name), ...p.map((x) => x.name)])
    );
    api.listVehicleMakes().then(setMakes).catch(() => {});
    api.listVehicleModels().then(setModels).catch(() => {});
  }, []);

  useEffect(() => {
    setEnquiries(null);
    load();
  }, [branchParam]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function set(field: keyof EnquiryInput, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createEnquiry({ ...form, branchId: branchParam });
      setShowForm(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save enquiry");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(id: string, status: LeadStatus) {
    setEnquiries((prev) => prev?.map((e) => (e.id === id ? { ...e, leadStatus: status } : e)) ?? prev);
    try {
      await api.updateEnquiry(id, { leadStatus: status });
    } catch {
      load();
    }
  }

  const filtered = useMemo(() => {
    if (!enquiries) return [];
    const q = search.trim().toLowerCase();
    return enquiries.filter((e) => {
      const ms = !q || e.clientName.toLowerCase().includes(q) || e.contactNumber.includes(q) || e.enquiryFor.toLowerCase().includes(q);
      const mst = statusFilter === "all" || e.leadStatus === statusFilter;
      const mt = typeFilter === "all" || e.enquiryType === typeFilter;
      return ms && mst && mt;
    });
  }, [enquiries, search, statusFilter, typeFilter]);

  const openCount = enquiries?.filter((e) => e.leadStatus === "pending" || e.leadStatus === "contacted" || e.leadStatus === "follow_up").length ?? 0;
  const convertedCount = enquiries?.filter((e) => e.leadStatus === "converted").length ?? 0;
  const lostCount = enquiries?.filter((e) => e.leadStatus === "lost").length ?? 0;

  const modelsForMake = models.filter((m) => m.makeId === form.makeId);

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex items-center justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Enquiry</h1>
              <p className="mt-1 text-[14px] text-slate-400">Capture and follow up every lead until it converts.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800">
              <Plus size={15} /> Add enquiry
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard label="Total enquiries" value={enquiries?.length ?? 0} icon={Inbox} loading={!enquiries} />
            <StatCard label="Open leads" value={openCount} icon={Target} loading={!enquiries} />
            <StatCard label="Converted" value={convertedCount} icon={CheckCircle2} loading={!enquiries} />
            <StatCard label="Lost" value={lostCount} icon={XCircle} loading={!enquiries} />
          </div>

          <div className="mt-6">
            <TableToolbar
              search={search}
              onSearch={setSearch}
              placeholder="Search client, phone, enquiry for..."
              onDownload={() => {}}
              filters={
                <div className="flex gap-2">
                  <Dropdown
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="w-40"
                    size="sm"
                    capitalize
                    options={[{ value: "all", label: "All status" }, ...STATUS_OPTS.map((s) => ({ value: s, label: s.replace("_", " ") }))]}
                  />
                  <Dropdown
                    value={typeFilter}
                    onChange={setTypeFilter}
                    className="w-40"
                    size="sm"
                    options={[{ value: "all", label: "All types" }, ...ENQUIRY_TYPES.map((t) => ({ value: t, label: t }))]}
                  />
                </div>
              }
            />
          </div>

          {error && !showForm && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600"><AlertCircle size={15} /> <span>{error}</span></div>
          )}

          <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                    <th className="px-5 py-3.5">Lead</th>
                    <th className="px-5 py-3.5">Enquiry for</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5">Follow up</th>
                    <th className="px-5 py-3.5">Source</th>
                    <th className="px-5 py-3.5">Rep</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Reach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!enquiries ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-16" /></td>)}</tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-5 py-16 text-center"><Inbox size={28} strokeWidth={1.5} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-medium text-charcoal-900">No enquiries yet</p></td></tr>
                  ) : (
                    filtered.map((e) => (
                      <tr key={e.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="font-medium">{e.clientName}</p>
                          <p className="text-[12px] text-slate-400">{e.contactNumber}{e.vehicleNumber ? ` · ${e.vehicleNumber}` : ""}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{e.enquiryFor}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{e.enquiryType}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{e.dateToFollow}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{e.sourceOfEnquiry}</td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{e.leadRepName ?? "—"}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Dropdown
                            value={e.leadStatus}
                            onChange={(v) => changeStatus(e.id, v as LeadStatus)}
                            bare
                            capitalize
                            triggerClassName={`rounded-full px-2.5 py-1 text-[11px] font-medium cursor-pointer ${STATUS_STYLES[e.leadStatus]}`}
                            options={STATUS_OPTS.map((s) => ({ value: s, label: s.replace("_", " ") }))}
                          />
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {e.leadStatus !== "converted" && e.leadStatus !== "lost" && (
                              <button
                                onClick={() => {
                                  navigate("/job-cards/new", {
                                    state: {
                                      enquiryId: e.id,
                                      contactNumber: e.contactNumber,
                                      clientName: e.clientName,
                                      email: e.email,
                                      address: e.address,
                                      vehicleNumber: e.vehicleNumber,
                                      makeId: e.makeId,
                                      modelId: e.modelId,
                                      segment: e.segment,
                                      year: e.year,
                                      color: e.color,
                                      fuelType: e.fuelType,
                                      enquiryFor: e.enquiryFor,
                                    }
                                  });
                                }}
                                title="Convert to Job Card"
                                className="inline-flex items-center justify-center rounded-lg p-1.5 text-accent-600 hover:bg-accent-50/60"
                              >
                                <FilePlus size={14} />
                              </button>
                            )}
                            <a href={`tel:${e.contactNumber}`} title="Call" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900"><Phone size={14} /></a>
                            <a href={`https://wa.me/91${e.contactNumber}`} target="_blank" rel="noreferrer" title="WhatsApp" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><MessageCircle size={14} /></a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Add enquiry</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput label="Contact number" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} required autoFocus />
              <FloatingInput label="Client name" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} required />
              <FloatingInput label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <FloatingInput label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />

              <div>
                <label className="text-[13px] font-medium text-slate-500">Enquiry for *</label>
                <input list="catalog-list" value={form.enquiryFor} onChange={(e) => set("enquiryFor", e.target.value)} required placeholder="Service / product / package" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none" />
                <datalist id="catalog-list">{catalog.map((c) => <option key={c} value={c} />)}</datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Enquiry type *</label>
                  <Dropdown
                    value={form.enquiryType}
                    onChange={(v) => set("enquiryType", v)}
                    className="mt-1.5 w-full"
                    options={ENQUIRY_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Source *</label>
                  <Dropdown
                    value={form.sourceOfEnquiry}
                    onChange={(v) => set("sourceOfEnquiry", v)}
                    className="mt-1.5 w-full"
                    options={SOURCES.map((s) => ({ value: s, label: s }))}
                  />
                </div>
              </div>

              <FloatingInput label="Response" value={form.response} onChange={(e) => set("response", e.target.value)} />
              <FloatingInput label="Date to follow" type="date" value={form.dateToFollow} onChange={(e) => set("dateToFollow", e.target.value)} required />

              <div>
                <label className="text-[13px] font-medium text-slate-500">Lead representative</label>
                <Dropdown
                  value={form.leadRepresentativeId ?? ""}
                  onChange={(v) => set("leadRepresentativeId", v)}
                  className="mt-1.5 w-full"
                  options={[{ value: "", label: "Me (default)" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Lead status</label>
                  <Dropdown
                    value={form.leadStatus}
                    onChange={(v) => set("leadStatus", v)}
                    className="mt-1.5 w-full"
                    capitalize
                    options={STATUS_OPTS.map((s) => ({ value: s, label: s.replace("_", " ") }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Send as</label>
                  <div className="mt-1.5 flex gap-2">
                    {(["sms", "whatsapp"] as const).map((c) => (
                      <button key={c} type="button" onClick={() => set("channel", c)} className={`flex-1 rounded-lg px-2 py-2.5 text-[12px] font-medium uppercase ${form.channel === c ? "bg-charcoal-900 text-white" : "bg-slate-100 text-slate-500"}`}>{c}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-[13px] font-medium text-slate-500 mb-3">Vehicle details</p>
                <div className="flex flex-col gap-3">
                  <FloatingInput label="Vehicle number" value={form.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value.toUpperCase())} />
                  <div className="grid grid-cols-2 gap-3">
                    <Dropdown
                      value={form.makeId ?? ""}
                      onChange={(v) => { set("makeId", v); set("modelId", ""); }}
                      placeholder="Make"
                      options={makes.map((m) => ({ value: m.id, label: m.name }))}
                    />
                    <Dropdown
                      value={form.modelId ?? ""}
                      onChange={(v) => { set("modelId", v); const m = models.find((x) => x.id === v); if (m) set("segment", m.segment); }}
                      disabled={!form.makeId}
                      placeholder="Model"
                      options={modelsForMake.map((m) => ({ value: m.id, label: m.name }))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FloatingInput label="Segment" value={form.segment} onChange={(e) => set("segment", e.target.value)} />
                    <FloatingInput label="Year" type="number" value={form.year ?? ""} onChange={(e) => set("year", Number(e.target.value))} />
                    <FloatingInput label="Color" value={form.color} onChange={(e) => set("color", e.target.value)} />
                  </div>
                </div>
              </div>

              {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600"><AlertCircle size={15} /> <span>{error}</span></div>}
              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Saving..." : "Save enquiry"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
