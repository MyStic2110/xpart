import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Star, MessageSquareHeart, ThumbsUp, ThumbsDown, Reply, XCircle, Info } from "lucide-react";
import { api, Feedback, FeedbackSummary } from "../api";
import Sidebar from "../components/Sidebar";
import Dropdown from "../components/Dropdown";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import FloatingInput from "../components/FloatingInput";

const SOURCE_LABELS: Record<string, string> = { in_app: "In-app", google: "Google", whatsapp: "WhatsApp", manual: "Manual" };
const SOURCE_STYLES: Record<string, string> = {
  in_app: "bg-accent-500/10 text-accent-600",
  google: "bg-amber-50 text-amber-600",
  whatsapp: "bg-emerald-50 text-emerald-600",
  manual: "bg-slate-100 text-slate-500",
};

function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-slate-300 text-[12px]">no rating</span>;
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} className={i < n ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
      ))}
    </span>
  );
}

export default function Feedbacks() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ source: "manual", reviewerName: "", rating: 5, comment: "", reviewDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  function load() {
    api.listFeedback(sourceFilter).then(setItems).catch((err) => setError(err.message));
    api.feedbackSummary().then(setSummary).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);
  useEffect(() => { setItems(null); load(); }, [sourceFilter]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.createFeedback(form);
      setShowForm(false);
      setForm({ source: "manual", reviewerName: "", rating: 5, comment: "", reviewDate: new Date().toISOString().slice(0, 10) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save");
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(id: string) {
    if (!replyText.trim()) return;
    try {
      await api.replyFeedback(id, replyText);
      setReplyFor(null);
      setReplyText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not reply");
    }
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 sm:px-12 py-10">
          <div className="flex items-center justify-between animate-slideUp">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Feedbacks</h1>
              <p className="mt-1 text-[14px] text-slate-400">Reviews and ratings across all channels.</p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800">
              <Plus size={15} /> Add feedback
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard label="Average rating" value={summary ? `${summary.avgRating} ★` : "—"} icon={Star} loading={!summary} />
            <StatCard label="Total reviews" value={summary?.total ?? 0} icon={MessageSquareHeart} loading={!summary} />
            <StatCard label="Positive (4-5★)" value={summary?.positive ?? 0} icon={ThumbsUp} loading={!summary} />
            <StatCard label="Negative (1-2★)" value={summary?.negative ?? 0} icon={ThumbsDown} loading={!summary} />
          </div>

          {/* Google import notice */}
          <div className="mt-6 flex items-start gap-2.5 rounded-xl2 border border-amber-200 bg-amber-50 px-4 py-3.5">
            <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-[13px] text-amber-800 leading-relaxed">
              <span className="font-semibold">Google reviews can't be auto-scraped.</span> Google blocks scraping and it breaks their terms. To pull your Google reviews in automatically, connect the
              {" "}<span className="font-medium">Google Business Profile</span> connector (Places API) — until then, add them manually with source “Google”.
            </div>
          </div>

          <div className="mt-6 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
            {["all", "in_app", "google", "whatsapp", "manual"].map((s) => (
              <button key={s} onClick={() => setSourceFilter(s)} className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors ${sourceFilter === s ? "bg-white text-charcoal-900 shadow-card" : "text-slate-500 hover:text-charcoal-900"}`}>
                {s === "all" ? "All" : SOURCE_LABELS[s]}
              </button>
            ))}
          </div>

          {error && <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600"><AlertCircle size={15} /> <span>{error}</span></div>}

          <div className="mt-4 space-y-3">
            {!items ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl2" />)
            ) : items.length === 0 ? (
              <div className="rounded-xl2 border border-slate-100 bg-white p-16 text-center shadow-card">
                <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-medium text-charcoal-900">No feedback yet</p>
                <p className="mt-1 text-sm text-slate-400">Add feedback manually or connect a channel to collect it automatically.</p>
              </div>
            ) : (
              items.map((f) => (
                <div key={f.id} className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-charcoal-900">{f.reviewerName ?? "Anonymous"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SOURCE_STYLES[f.source]}`}>{SOURCE_LABELS[f.source]}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars n={f.rating} />
                        {f.reviewDate && <span className="text-[12px] text-slate-400">{f.reviewDate}</span>}
                      </div>
                    </div>
                    {!f.reply && (
                      <button onClick={() => { setReplyFor(f.id); setReplyText(""); }} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                        <Reply size={13} /> Reply
                      </button>
                    )}
                  </div>
                  {f.comment && <p className="mt-3 text-[13.5px] leading-relaxed text-slate-600">{f.comment}</p>}
                  {f.reply && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold text-slate-400">Your reply</p>
                      <p className="mt-0.5 text-[13px] text-charcoal-900">{f.reply}</p>
                    </div>
                  )}
                  {replyFor === f.id && (
                    <div className="mt-3 flex gap-2">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-accent-500 focus:outline-none" />
                      <button onClick={() => sendReply(f.id)} className="rounded-lg bg-charcoal-900 px-3 py-2 text-[12px] font-medium text-white">Send</button>
                      <button onClick={() => setReplyFor(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-500">Cancel</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">Add feedback</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6">
              <div>
                <label className="text-[13px] font-medium text-slate-500">Source</label>
                <Dropdown
                  value={form.source}
                  onChange={(v) => setForm((f) => ({ ...f, source: v }))}
                  className="mt-1.5 w-full"
                  options={["manual", "google", "in_app", "whatsapp"].map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
                />
              </div>
              <FloatingInput label="Reviewer name" value={form.reviewerName} onChange={(e) => setForm((f) => ({ ...f, reviewerName: e.target.value }))} />
              <div>
                <label className="text-[13px] font-medium text-slate-500">Rating</label>
                <div className="mt-1.5 flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, rating: n }))}>
                      <Star size={24} className={n <= form.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[13px] font-medium text-slate-500">Comment</label>
                <textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} rows={4} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] focus:border-accent-500 focus:outline-none" />
              </div>
              <FloatingInput label="Review date" type="date" value={form.reviewDate} onChange={(e) => setForm((f) => ({ ...f, reviewDate: e.target.value }))} />
              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                {saving ? "Saving..." : "Add feedback"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
