import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  SlidersHorizontal,
  Save,
  Clock,
  Building2,
  Facebook,
  Instagram,
  Youtube,
  MapPin,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { api, Branch, WorkingDay } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import FloatingInput from "../components/FloatingInput";
import FileInput from "../components/FileInput";
import Dropdown from "../components/Dropdown";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABEL: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
const MIN_TIME = "09:00";
const MAX_TIME = "23:55";

function defaultDay(day: string): WorkingDay {
  return { day, open: "09:00", close: "19:00", closed: day === "sunday" };
}
function defaultWorkingDays(): WorkingDay[] {
  return DAYS.map(defaultDay);
}

function to12(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

// Human summary stored back into branch.workingHours so other screens keep showing hours.
function summarize(days: WorkingDay[]): string {
  const open = days.filter((d) => !d.closed);
  if (open.length === 0) return "Closed all week";
  const abbr = (d: string) => DAY_LABEL[d].slice(0, 3);
  const uniform = open.every((d) => d.open === open[0].open && d.close === open[0].close);
  if (uniform) return `${open.map((d) => abbr(d.day)).join(", ")} ${to12(open[0].open)}–${to12(open[0].close)}`;
  return open.map((d) => `${abbr(d.day)} ${to12(d.open)}–${to12(d.close)}`).join("; ");
}

interface FormState {
  name: string;
  salonName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  googleMapsUrl: string;
  logoUrl: string;
  loginBgUrl: string;
  openingTime: string;
  closingTime: string;
  dayEndReportTime: string;
  extraHoursEnabled: boolean;
}

function hydrate(b: Branch): { f: FormState; days: WorkingDay[] } {
  return {
    f: {
      name: b.name ?? "",
      salonName: b.salonName ?? "",
      address: b.address ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      website: b.website ?? "",
      facebookUrl: b.facebookUrl ?? "",
      instagramUrl: b.instagramUrl ?? "",
      youtubeUrl: b.youtubeUrl ?? "",
      googleMapsUrl: b.googleMapsUrl ?? "",
      logoUrl: b.logoUrl ?? "",
      loginBgUrl: b.loginBgUrl ?? "",
      openingTime: b.openingTime ?? "09:00",
      closingTime: b.closingTime ?? "23:55",
      dayEndReportTime: b.dayEndReportTime ?? "20:00",
      extraHoursEnabled: b.extraHoursEnabled ?? false,
    },
    days: b.workingDays && b.workingDays.length ? DAYS.map((d) => b.workingDays!.find((x) => x.day === d) ?? defaultDay(d)) : defaultWorkingDays(),
  };
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-accent-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: typeof Clock; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border border-slate-100 bg-white p-6 shadow-card">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-charcoal-900">{title}</h3>
          {desc && <p className="text-[12px] text-slate-400">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SoftwareSettings() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [isOwner, setIsOwner] = useState(false);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [f, setF] = useState<FormState | null>(null);
  const [days, setDays] = useState<WorkingDay[]>(defaultWorkingDays());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.me().then((me) => {
      setOrgName(me.org.name);
      setIsOwner(me.roles.includes("org_owner"));
    }).catch(() => {});
    api.listBranches().then((bs) => {
      setBranches(bs);
      if (bs.length) setSelectedId((cur) => cur || bs[0].id);
    }).catch((err) => setError(err.message));
  }, []);

  // Hydrate the form whenever the selected branch changes.
  useEffect(() => {
    if (!branches || !selectedId) return;
    const b = branches.find((x) => x.id === selectedId);
    if (b) {
      const { f: nf, days: nd } = hydrate(b);
      setF(nf);
      setDays(nd);
    }
  }, [selectedId, branches]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function upd<K extends keyof FormState>(key: K, value: FormState[K]) {
    setF((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  function updDay(i: number, patch: Partial<WorkingDay>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function save() {
    if (!f || !selectedId) return;
    setSaving(true);
    setError("");
    try {
      await api.updateBranch(selectedId, {
        name: f.name,
        salonName: f.salonName,
        address: f.address,
        phone: f.phone,
        email: f.email,
        website: f.website,
        facebookUrl: f.facebookUrl,
        instagramUrl: f.instagramUrl,
        youtubeUrl: f.youtubeUrl,
        googleMapsUrl: f.googleMapsUrl,
        logoUrl: f.logoUrl,
        loginBgUrl: f.loginBgUrl,
        openingTime: f.openingTime,
        closingTime: f.closingTime,
        dayEndReportTime: f.dayEndReportTime,
        extraHoursEnabled: f.extraHoursEnabled,
        workingDays: days,
        workingHours: summarize(days),
      });
      const fresh = await api.listBranches();
      setBranches(fresh);
      setNotice("Settings saved");
      setTimeout(() => setNotice(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 sm:px-12 py-10">
          {/* Header + sticky-ish action bar */}
          <div className="flex flex-wrap items-end justify-between gap-4 animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">System settings</h1>
              <p className="mt-1 text-[14px] text-slate-400">Business profile, branding, working hours and reporting — per branch.</p>
            </div>
            <div className="flex items-center gap-3">
              {branches && branches.length > 1 && (
                <Dropdown
                  value={selectedId}
                  onChange={setSelectedId}
                  className="w-56"
                  options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.city }))}
                />
              )}
              <button
                onClick={save}
                disabled={saving || !isOwner || !f}
                title={!isOwner ? "Only the org owner can change settings" : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

          {!isOwner && (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] text-amber-700">
              You can view these settings, but only the organisation owner can save changes.
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600">
              <CheckCircle2 size={15} /> <span>{notice}</span>
            </div>
          )}

          {!f ? (
            <div className="mt-8 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl2" />)}
            </div>
          ) : (
            <div className="mt-8 space-y-6 animate-slideUp">
              {/* Business profile */}
              <Section icon={Building2} title="Business profile" desc="Shown on invoices, reminders and the customer-facing pages.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FloatingInput label="Business name" value={f.name} onChange={(e) => upd("name", e.target.value)} />
                  <FloatingInput label="Salon / outlet name" value={f.salonName} onChange={(e) => upd("salonName", e.target.value)} />
                  <div className="sm:col-span-2">
                    <FloatingInput label="Address" value={f.address} onChange={(e) => upd("address", e.target.value)} />
                  </div>
                  <FloatingInput label="Phone" value={f.phone} onChange={(e) => upd("phone", e.target.value)} />
                  <FloatingInput label="Email" type="email" value={f.email} onChange={(e) => upd("email", e.target.value)} />
                  <FloatingInput label="Website" value={f.website} onChange={(e) => upd("website", e.target.value)} />
                  <FloatingInput label="Google Direction (map link)" value={f.googleMapsUrl} onChange={(e) => upd("googleMapsUrl", e.target.value)} />
                </div>

                <p className="mt-5 mb-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Social links</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <IconInput icon={Facebook} placeholder="Facebook link" value={f.facebookUrl} onChange={(v) => upd("facebookUrl", v)} />
                  <IconInput icon={Instagram} placeholder="Instagram link" value={f.instagramUrl} onChange={(v) => upd("instagramUrl", v)} />
                  <IconInput icon={Youtube} placeholder="YouTube link" value={f.youtubeUrl} onChange={(v) => upd("youtubeUrl", v)} />
                </div>
              </Section>

              {/* Branding */}
              <Section icon={ImageIcon} title="Branding" desc="Logo and login-screen background.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <FileInput label="Logo" onUploaded={(url) => upd("logoUrl", url)} />
                    <ImagePreview url={f.logoUrl} alt="Logo" tall={false} />
                  </div>
                  <div>
                    <FileInput label="Login page background" onUploaded={(url) => upd("loginBgUrl", url)} />
                    <ImagePreview url={f.loginBgUrl} alt="Login background" tall />
                  </div>
                </div>
              </Section>

              {/* Overall hours */}
              <Section icon={Clock} title="Working hours" desc="Overall opening and closing time for the business.">
                <div className="flex flex-wrap items-end gap-4">
                  <TimeField label="Opening time" value={f.openingTime} onChange={(v) => upd("openingTime", v)} />
                  <span className="pb-2.5 text-slate-300">—</span>
                  <TimeField label="Closing time" value={f.closingTime} onChange={(v) => upd("closingTime", v)} />
                </div>
                <p className="mt-3 text-[12px] text-slate-400">Opening and closing time should be between 09:00 AM and 11:55 PM.</p>
              </Section>

              {/* Working days & hours */}
              <Section icon={Clock} title="Working days & hours" desc="Set hours per day, or mark a day closed.">
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-2 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <span>Day</span>
                    <span>Opening</span>
                    <span>Closing</span>
                    <span className="text-right">Open</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {days.map((d, i) => (
                      <div key={d.day} className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-2 px-4 py-2.5">
                        <span className="text-[13.5px] font-medium text-charcoal-900">{DAY_LABEL[d.day]}</span>
                        {d.closed ? (
                          <span className="col-span-2 text-[12.5px] text-slate-400">Closed</span>
                        ) : (
                          <>
                            <input
                              type="time"
                              min={MIN_TIME}
                              max={MAX_TIME}
                              value={d.open}
                              onChange={(e) => updDay(i, { open: e.target.value })}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] focus:border-accent-500 focus:outline-none"
                            />
                            <input
                              type="time"
                              min={MIN_TIME}
                              max={MAX_TIME}
                              value={d.close}
                              onChange={(e) => updDay(i, { close: e.target.value })}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] focus:border-accent-500 focus:outline-none"
                            />
                          </>
                        )}
                        <div className="flex justify-end">
                          <Toggle on={!d.closed} onClick={() => updDay(i, { closed: !d.closed })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>

              {/* Extra hours + Day end report */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Section icon={Clock} title="Extra hours" desc="Allow work logged outside opening hours.">
                  <div className="flex items-center gap-3">
                    <Toggle on={f.extraHoursEnabled} onClick={() => upd("extraHoursEnabled", !f.extraHoursEnabled)} />
                    <span className="text-[13.5px] font-medium text-charcoal-900">{f.extraHoursEnabled ? "Yes" : "No"}</span>
                  </div>
                </Section>

                <Section icon={Clock} title="Day end report" desc="Daily summary report time.">
                  <TimeField label="Report time" value={f.dayEndReportTime} onChange={(v) => upd("dayEndReportTime", v)} />
                </Section>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={save}
                  disabled={saving || !isOwner}
                  className="inline-flex items-center gap-2 rounded-xl bg-charcoal-900 px-5 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50"
                >
                  <Save size={15} />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function IconInput({ icon: Icon, placeholder, value, onChange }: { icon: typeof Facebook; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-[13.5px] focus:border-accent-500 focus:outline-none"
      />
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-slate-400">{label}</label>
      <input
        type="time"
        min={MIN_TIME}
        max={MAX_TIME}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] focus:border-accent-500 focus:outline-none"
      />
    </div>
  );
}

function ImagePreview({ url, alt, tall }: { url: string; alt: string; tall: boolean }) {
  if (!url) return null;
  return (
    <div className={`mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 ${tall ? "h-28" : "h-20"}`}>
      <img src={url} alt={alt} className="h-full w-full object-contain" />
    </div>
  );
}
