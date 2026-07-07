import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, MessageCircle, Languages, X, AlertCircle, CheckCircle2, Plug, Settings2, Volume2, Play, Sparkles } from "lucide-react";
import { api, Connector } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import Dropdown from "../components/Dropdown";

const CATEGORY_LABELS: Record<string, string> = {
  telephony: "Telephony — Calling",
  messaging: "Messaging — WhatsApp",
  localization: "Localization — Translation",
  automation: "Automation — AI Voice Agents",
};

// Icon + tile colour per connector category.
const CATEGORY_ICON: Record<string, typeof Phone> = {
  telephony: Phone,
  messaging: MessageCircle,
  localization: Languages,
  automation: Sparkles,
};
const CATEGORY_TILE: Record<string, string> = {
  telephony: "bg-accent-500/10 text-accent-600",
  messaging: "bg-emerald-50 text-emerald-600",
  localization: "bg-violet-50 text-violet-600",
  automation: "bg-sky-50 text-sky-600",
};

export default function Connectors() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [connectors, setConnectors] = useState<Connector[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Connector | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [audio] = useState(() => new Audio("/shilpa-tamil-preview.mp3"));

  useEffect(() => {
    return () => {
      audio.pause();
    };
  }, [audio]);

  const togglePlay = () => {
    if (playingAudio) {
      audio.pause();
      setPlayingAudio(false);
    } else {
      audio.currentTime = 0;
      audio.play();
      setPlayingAudio(true);
      audio.onended = () => setPlayingAudio(false);
    }
  };

  function load() {
    api.listConnectors().then(setConnectors).catch((err) => setError(err.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    load();
  }, []);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function openConfigure(c: Connector) {
    setEditing(c);
    setForm(c.config ?? {});
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await api.saveConnector(editing.provider, form);
      setNotice(`${editing.name} connected`);
      setTimeout(() => setNotice(""), 2500);
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save connector");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(c: Connector) {
    try {
      await api.disconnectConnector(c.provider);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not disconnect");
    }
  }

  const grouped = (connectors ?? []).reduce<Record<string, Connector[]>>((acc, c) => {
    (acc[c.category] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 sm:px-12 py-10">
          <div className="animate-slideUp">
            <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Connectors</h1>
            <p className="mt-1 text-[14px] text-slate-400">
              Connect calling, WhatsApp and translation providers so the Call / WhatsApp actions and customer-language messaging across the app work for real.
            </p>
          </div>

          {error && !editing && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600">
              <CheckCircle2 size={15} /> <span>{notice}</span>
            </div>
          )}

          {!connectors ? (
            <div className="mt-8 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl2" />)}
            </div>
          ) : (
            <div className="mt-8 space-y-10">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400 mb-4">
                    {CATEGORY_LABELS[category] ?? category}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {items.map((c) => (
                      <div key={c.provider} className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${CATEGORY_TILE[c.category] ?? "bg-slate-100 text-slate-500"}`}>
                              {(() => {
                                const Icon = CATEGORY_ICON[c.category] ?? Plug;
                                return <Icon size={18} />;
                              })()}
                            </div>
                            <div>
                              <p className="text-[14px] font-semibold text-charcoal-900">{c.name}</p>
                              <p className="text-[11px] font-medium text-slate-400">{c.region}</p>
                            </div>
                          </div>
                          {c.connected ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
                              <CheckCircle2 size={11} /> Connected
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-400">Not connected</span>
                          )}
                        </div>

                        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">{c.description}</p>

                        {c.provider === "sarvam_shilpa" && (
                          <div className="mt-3 bg-emerald-50/20 border border-emerald-100 rounded-xl p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span className="text-[12.5px] font-medium text-emerald-800">10-Second Tamil Voice Agent Sample</span>
                            </div>
                            <button
                              onClick={() => togglePlay()}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
                            >
                              {playingAudio ? (
                                <>
                                  <div className="flex items-center gap-0.5">
                                    <span className="w-0.5 h-3 bg-white animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                    <span className="w-0.5 h-3.5 bg-white animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                    <span className="w-0.5 h-2 bg-white animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                  </div>
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play size={12} fill="white" />
                                  Listen to Shilpa
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={() => openConfigure(c)}
                            className="flex items-center gap-1.5 rounded-lg bg-charcoal-900 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-charcoal-800"
                          >
                            <Settings2 size={13} />
                            {c.connected ? "Reconfigure" : "Configure"}
                          </button>
                          {c.connected && (
                            <button
                              onClick={() => disconnect(c)}
                              className="rounded-lg border border-slate-200 px-3.5 py-2 text-[12.5px] font-medium text-slate-500 hover:bg-slate-50"
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-2">
                <Plug size={16} className="text-slate-400" />
                <h2 className="text-[16px] font-semibold text-charcoal-900">Configure {editing.name}</h2>
              </div>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-charcoal-900">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={save} className="flex flex-col gap-4 px-6 py-6">
              <p className="text-[13px] leading-relaxed text-slate-500">{editing.description}</p>

              {editing.provider === "sarvam_shilpa" && (
                <div className="bg-emerald-50/20 border border-emerald-100 rounded-xl p-4 flex flex-col gap-3">
                  <p className="text-[12px] text-slate-500 font-medium">Test Shilpa's Tamil voice agent audio:</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Volume2 size={15} className="text-emerald-600 animate-pulse" />
                      <span className="text-[12.5px] font-semibold text-charcoal-900">Tamil Voice Sample (10s)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePlay()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
                    >
                      {playingAudio ? "Pause" : "Play Sample"}
                    </button>
                  </div>
                </div>
              )}

              {editing.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-[13px] font-medium text-slate-500">{field.label}</label>
                  {field.type === "select" ? (
                    <Dropdown
                      value={form[field.key] ?? ""}
                      onChange={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                      placeholder={field.placeholder ?? "Select"}
                      className="mt-1.5 w-full"
                      options={field.options ?? []}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={form[field.key] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none"
                    />
                  )}
                  {field.secret && <p className="mt-1 text-[11px] text-slate-400">Stored securely. Leave the •••• mask as-is to keep the saved value.</p>}
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Saving..." : "Save & connect"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
