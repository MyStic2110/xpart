import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Tag,
  TrendingUp,
  Percent,
  Sparkles,
} from "lucide-react";
import { api, Offer } from "../api";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import FloatingInput from "../components/FloatingInput";

function rupees(paise?: number) {
  if (paise === undefined) return "₹0";
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const TARGETS = [
  { value: "all", label: "All Customers" },
  { value: "new_client", label: "New Clients (≤ 1 visit)" },
  { value: "churn_risk", label: "Churn Risks (> 60 days inactive)" },
  { value: "loyal_client", label: "Loyal Clients (≥ 5 visits)" },
  { value: "detailing_upsell", label: "Detailing Upsell (no past polish/coating)" },
  { value: "birthday_special", label: "Birthday Special (Flat ₹200 on Birthday)" },
  { value: "anniversary_special", label: "Anniversary Special (Flat ₹200 on Anniversary)" },
];

export default function Offers() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"flat" | "percentage">("flat");
  const [value, setValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minBillingAmount, setMinBillingAmount] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [restrictedDays, setRestrictedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  function load() {
    api.listOffers().then(setOffers).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    load();
  }, []);

  function logout() {
    navigate("/login", { replace: true });
  }

  async function toggleStatus(offer: Offer) {
    const nextState = !offer.isActive;
    setOffers((prev) =>
      prev?.map((o) => (o.id === offer.id ? { ...o, isActive: nextState } : o)) ?? null
    );
    try {
      await api.updateOffer(offer.id, { isActive: nextState });
      setSuccess(`Campaign "${offer.code}" status updated.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      load();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.createOffer({
        code: code.toUpperCase().trim(),
        title,
        description,
        discountType,
        value: Number(value),
        maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        minBillingAmount: minBillingAmount ? Number(minBillingAmount) : undefined,
        targetType,
        restrictedDays: restrictedDays.length > 0 ? restrictedDays : undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      });
      setSuccess(`Campaign "${code.toUpperCase()}" created successfully.`);
      setShowForm(false);
      setCode("");
      setTitle("");
      setDescription("");
      setValue("");
      setMaxDiscount("");
      setMinBillingAmount("");
      setTargetType("all");
      setRestrictedDays([]);
      setStartTime("");
      setEndTime("");
      load();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not create offer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex items-center justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Offers & Campaigns</h1>
              <p className="mt-1 text-[14px] text-slate-400">Configure client promotions and track their usage and ROI.</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800"
            >
              <Plus size={15} /> Create Offer
            </button>
          </div>

          {success && (
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600 animate-slideUp">
              <CheckCircle2 size={15} /> <span>{success}</span>
            </div>
          )}

          {error && !showForm && (
            <div className="mt-6 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600 animate-slideUp">
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {!offers ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl2" />
              ))
            ) : offers.length === 0 ? (
              <div className="col-span-2 py-16 text-center rounded-xl2 border border-slate-100 bg-white shadow-card">
                <Tag size={32} strokeWidth={1.5} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-medium text-charcoal-900">No offers configured yet</p>
                <p className="mt-1 text-sm text-slate-400">Create campaigns to drive repeat customer walk-ins.</p>
              </div>
            ) : (
              offers.map((offer) => {
                const targetLabel = TARGETS.find((t) => t.value === offer.targetType)?.label ?? offer.targetType;
                return (
                  <div
                    key={offer.id}
                    className={`rounded-xl2 border bg-white p-6 shadow-card transition-all duration-200 ${
                      offer.isActive ? "border-slate-100" : "border-slate-100 opacity-65"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-600 font-mono border border-sky-100 tracking-wider">
                            {offer.code}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400 truncate max-w-44">
                            ({targetLabel})
                          </span>
                        </div>
                        <h3 className="mt-2.5 text-[15px] font-semibold text-charcoal-900">{offer.title}</h3>
                        <p className="mt-1 text-[13px] text-slate-400 leading-relaxed">{offer.description}</p>
                        {((offer.restrictedDays && offer.restrictedDays.length > 0) || (offer.startTime && offer.endTime)) && (
                          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {offer.restrictedDays && offer.restrictedDays.length > 0 && (
                              <span className="font-semibold text-slate-700">
                                Days: {offer.restrictedDays.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(d)]).join(", ")}
                              </span>
                            )}
                            {offer.startTime && offer.endTime && (
                              <span className="ml-1 border-l border-slate-200 pl-1.5">
                                Happy Hour: {offer.startTime} - {offer.endTime}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleStatus(offer)}
                        title={offer.isActive ? "Deactivate Campaign" : "Activate Campaign"}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          offer.isActive ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            offer.isActive ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-50 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Redemptions</p>
                        <p className="mt-1 text-[15px] font-bold text-charcoal-800">{offer.usageCount ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Discounts</p>
                        <p className="mt-1 text-[15px] font-bold text-red-500">{rupees(offer.totalDiscount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Revenue ROI</p>
                        <p className="mt-1 text-[15px] font-bold text-emerald-600 flex items-center justify-center gap-1">
                          <TrendingUp size={13} />
                          {rupees(offer.totalRevenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Create Campaign Offer</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
              <FloatingInput
                label="Coupon Code (e.g. MONSOON200)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                autoFocus
              />
              <FloatingInput label="Offer Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <FloatingInput
                label="Offer Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Discount Type</label>
                  <Dropdown
                    value={discountType}
                    onChange={(v) => {
                      setDiscountType(v as any);
                      setValue("");
                    }}
                    className="mt-1.5 w-full"
                    options={[
                      { value: "flat", label: "Flat Cash (₹)" },
                      { value: "percentage", label: "Percentage (%)" },
                    ]}
                  />
                </div>
                <div>
                  <FloatingInput
                    label={discountType === "flat" ? "Rupees (e.g. 150)" : "Percentage (e.g. 10)"}
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FloatingInput
                  label="Min Bill Amount (Rupees)"
                  type="number"
                  value={minBillingAmount}
                  onChange={(e) => setMinBillingAmount(e.target.value)}
                />
                <FloatingInput
                  label="Max Discount Cap (Rupees)"
                  type="number"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  disabled={discountType === "flat"}
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-slate-500">Target Audience Rules</label>
                <Dropdown
                  value={targetType}
                  onChange={setTargetType}
                  className="mt-1.5 w-full"
                  options={TARGETS.map((t) => ({ value: t.value, label: t.label }))}
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-slate-500">Happy Hour / Off-Peak Days</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, idx) => {
                    const isSelected = restrictedDays.includes(idx.toString());
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setRestrictedDays(prev => prev.filter(d => d !== idx.toString()));
                          } else {
                            setRestrictedDays(prev => [...prev, idx.toString()]);
                          }
                        }}
                        className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors border ${
                          isSelected
                            ? "bg-charcoal-900 text-white border-charcoal-900"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-slate-500">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-slate-500">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="mt-4 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Campaign"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
