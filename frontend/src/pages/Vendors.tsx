import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, AlertCircle, Phone, Mail, MapPin, Building, Pencil, Trash2, XCircle, ChevronRight, Radio, ShieldCheck, Check, Sparkles, TrendingUp, Clock, AlertTriangle, Send, RotateCcw, Compass, Map, Mic, MicOff, Volume2 } from "lucide-react";
import { api, Vendor, VendorInput, PartsRequest, PartsRequestInput, PartsQuote, RfqHistoryStats, RfqItem } from "../api";
import Sidebar from "../components/Sidebar";
import Skeleton from "../components/Skeleton";
import StatCard from "../components/StatCard";
import TableToolbar from "../components/TableToolbar";
import Pagination from "../components/Pagination";
import FloatingInput from "../components/FloatingInput";
import { downloadCsv } from "../utils/csv";

const PAGE_SIZE = 12;
const EMPTY: VendorInput = { name: "", contactNumber: "", email: "", address: "", googleMapsUrl: "" };
const EMPTY_RFQ: PartsRequestInput = {
  vehicleInfo: "",
  urgency: "today",
  deliveryLocation: "Chennai - Anna Nagar",
  maxBudget: "",
  isEmergency: false,
  broadcastWhatsApp: false,
  searchRadiusKm: 10,
  items: [{ partName: "", qty: "1", oemNumber: "", preferredBrand: "" }],
};

export default function Vendors() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorInput>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [creditSummary, setCreditSummary] = useState(0);

  // B2B RFQ state
  const [activeTab, setActiveTab] = useState<"suppliers" | "rfqs">("suppliers");
  const [rfqs, setRfqs] = useState<PartsRequest[] | null>(null);
  const [rfqStats, setRfqStats] = useState<RfqHistoryStats | null>(null);
  const [isCreatingRfq, setIsCreatingRfq] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<PartsRequest | null>(null);
  const [rfqForm, setRfqForm] = useState<PartsRequestInput>(EMPTY_RFQ);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  // Voice assistant state
  const [globalListening, setGlobalListening] = useState(false);
  const [voiceActiveField, setVoiceActiveField] = useState<"vehicleInfo" | "deliveryLocation" | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [speechError, setSpeechError] = useState("");
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (recognition) {
        try {
          recognition.abort();
        } catch (e) {}
      }
    };
  }, [recognition]);

  const startSpeech = (targetField: "vehicleInfo" | "deliveryLocation" | null) => {
    setError("");
    setSpeechError("");
    setLiveTranscript("");
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    if (recognition) {
      try {
        recognition.abort();
      } catch (e) {}
    }

    const rec = new SpeechRecognition();
    rec.continuous = targetField === null;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onstart = () => {
      if (targetField === null) {
        setGlobalListening(true);
        setVoiceActiveField(null);
      } else {
        setGlobalListening(false);
        setVoiceActiveField(targetField);
      }
    };

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      const activeText = (final || interim).trim();
      if (activeText) {
        setLiveTranscript(activeText);
      }

      if (final.trim()) {
        const text = final.trim();
        if (targetField) {
          setRfqForm((prev) => ({
            ...prev,
            [targetField]: capitalizeWords(text),
          }));
          rec.stop();
        } else {
          parseVoiceCommand(text);
        }
      }
    };

    rec.onerror = (e: any) => {
      console.error("Speech Recognition Error:", e);
      if (e.error !== "no-speech") {
        setSpeechError(`Voice Error: ${e.error}`);
        stopSpeech(rec);
      }
    };

    rec.onend = () => {
      setGlobalListening(false);
      setVoiceActiveField(null);
    };

    rec.start();
    setRecognition(rec);
  };

  const stopSpeech = (recInstance = recognition) => {
    if (recInstance) {
      try {
        recInstance.stop();
      } catch (e) {}
    }
    setGlobalListening(false);
    setVoiceActiveField(null);
  };

  const parseVoiceCommand = (rawText: string) => {
    const text = rawText.trim().toLowerCase();
    if (!text) return;

    // 1. Vehicle Match
    const vehicleMatch = text.match(/^(?:set\s+)?(?:vehicle|car|model)(?:\s+to)?\s+(.+)$/i);
    if (vehicleMatch) {
      const val = capitalizeWords(vehicleMatch[1]);
      setRfqForm(prev => ({ ...prev, vehicleInfo: val }));
      showToast(`Vehicle updated: ${val}`);
      return;
    }

    // 2. Location Match
    const locationMatch = text.match(/^(?:set\s+)?(?:location|delivery|address)(?:\s+to)?\s+(.+)$/i);
    if (locationMatch) {
      const val = capitalizeWords(locationMatch[1]);
      setRfqForm(prev => ({ ...prev, deliveryLocation: val }));
      showToast(`Location updated: ${val}`);
      return;
    }

    // 3. Add command or fallback to raw phrase
    let partSpec = text;
    const addMatch = text.match(/^(?:add|insert|include|new)\s+(.+)$/i);
    if (addMatch) {
      partSpec = addMatch[1];
    } else {
      const noises = ["hello", "testing", "hey", "microphone", "clear", "reset", "cancel", "submit", "broadcast"];
      if (noises.includes(text) || text.length < 3) {
        if (text === "clear" || text === "reset") {
          setRfqForm(prev => ({ ...prev, items: [{ partName: "", qty: "1", oemNumber: "", preferredBrand: "" }] }));
          showToast("Parts list cleared");
        }
        return;
      }
    }

    let partName = partSpec;
    let qty = "1";

    const endQtyMatch = partSpec.match(/^(.+?)\s+(\d+)\s*(pcs|units|sets|litres|liters|l|kg|g|box|boxes)?$/i);
    const startQtyMatch = partSpec.match(/^(\d+)\s*(pcs|units|sets|litres|liters|l|kg|g|box|boxes)?\s+(.+)$/i);

    if (endQtyMatch) {
      partName = endQtyMatch[1];
      qty = endQtyMatch[3] ? `${endQtyMatch[2]} ${capitalizeWords(endQtyMatch[3])}` : endQtyMatch[2];
    } else if (startQtyMatch) {
      partName = startQtyMatch[3];
      qty = startQtyMatch[2] ? `${startQtyMatch[1]} ${capitalizeWords(startQtyMatch[2])}` : startQtyMatch[1];
    }

    const finalPartName = capitalizeWords(partName);

    setRfqForm(prev => {
      const newItems = [...prev.items];
      if (newItems.length === 1 && !newItems[0].partName.trim()) {
        newItems[0] = { partName: finalPartName, qty, oemNumber: "", preferredBrand: "" };
      } else {
        newItems.push({ partName: finalPartName, qty, oemNumber: "", preferredBrand: "" });
      }
      return { ...prev, items: newItems };
    });

    showToast(`Added to cart: ${finalPartName} (Qty: ${qty})`);
  };

  const capitalizeWords = (str: string) => {
    return str
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);
  }

  function load() {
    api.listVendors().then(setVendors).catch((err) => setError(err.message));
    api.inventorySummary().then((sum) => setCreditSummary(sum.creditOutstanding)).catch(() => {});
    loadRfqs();
  }

  function loadRfqs() {
    api.listRfqs().then(setRfqs).catch((err) => setError(err.message));
    api.getRfqStats().then(setRfqStats).catch(() => {});
  }

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
    load();
  }, []);

  useEffect(() => setPage(1), [search]);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function openCreate() {
    setEditId(null);
    setForm(EMPTY);
    setError("");
    setShowForm(true);
  }

  function openEdit(v: Vendor) {
    setEditId(v.id);
    setForm({
      name: v.name,
      contactNumber: v.contactNumber,
      email: v.email ?? "",
      address: v.address ?? "",
      googleMapsUrl: v.googleMapsUrl ?? "",
    });
    setError("");
    setShowForm(true);
  }

  function set(field: keyof VendorInput, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editId) await api.updateVendor(editId, form);
      else await api.createVendor(form);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save vendor");
    } finally {
      setSaving(false);
    }
  }

  async function remove(v: Vendor) {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    try {
      await api.deleteVendor(v.id);
      load();
      showToast("Vendor deleted successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not delete");
      showToast("Failed to delete vendor", "error");
    }
  }

  // RFQ handlers
  async function submitRfq(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const validItems = rfqForm.items.filter(it => it.partName.trim().length > 0);
      if (validItems.length === 0) {
        setError("Please add at least one spare part or consumable to the request.");
        setSaving(false);
        return;
      }

      const budgetVal = rfqForm.maxBudget === "" ? undefined : Number(rfqForm.maxBudget);
      await api.createRfq({
        ...rfqForm,
        items: validItems,
        maxBudget: budgetVal,
      });
      setIsCreatingRfq(false);
      setRfqForm(EMPTY_RFQ);
      loadRfqs();
      showToast("Spare parts request broadcasted to 8 local suppliers!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to broadcast request");
      showToast("Failed to broadcast request", "error");
    } finally {
      setSaving(false);
    }
  }

  async function chooseQuote(requestId: string, quote: PartsQuote) {
    if (!confirm(`Accept quote from "${quote.vendorName}" for ₹${(quote.price / 100).toLocaleString("en-IN")}?`)) return;
    try {
      await api.selectQuote(requestId, quote.id);
      setSelectedRfq(null);
      loadRfqs();
      showToast(`Selected ${quote.vendorName}! WhatsApp dispatch notification sent to supplier.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select quote");
      showToast("Failed to select quote", "error");
    }
  }

  async function completeOrder(requestId: string) {
    if (!confirm("Mark this spare parts order as received and completed?")) return;
    try {
      await api.completeRfq(requestId);
      loadRfqs();
      showToast("Spare parts received and order marked completed!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete order");
      showToast("Failed to complete order", "error");
    }
  }

  async function reorderParts(requestId: string) {
    try {
      await api.reorderRfq(requestId);
      loadRfqs();
      showToast("Spare parts request duplicated and re-broadcasted successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder parts");
      showToast("Failed to reorder", "error");
    }
  }

  const filtered = useMemo(() => {
    if (!vendors) return [];
    const q = search.trim().toLowerCase();
    return q
      ? vendors.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.contactNumber.includes(q) ||
            (v.email ?? "").toLowerCase().includes(q) ||
            (v.address ?? "").toLowerCase().includes(q)
        )
      : vendors;
  }, [vendors, search]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    downloadCsv(
      "vendors.csv",
      filtered.map((v) => ({
        Name: v.name,
        Contact: v.contactNumber,
        Email: v.email ?? "",
        Address: v.address ?? "",
      }))
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 py-10">
          
          {isCreatingRfq ? (
            /* Full Page RFQ Creation View */
            <div className="animate-fadeIn space-y-6">
              {/* Page Breadcrumb/Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <button 
                    type="button"
                    onClick={() => setIsCreatingRfq(false)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-400 hover:text-charcoal-900 transition-colors mb-2"
                  >
                    ← Back to Sourcing Dashboard
                  </button>
                  <h1 className="text-[1.65rem] font-bold text-charcoal-900 tracking-tight flex items-center gap-2">
                    <Radio size={20} className="text-indigo-600 animate-pulse" /> Request Parts Quote
                  </h1>
                  <p className="text-[13.5px] text-slate-400 mt-1">Build your purchase request and broadcast to verified nearby suppliers instantly.</p>
                </div>
              </div>

              <form onSubmit={submitRfq} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* General Settings Sidebar */}
                <div className="lg:col-span-1 space-y-5">
                  <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-card space-y-4">
                    <h3 className="text-[13.5px] font-bold text-charcoal-900 uppercase tracking-wider border-b border-slate-100 pb-2">RFQ Parameters</h3>
                    
                    <FloatingInput
                      label="Vehicle Info (Make/Model/Year)"
                      value={rfqForm.vehicleInfo}
                      onChange={(e) => setRfqForm(prev => ({ ...prev, vehicleInfo: e.target.value }))}
                      placeholder="e.g. Hyundai Creta 2022 Diesel"
                      required
                      suffix={
                        <button
                          type="button"
                          onClick={() => voiceActiveField === "vehicleInfo" ? stopSpeech() : startSpeech("vehicleInfo")}
                          className={`p-1.5 rounded-lg transition-all ${
                            voiceActiveField === "vehicleInfo"
                              ? "bg-red-500 text-white animate-pulse"
                              : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                          }`}
                          title="Speak Vehicle Info"
                        >
                          {voiceActiveField === "vehicleInfo" ? <MicOff size={15} /> : <Mic size={15} />}
                        </button>
                      }
                    />
                    <FloatingInput
                      label="Delivery Location"
                      value={rfqForm.deliveryLocation}
                      onChange={(e) => setRfqForm(prev => ({ ...prev, deliveryLocation: e.target.value }))}
                      required
                      suffix={
                        <button
                          type="button"
                          onClick={() => voiceActiveField === "deliveryLocation" ? stopSpeech() : startSpeech("deliveryLocation")}
                          className={`p-1.5 rounded-lg transition-all ${
                            voiceActiveField === "deliveryLocation"
                              ? "bg-red-500 text-white animate-pulse"
                              : "text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                          }`}
                          title="Speak Location"
                        >
                          {voiceActiveField === "deliveryLocation" ? <MicOff size={15} /> : <Mic size={15} />}
                        </button>
                      }
                    />
                    
                    <div className="flex flex-col">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Urgency</label>
                      <select
                        value={rfqForm.urgency}
                        onChange={(e) => setRfqForm(prev => ({ ...prev, urgency: e.target.value as any }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] bg-white font-medium text-charcoal-900 focus:outline-indigo-600"
                      >
                        <option value="immediate">Immediate / Today</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                      </select>
                    </div>

                    <FloatingInput label="Max Budget (₹, Optional)" type="number" value={rfqForm.maxBudget === "" ? "" : String(rfqForm.maxBudget)} onChange={(e) => setRfqForm(prev => ({ ...prev, maxBudget: e.target.value === "" ? "" : Number(e.target.value) }))} />
                    
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex justify-between">
                        <span>Search Radius</span>
                        <span className="text-indigo-600 font-bold">{rfqForm.searchRadiusKm} km</span>
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        value={rfqForm.searchRadiusKm}
                        onChange={(e) => setRfqForm(prev => ({ ...prev, searchRadiusKm: Number(e.target.value) }))}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Alert Settings */}
                  <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-card space-y-4">
                    <h3 className="text-[13.5px] font-bold text-charcoal-900 uppercase tracking-wider border-b border-slate-100 pb-2">Alert Settings</h3>
                    
                    <label className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/20 p-3.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rfqForm.broadcastWhatsApp}
                        onChange={(e) => setRfqForm(prev => ({ ...prev, broadcastWhatsApp: e.target.checked }))}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-[12.5px] font-bold text-indigo-800 flex items-center gap-1">💬 WhatsApp Alert</span>
                        <span className="text-[10px] text-indigo-600/80 font-medium block mt-0.5 leading-normal">Send WhatsApp notifications directly to matched vendors.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/20 p-3.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rfqForm.isEmergency}
                        onChange={(e) => setRfqForm(prev => ({ ...prev, isEmergency: e.target.checked }))}
                        className="rounded border-red-300 text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-[12.5px] font-bold text-red-700 flex items-center gap-1">🚨 Emergency Sourcing</span>
                        <span className="text-[10px] text-red-500 font-medium block mt-0.5 leading-normal">Flags 30m rapid delivery matching.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* PR Items Table */}
                <div className="lg:col-span-2 space-y-5">
                  <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-card space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-1">
                      <h3 className="text-[13.5px] font-bold text-charcoal-900 uppercase tracking-wider flex items-center gap-1.5">🛒 Requested Parts & Consumables</h3>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => globalListening ? stopSpeech() : startSpeech(null)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-all shadow-sm ${
                            globalListening
                              ? "bg-red-500 text-white animate-pulse"
                              : "border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {globalListening ? (
                            <>
                              <MicOff size={14} /> Stop Listening
                            </>
                          ) : (
                            <>
                              <Mic size={14} /> Speak to Add
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRfqForm(prev => ({ ...prev, items: [...prev.items, { partName: "", qty: "1", oemNumber: "", preferredBrand: "" }] }))}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-colors"
                        >
                          <Plus size={14} /> Add Part Row
                        </button>
                      </div>
                    </div>

                    {/* Live speech feedback panel */}
                    {(globalListening || voiceActiveField || speechError) && (
                      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all ${
                        speechError 
                          ? "bg-red-50 border-red-200 text-red-700" 
                          : "bg-indigo-50/40 border-indigo-100 text-indigo-900"
                      }`}>
                        <div className="flex items-center gap-3">
                          {speechError ? (
                            <AlertCircle size={20} className="text-red-500 shrink-0" />
                          ) : (
                            <div className="flex items-center gap-1 bg-indigo-100/80 p-2 rounded-full text-indigo-600 shrink-0">
                              <Volume2 size={16} className="animate-bounce" />
                            </div>
                          )}
                          <div>
                            <div className="text-[12.5px] font-bold">
                              {speechError 
                                ? "Voice Assistant Error" 
                                : globalListening 
                                  ? "Voice Assistant Listening..." 
                                  : `Speaking to field: ${voiceActiveField === 'vehicleInfo' ? 'Vehicle Info' : 'Delivery Location'}`}
                            </div>
                            <div className="text-[12px] text-slate-500 italic mt-0.5 leading-normal">
                              {speechError 
                                ? speechError 
                                : liveTranscript 
                                  ? `"${liveTranscript}"` 
                                  : globalListening 
                                    ? 'Say something like: "set vehicle to Toyota Fortuner", "add brake pad", "add 5 litres engine oil"'
                                    : 'Speak the field content clearly...'}
                            </div>
                          </div>
                        </div>

                        {!speechError && (globalListening || voiceActiveField) && (
                          <div className="flex items-end gap-1 h-6 px-3">
                            <span className="bg-indigo-600 w-1 rounded-full sound-wave-bar sound-wave-bar-1"></span>
                            <span className="bg-indigo-600 w-1 rounded-full sound-wave-bar sound-wave-bar-2"></span>
                            <span className="bg-indigo-600 w-1 rounded-full sound-wave-bar sound-wave-bar-3"></span>
                            <span className="bg-indigo-600 w-1 rounded-full sound-wave-bar sound-wave-bar-4"></span>
                            <span className="bg-indigo-600 w-1 rounded-full sound-wave-bar sound-wave-bar-5"></span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-4 py-3 text-center w-12">#</th>
                            <th className="px-4 py-3">Part Name / Item Description</th>
                            <th className="px-4 py-3 w-32">Quantity</th>
                            <th className="px-4 py-3 w-44">OEM Part # (Opt)</th>
                            <th className="px-4 py-3 w-44">Brand Pref (Opt)</th>
                            <th className="px-4 py-3 text-center w-16">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[13px] text-charcoal-900">
                          {rfqForm.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/30">
                              <td className="px-4 py-3.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                              <td className="px-3 py-3.5">
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Front Brake Pad"
                                  value={item.partName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRfqForm(prev => {
                                      const newItems = [...prev.items];
                                      newItems[idx].partName = val;
                                      return { ...prev, items: newItems };
                                    });
                                  }}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-charcoal-900 focus:outline-indigo-600"
                                />
                              </td>
                              <td className="px-3 py-3.5">
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. 1 Set, 2"
                                  value={item.qty}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRfqForm(prev => {
                                      const newItems = [...prev.items];
                                      newItems[idx].qty = val;
                                      return { ...prev, items: newItems };
                                    });
                                  }}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-charcoal-900 focus:outline-indigo-600"
                                />
                              </td>
                              <td className="px-3 py-3.5">
                                <input
                                  type="text"
                                  placeholder="Optional"
                                  value={item.oemNumber || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRfqForm(prev => {
                                      const newItems = [...prev.items];
                                      newItems[idx].oemNumber = val;
                                      return { ...prev, items: newItems };
                                    });
                                  }}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-600 focus:outline-indigo-600"
                                />
                              </td>
                              <td className="px-3 py-3.5">
                                <input
                                  type="text"
                                  placeholder="e.g. Bosch"
                                  value={item.preferredBrand || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setRfqForm(prev => {
                                      const newItems = [...prev.items];
                                      newItems[idx].preferredBrand = val;
                                      return { ...prev, items: newItems };
                                    });
                                  }}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-600 focus:outline-indigo-600"
                                />
                              </td>
                              <td className="px-3 py-3.5 text-center">
                                <button
                                  type="button"
                                  disabled={rfqForm.items.length === 1}
                                  onClick={() => setRfqForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                        <AlertCircle size={15} /> <span>{error}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsCreatingRfq(false)}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-indigo-600 px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5"
                      >
                        {saving ? "Broadcasting..." : <><Send size={14} /> Broadcast RFQ</>}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* Standard Dashboard View */
            <>
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-slideUp">
                <div>
                  <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Vendors & Sourcing</h1>
                  <p className="mt-1 text-[14px] text-slate-400">Manage spare parts suppliers directory and B2B sourcing request network.</p>
                </div>
                <div className="flex items-center gap-3">
                  {activeTab === "suppliers" ? (
                    <button onClick={openCreate} className="flex items-center gap-2 rounded-xl bg-charcoal-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-charcoal-800 transition-all shadow-sm">
                      <Plus size={15} /> Add Vendor
                    </button>
                  ) : (
                    <button onClick={() => setIsCreatingRfq(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-indigo-700 transition-all shadow-sm">
                      <Send size={14} /> Request Quote
                    </button>
                  )}
                </div>
              </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("suppliers")}
              className={`pb-3 px-4 text-[14px] font-semibold transition-all border-b-2 ${
                activeTab === "suppliers"
                  ? "border-charcoal-900 text-charcoal-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Supplier Directory
            </button>
            <button
              onClick={() => setActiveTab("rfqs")}
              className={`pb-3 px-4 text-[14px] font-semibold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "rfqs"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Radio size={14} className={activeTab === "rfqs" ? "text-indigo-600 animate-pulse" : "text-slate-400"} />
              B2B Sourcing Network
            </button>
          </div>

          {/* Tab Content: Supplier Directory */}
          {activeTab === "suppliers" && (
            <div className="animate-fadeIn">
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard label="Total vendors" value={vendors?.length ?? 0} icon={Building} loading={!vendors} />
                <StatCard label="Credit outstanding" value={`₹${(creditSummary / 100).toLocaleString("en-IN")}`} icon={Building} loading={!vendors} info="Total outstanding payments owed to all suppliers." />
              </div>

              <div className="mt-6">
                <TableToolbar search={search} onSearch={setSearch} placeholder="Search name, contact, email, address..." onDownload={exportCsv} />
              </div>

              {error && !showForm && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}

              <div className="mt-4 rounded-xl2 border border-slate-100 bg-white shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-[12px] font-medium text-slate-400">
                        <th className="px-5 py-3.5">Vendor</th>
                        <th className="px-5 py-3.5">Contact Details</th>
                        <th className="px-5 py-3.5">Address</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!vendors ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 4 }).map((__, j) => (
                              <td key={j} className="px-5 py-4"><Skeleton className="h-4 w-24" /></td>
                            ))}
                          </tr>
                        ))
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-16 text-center">
                            <XCircle size={28} strokeWidth={1.5} className="mx-auto text-slate-300" />
                            <p className="mt-3 text-sm font-medium text-charcoal-900">No vendors found</p>
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((v) => (
                          <tr key={v.id} className="text-[13.5px] text-charcoal-900 hover:bg-slate-50/60">
                            <td className="px-5 py-4 font-medium whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-semibold text-charcoal-900">{v.name}</span>
                                {v.specialization && <span className="text-[11px] text-indigo-600 font-semibold">{v.specialization}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1 text-[13px] text-slate-500">
                                <span className="flex items-center gap-1"><Phone size={12} /> {v.contactNumber}</span>
                                {v.email && <span className="flex items-center gap-1"><Mail size={12} /> {v.email}</span>}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                              {v.address ? (
                                v.googleMapsUrl ? (
                                  <a href={v.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 max-w-xs truncate text-indigo-600 hover:text-indigo-800 font-semibold hover:underline">
                                    <MapPin size={12} className="shrink-0" /> {v.address}
                                  </a>
                                ) : (
                                  <span className="flex items-center gap-1 max-w-xs truncate"><MapPin size={12} className="shrink-0" /> {v.address}</span>
                                )
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-5 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => navigate(`/vendors/${v.id}/ledger`)}
                                  className="inline-flex items-center gap-1 text-[12px] font-bold text-accent-700 hover:text-accent-950 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                                >
                                  Ledger <ChevronRight size={13} />
                                </button>
                                <button onClick={() => openEdit(v)} title="Edit" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900">
                                  <Pencil size={15} />
                                </button>
                                <button onClick={() => remove(v)} title="Delete" className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} />
              </div>
            </div>
          )}

          {/* Tab Content: B2B Sourcing Portal */}
          {activeTab === "rfqs" && (
            <div className="mt-6 animate-fadeIn space-y-6">
              
              {/* RFQ Sourcing Metrics Dashboard */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total B2B RFQs" value={rfqStats?.totalRfqs ?? 0} icon={Radio} loading={!rfqStats} />
                <StatCard label="Completed Orders" value={rfqStats?.completedRfqs ?? 0} icon={Check} loading={!rfqStats} />
                <StatCard label="Avg Response Time" value={`${rfqStats?.avgResponseTimeMinutes ?? 3} mins`} icon={Clock} loading={!rfqStats} />
                <StatCard label="Total Saved" value={`₹${((rfqStats?.savingsTotal ?? 0) / 100).toLocaleString("en-IN")}`} icon={TrendingUp} loading={!rfqStats} info="Estimated saving generated using B2B competitive RFQ bidding compared to budget bounds." />
              </div>

              {/* Sourcing Requests Card Grid */}
              <div>
                <h3 className="text-[14px] font-semibold text-charcoal-900 mb-4">Active Sourcing Bids & History</h3>

                {!rfqs ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-slate-100 bg-white p-5 space-y-3">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                ) : rfqs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
                    <Radio size={36} strokeWidth={1.5} className="mx-auto text-slate-300 animate-pulse" />
                    <h4 className="mt-4 text-sm font-semibold text-charcoal-900">No parts request active</h4>
                    <p className="mt-1 text-[13px] text-slate-400 max-w-sm mx-auto">Create a request to broadcast your part requirements to nearby certified vendors instantly.</p>
                    <button onClick={() => setIsCreatingRfq(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700">
                      <Plus size={15} /> Create Parts Request
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rfqs.map((rfq) => {
                      const hasQuotes = rfq.quotes && rfq.quotes.length > 0;
                      const isCompleted = rfq.status === "completed";
                      const isSelected = rfq.status === "selected";
                      
                      // Best quote computation
                      let bestQuote: PartsQuote | undefined;
                      if (hasQuotes) {
                        bestQuote = rfq.quotes!.reduce((prev, curr) => prev.price < curr.price ? prev : curr);
                      }

                      return (
                        <div
                          key={rfq.id}
                          className={`relative rounded-xl bg-white border p-5 flex flex-col justify-between transition-all hover:shadow-card ${
                            rfq.isEmergency 
                              ? "border-red-200 ring-1 ring-red-100" 
                              : "border-slate-100"
                          }`}
                        >
                          {/* Emergency header */}
                          {rfq.isEmergency && (
                            <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider animate-pulse">
                              🚨 Emergency (30m Target)
                            </span>
                          )}

                          <div className="space-y-3.5">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="text-[13.5px] font-bold text-charcoal-900 leading-snug flex items-center gap-1.5">
                                  <Radio size={13} className="text-indigo-600 animate-pulse" /> RFQ #{rfq.id.substring(0, 5).toUpperCase()}
                                </h4>
                                <p className="text-[11.5px] text-slate-400 font-medium mt-0.5">{rfq.vehicleInfo}</p>
                              </div>
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                                rfq.status === "completed" ? "bg-slate-100 text-slate-600" :
                                rfq.status === "selected" ? "bg-emerald-50 text-emerald-700" :
                                rfq.status === "quotes_received" ? "bg-indigo-50 text-indigo-700" :
                                "bg-amber-50 text-amber-700"
                              }`}>
                                {rfq.status.replace("_", " ")}
                              </span>
                            </div>

                            {/* Cart Items List */}
                            <div className="space-y-1.5 bg-slate-50/50 border border-slate-100 rounded-lg p-2.5 max-h-[110px] overflow-y-auto">
                              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Requested Parts Cart ({rfq.items?.length || rfq.qty || 1})</span>
                              {rfq.items && rfq.items.length > 0 ? (
                                rfq.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-[12px] text-slate-600 font-medium">
                                    <span className="truncate max-w-[150px]" title={it.partName}>• {it.partName}</span>
                                    <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">{it.qty}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="flex justify-between items-center text-[12px] text-slate-600 font-medium">
                                  <span className="truncate max-w-[150px]" title={rfq.partName}>• {rfq.partName}</span>
                                  <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">{rfq.qty}</span>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[12px] text-slate-500 font-medium border-t border-b border-slate-50 py-2.5">
                              <div>Urgency: <span className="text-charcoal-900 font-semibold capitalize">{rfq.urgency}</span></div>
                              <div className="truncate">Loc: <span className="text-charcoal-900 font-semibold">{rfq.deliveryLocation}</span></div>
                              <div>Budget: <span className="text-charcoal-900 font-semibold">{rfq.maxBudget ? `₹${(rfq.maxBudget / 100).toLocaleString("en-IN")}` : "Any"}</span></div>
                            </div>

                            {/* matching logs */}
                            <div className="text-[11.5px] rounded-lg bg-slate-50 p-2 text-slate-500 font-medium">
                              {rfq.status === "broadcasted" && (
                                <p className="flex items-center gap-1.5 text-amber-600">
                                  <Radio size={12} className="animate-pulse" /> 📡 Broadcasting in {rfq.searchRadiusKm}km...
                                </p>
                              )}
                              {rfq.status === "quotes_received" && bestQuote && (
                                <p className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                                  <Sparkles size={12} /> Best offer: ₹{(bestQuote.price / 100).toLocaleString("en-IN")} ({bestQuote.brand})
                                </p>
                              )}
                              {isSelected && (
                                <p className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                                  <Check size={12} /> Order Confirmed ({rfq.quotes?.find(q => q.status === "accepted")?.vendorName})
                                </p>
                              )}
                              {isCompleted && (
                                <p className="flex items-center gap-1.5 text-slate-500">
                                  <Check size={12} /> Sourced successfully
                                </p>
                              )}
                            </div>
                          </div>

                          {/* actions block */}
                          <div className="mt-4 flex items-center gap-2">
                            {rfq.status === "quotes_received" && (
                              <button
                                onClick={() => setSelectedRfq(rfq)}
                                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[12.5px] py-2 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <Sparkles size={13} /> Compare Quotes ({rfq.quotes?.length || 0})
                              </button>
                            )}

                            {isSelected && (
                              <button
                                onClick={() => completeOrder(rfq.id)}
                                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[12.5px] py-2 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <Check size={14} /> Mark Completed
                              </button>
                            )}

                            {isCompleted && (
                              <button
                                onClick={() => reorderParts(rfq.id)}
                                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[12.5px] py-2 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <RotateCcw size={13} /> Order Again
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
          </>
        )}
        </div>
      </main>

      {/* Slide-out Sidebar Form: Add/Edit Vendor */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal-950/30 animate-fadeIn">
          <div className="h-full w-full max-w-md bg-white shadow-elevated overflow-y-auto animate-slideLeft">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <h2 className="text-[16px] font-semibold text-charcoal-900">{editId ? "Edit Vendor" : "Add Vendor"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-charcoal-900"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-6 animate-fadeIn">
              <FloatingInput label="Vendor Name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              <FloatingInput label="Contact Number" value={form.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} required />
              <FloatingInput label="Email Address" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <FloatingInput label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
              <FloatingInput label="Google Maps Location URL" value={form.googleMapsUrl || ""} onChange={(e) => set("googleMapsUrl", e.target.value)} placeholder="e.g. https://maps.app.goo.gl/..." />
              <FloatingInput label="GST Number" value={form.gstNumber || ""} onChange={(e) => set("gstNumber", e.target.value)} />
              <FloatingInput label="Years in Business" type="number" value={form.yearsInBusiness ? String(form.yearsInBusiness) : ""} onChange={(e) => setForm(f => ({ ...f, yearsInBusiness: Number(e.target.value) || undefined }))} />
              <FloatingInput label="Specialization (makes/parts)" value={form.specialization || ""} onChange={(e) => set("specialization", e.target.value)} placeholder="e.g. Hyundai, Brake Pads" />
              <FloatingInput label="Return Policy" value={form.returnPolicy || ""} onChange={(e) => set("returnPolicy", e.target.value)} />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} /> <span>{error}</span>
                </div>
              )}
              <button type="submit" disabled={saving} className="mt-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white hover:bg-charcoal-800 disabled:opacity-50 transition-colors">
                {saving ? "Saving..." : editId ? "Save Changes" : "Add Vendor"}
              </button>
            </form>
          </div>
        </div>
      )}



      {/* Quote Comparison Details Modal */}
      {selectedRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/40 p-4 animate-fadeIn">
          <div className="fixed inset-0" onClick={() => setSelectedRfq(null)} />
          <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-elevated overflow-hidden animate-slideUp z-10 flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-[15px] font-bold text-charcoal-900 flex items-center gap-2">
                  <Sparkles className="text-indigo-600" size={16} /> Compare Supplier Quotes (RFQ #{selectedRfq.id.substring(0, 5).toUpperCase()})
                </h3>
                <div className="text-[12px] text-slate-400 mt-0.5 font-semibold flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="text-charcoal-900 font-bold">{selectedRfq.vehicleInfo}</span>
                  <span>•</span>
                  <span>{selectedRfq.deliveryLocation}</span>
                  <span>•</span>
                  <span>
                    Items: {selectedRfq.items?.map(it => `${it.partName} (${it.qty})`).join(", ") || selectedRfq.partName}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedRfq(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Smart Matching statistics */}
            <div className="bg-indigo-50/40 border-b border-indigo-50 px-6 py-3 text-[12.5px] text-indigo-700 font-medium flex items-center gap-2.5">
              <Compass size={16} className="text-indigo-600 shrink-0" />
              <span>
                <strong>Smart vendor matching engine:</strong> Broadcasted to {selectedRfq.quotes?.length || 8} matching suppliers in {selectedRfq.searchRadiusKm} km based on vehicle make specializations and response performance. First quote arrived in 3 mins.
              </span>
            </div>

            {/* Table */}
            <div className="p-6 overflow-auto">
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-3">Vendor / Rating</th>
                      <th className="px-5 py-3">Brand</th>
                      <th className="px-5 py-3">Price</th>
                      <th className="px-5 py-3">Delivery Time</th>
                      <th className="px-5 py-3">Warranty & Policies</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[13px] text-charcoal-900">
                    {!selectedRfq.quotes || selectedRfq.quotes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-medium">No quotes received yet. Sourcing network is broadcasting.</td>
                      </tr>
                    ) : (
                      selectedRfq.quotes.map((quote) => (
                        <tr key={quote.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-4 font-medium whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-semibold text-charcoal-900">{quote.vendorName}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5">⭐ {quote.vendorRating || "4.5"}</span>
                                <span className="text-[11px] text-slate-400">• {quote.vendorYears || 5} yrs in business</span>
                              </div>
                              {quote.vendorGst && (
                                <span className="text-[9.5px] text-slate-400 font-mono mt-0.5">GST: {quote.vendorGst}</span>
                              )}
                              {quote.vendorMapsUrl && (
                                <a href={quote.vendorMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline">
                                  <MapPin size={11} className="shrink-0" /> View Map Location
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap font-medium text-slate-600">{quote.brand}</td>
                          <td className="px-5 py-4 whitespace-nowrap font-bold text-charcoal-900">
                            ₹{(quote.price / 100).toLocaleString("en-IN")}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-indigo-600 font-semibold">{quote.deliveryTime}</td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col text-[11.5px] text-slate-500 leading-normal">
                              <span>🛡️ {quote.warranty || "No warranty"}</span>
                              {quote.vendorReturn && (
                                <span className="text-[10px] text-slate-400 mt-0.5">↩️ {quote.vendorReturn}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            {quote.status === "accepted" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 uppercase">
                                <Check size={11} /> Accepted
                              </span>
                            ) : quote.status === "rejected" ? (
                              <span className="text-slate-400 text-[11.5px] font-medium">Declined</span>
                            ) : (
                              <button
                                onClick={() => chooseQuote(selectedRfq.id, quote)}
                                disabled={selectedRfq.status !== "quotes_received"}
                                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[12px] px-3.5 py-1.5 transition-colors shadow-sm disabled:opacity-50"
                              >
                                Accept & Dispatch
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Toast Overlay */}
      {toast.show && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3.5 text-[13px] font-medium shadow-elevated animate-slideUp text-white ${
          toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast((prev) => ({ ...prev, show: false }))} className="ml-1 hover:opacity-85 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
