import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cctv, Plus, X, Trash2, Pencil, Sparkles, Video, VideoOff, Users, Car, DoorOpen, Warehouse } from "lucide-react";
import { api, Branch, BranchCamera, CameraProvider, CameraInput } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import Dropdown from "../components/Dropdown";

// ---------------------------------------------------------------------------
// Branch camera settings + live MediaPipe AI monitor.
// The AI layer runs fully in the browser (MediaPipe Tasks Vision from CDN —
// person/vehicle detection). It works today on browser-playable sources:
// the device's own camera, or CORS-enabled MJPEG/HLS. Raw RTSP feeds can't be
// decoded by a browser and need a small LAN gateway (go2rtc/mediamtx) first.
// ---------------------------------------------------------------------------

const MP_VERSION = "0.10.14";
const MP_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MP_MODEL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
const VEHICLE_CATS = new Set(["car", "motorcycle", "truck", "bus", "bicycle"]);

interface AiStats {
  people: number;
  vehicles: number;
  peakPeople: number;
  peakVehicles: number;
  fps: number;
}

const EMPTY_FORM: Omit<CameraInput, "branchId"> = {
  name: "",
  placement: "inside",
  provider: "hikvision",
  streamUrl: "",
  username: "",
  password: "",
  aiEnabled: false,
  notes: "",
};

export default function CameraSettings() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [providers, setProviders] = useState<CameraProvider[]>([]);
  const [cameras, setCameras] = useState<BranchCamera[] | null>(null);
  const [error, setError] = useState("");

  // drawer
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // AI monitor
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [aiError, setAiError] = useState("");
  const [stats, setStats] = useState<AiStats>({ people: 0, vehicles: 0, peakPeople: 0, peakVehicles: 0, fps: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});

  function load(b: string) {
    setCameras(null);
    api.listCameras(b).then((res) => { setProviders(res.providers); setCameras(res.cameras); }).catch((e) => setError(e.message));
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    api.listBranches().then((bs) => {
      setBranches(bs);
      if (bs.length > 0) { setBranchId(bs[0].id); load(bs[0].id); }
    }).catch((e) => setError(e.message));
    return () => stopRef.current();
  }, []);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(cam: BranchCamera) {
    setEditId(cam.id);
    setForm({
      name: cam.name, placement: cam.placement, provider: cam.provider, streamUrl: cam.streamUrl,
      username: cam.username ?? "", password: cam.password ?? "", aiEnabled: cam.aiEnabled, notes: cam.notes ?? "",
    });
    setShowForm(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!branchId) return;
    setSaving(true);
    setError("");
    try {
      if (editId) await api.updateCamera(editId, form);
      else await api.createCamera({ ...form, branchId });
      setShowForm(false);
      load(branchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save camera");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this camera?")) return;
    await api.deleteCamera(id).catch(() => {});
    load(branchId);
  }

  const selProvider = providers.find((p) => p.provider === form.provider);

  // ----- MediaPipe AI monitor (device camera source) -----
  async function startAi() {
    setAiOpen(true);
    setAiStatus("loading");
    setAiError("");
    setStats({ people: 0, vehicles: 0, peakPeople: 0, peakVehicles: 0, fps: 0 });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const vision = await import(/* @vite-ignore */ `${MP_CDN}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_CDN}/wasm`);
      const detector = await vision.ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODEL },
        scoreThreshold: 0.4,
        runningMode: "VIDEO",
      });

      setAiStatus("running");
      let raf = 0;
      let lastTs = -1;
      let frames = 0;
      let fpsWindowStart = performance.now();
      let peakP = 0, peakV = 0;

      const loop = () => {
        if (!videoRef.current || video.readyState < 2) { raf = requestAnimationFrame(loop); return; }
        const now = performance.now();
        if (now !== lastTs) {
          lastTs = now;
          const result = detector.detectForVideo(video, now);
          const canvas = canvasRef.current!;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          let people = 0, vehicles = 0;
          for (const det of result.detections as Array<{ boundingBox?: { originX: number; originY: number; width: number; height: number }; categories: { categoryName: string; score: number }[] }>) {
            const cat = det.categories[0]?.categoryName ?? "";
            const isPerson = cat === "person";
            const isVehicle = VEHICLE_CATS.has(cat);
            if (!isPerson && !isVehicle) continue;
            if (isPerson) people++;
            else vehicles++;
            const bb = det.boundingBox;
            if (!bb) continue;
            ctx.strokeStyle = isPerson ? "#34d399" : "#38bdf8";
            ctx.lineWidth = 3;
            ctx.strokeRect(bb.originX, bb.originY, bb.width, bb.height);
            ctx.fillStyle = isPerson ? "#34d399" : "#38bdf8";
            ctx.font = "bold 14px Inter, sans-serif";
            ctx.fillText(`${cat} ${Math.round((det.categories[0]?.score ?? 0) * 100)}%`, bb.originX + 4, bb.originY + 16);
          }
          peakP = Math.max(peakP, people);
          peakV = Math.max(peakV, vehicles);
          frames++;
          if (now - fpsWindowStart > 1000) {
            setStats({ people, vehicles, peakPeople: peakP, peakVehicles: peakV, fps: Math.round((frames * 1000) / (now - fpsWindowStart)) });
            frames = 0;
            fpsWindowStart = now;
          }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      stopRef.current = () => {
        cancelAnimationFrame(raf);
        detector.close?.();
        (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };
    } catch (err) {
      setAiStatus("error");
      setAiError(err instanceof Error ? err.message : "Could not start the AI monitor (camera permission or network to CDN needed).");
    }
  }

  function stopAi() {
    stopRef.current();
    stopRef.current = () => {};
    setAiOpen(false);
    setAiStatus("idle");
  }

  const inside = (cameras ?? []).filter((c) => c.placement === "inside");
  const outside = (cameras ?? []).filter((c) => c.placement === "outside");

  function CamCard({ cam }: { cam: BranchCamera }) {
    const prov = providers.find((p) => p.provider === cam.provider);
    return (
      <div className="rounded-xl2 border border-slate-100 bg-white p-4 shadow-card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${cam.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
              <Cctv size={17} />
            </span>
            <div>
              <p className="text-[13.5px] font-semibold text-charcoal-900">{cam.name}</p>
              <p className="text-[11.5px] text-slate-400">{prov?.label ?? cam.provider}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(cam)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900"><Pencil size={14} /></button>
            <button onClick={() => remove(cam.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 size={14} /></button>
          </div>
        </div>
        <p className="mt-2 truncate font-mono text-[11px] text-slate-400" title={cam.streamUrl}>{cam.streamUrl}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cam.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
            {cam.status}
          </span>
          {cam.aiEnabled && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600">
              <Sparkles size={9} className="mr-0.5 inline" />AI on
            </span>
          )}
          {prov && !prov.browserPlayable && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600" title="RTSP can't play in a browser — needs a go2rtc/mediamtx gateway for live preview & AI">
              needs gateway for live AI
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 sm:px-12 py-10">
          <div className="animate-slideUp flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Cameras</h1>
              <p className="mt-1 text-[14px] text-slate-400">
                Connect the CCTV/IP cameras installed inside and outside each branch, and run the AI monitor.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {branches.length > 1 && (
                <Dropdown
                  value={branchId}
                  onChange={(id) => { setBranchId(id); load(id); }}
                  className="w-56"
                  options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.city }))}
                />
              )}
              <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-charcoal-800">
                <Plus size={15} /> Add camera
              </button>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          {/* AI monitor */}
          <div className="mt-6 rounded-xl2 border border-violet-200/70 bg-gradient-to-br from-violet-50/70 to-fuchsia-50/40 p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[14px] font-semibold text-charcoal-900">
                  <Sparkles size={15} className="text-violet-500" /> Live AI monitor <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-600">MediaPipe</span>
                </p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Person & vehicle detection running fully in this browser — nothing leaves the device.
                  Works with this device's camera now; IP cams need a browser-playable stream (MJPEG/HLS via gateway).
                </p>
              </div>
              {aiStatus !== "running" ? (
                <button onClick={startAi} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-violet-500">
                  <Video size={15} /> {aiStatus === "loading" ? "Loading model..." : "Start monitor"}
                </button>
              ) : (
                <button onClick={stopAi} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-rose-400">
                  <VideoOff size={15} /> Stop
                </button>
              )}
            </div>

            {aiStatus === "error" && <p className="mt-3 text-[12.5px] text-rose-500">{aiError}</p>}

            {aiOpen && aiStatus !== "error" && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
                <div className="relative overflow-hidden rounded-xl bg-charcoal-900">
                  <video ref={videoRef} muted playsInline className="w-full" />
                  <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
                  {aiStatus === "loading" && <p className="absolute inset-0 flex items-center justify-center text-[13px] text-white/80">Loading MediaPipe model…</p>}
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-emerald-100 bg-white p-3">
                    <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-emerald-600"><Users size={11} /> People in view</p>
                    <p className="text-[24px] font-bold text-charcoal-900">{stats.people}</p>
                    <p className="text-[10.5px] text-slate-400">peak {stats.peakPeople}</p>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-white p-3">
                    <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-sky-600"><Car size={11} /> Vehicles in view</p>
                    <p className="text-[24px] font-bold text-charcoal-900">{stats.vehicles}</p>
                    <p className="text-[10.5px] text-slate-400">peak {stats.peakVehicles}</p>
                  </div>
                  <p className="text-[10.5px] text-slate-400">{stats.fps} fps · on-device</p>
                </div>
              </div>
            )}
          </div>

          {/* Camera lists */}
          {!cameras ? (
            <Skeleton className="mt-6 h-40 w-full" />
          ) : cameras.length === 0 ? (
            <div className="mt-6 rounded-xl2 border border-dashed border-slate-200 bg-white p-12 text-center">
              <Cctv size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-medium text-charcoal-900">No cameras connected at this branch</p>
              <p className="mt-1 text-[12.5px] text-slate-400">Add your DVR/NVR channels or IP cameras — inside the bays and outside the entrance.</p>
            </div>
          ) : (
            <>
              <h2 className="mt-8 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                <Warehouse size={14} /> Inside ({inside.length})
              </h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inside.map((c) => <CamCard key={c.id} cam={c} />)}
                {inside.length === 0 && <p className="text-[12.5px] text-slate-400 italic">None yet.</p>}
              </div>
              <h2 className="mt-8 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                <DoorOpen size={14} /> Outside ({outside.length})
              </h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {outside.map((c) => <CamCard key={c.id} cam={c} />)}
                {outside.length === 0 && <p className="text-[12.5px] text-slate-400 italic">None yet.</p>}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Add/edit drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/40 p-4" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl2 bg-white p-6 shadow-xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-charcoal-900">{editId ? "Edit camera" : "Add camera"}</h3>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-slate-500">Camera name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-charcoal-900"
                  placeholder="e.g. Entrance / Wash bay 1" />
              </div>

              <div>
                <label className="text-[12px] font-medium text-slate-500">Placement</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["inside", "outside"] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setForm({ ...form, placement: p })}
                      className={`rounded-xl border px-3 py-2 text-[13px] capitalize ${form.placement === p ? "border-charcoal-900 bg-charcoal-900/5 font-medium text-charcoal-900" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                      {p === "inside" ? "🏢 Inside" : "🚪 Outside"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium text-slate-500">Provider *</label>
                <select
                  value={form.provider}
                  onChange={(e) => {
                    const prov = providers.find((p) => p.provider === e.target.value);
                    const streamUrl =
                      e.target.value === "device_webcam" ? "device"
                      : form.streamUrl && form.streamUrl !== "device" ? form.streamUrl
                      : prov && !prov.urlTemplate.startsWith("(") ? prov.urlTemplate : "";
                    setForm({ ...form, provider: e.target.value, streamUrl });
                  }}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] outline-none focus:border-charcoal-900"
                >
                  {providers.map((p) => <option key={p.provider} value={p.provider}>{p.label}{p.browserPlayable ? " · AI-ready" : ""}</option>)}
                </select>
                {selProvider && <p className="mt-1.5 text-[11px] text-slate-400">{selProvider.hint}</p>}
              </div>

              {form.provider !== "device_webcam" && (
                <>
                  <div>
                    <label className="text-[12px] font-medium text-slate-500">Stream URL *</label>
                    <input value={form.streamUrl} onChange={(e) => setForm({ ...form, streamUrl: e.target.value })} required
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-[12px] outline-none focus:border-charcoal-900"
                      placeholder={selProvider?.urlTemplate} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[12px] font-medium text-slate-500">Username</label>
                      <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-charcoal-900" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-500">Password</label>
                      <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-charcoal-900" />
                    </div>
                  </div>
                </>
              )}
              {form.provider === "device_webcam" && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
                  Uses the camera of whatever device opens this page (counter tablet/PC) — no URL or credentials needed.
                </p>
              )}

              <label className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50/40 px-3.5 py-2.5">
                <input type="checkbox" checked={form.aiEnabled} onChange={(e) => setForm({ ...form, aiEnabled: e.target.checked })} className="h-4 w-4 accent-violet-600" />
                <span className="text-[12.5px] text-charcoal-900">
                  <Sparkles size={12} className="mr-1 inline text-violet-500" />
                  Enable AI layer (MediaPipe person & vehicle detection)
                </span>
              </label>

              <div>
                <label className="text-[12px] font-medium text-slate-500">Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] outline-none focus:border-charcoal-900"
                  placeholder="e.g. covers bays 1–2" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50">
                  {saving ? "Saving..." : editId ? "Save changes" : "Add camera"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
