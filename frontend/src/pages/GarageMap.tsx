import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Search,
  Compass,
  Star,
  Phone,
  Globe,
  Upload,
  Activity,
  AlertTriangle,
  Layers,
  Wrench,
  Shield,
} from "lucide-react";
import { api } from "../api";
import { useBranch } from "../BranchContext";
import Sidebar from "../components/Sidebar";

interface GarageRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  website: string | null;
  serviceRadiusKm: number;
  rating: number | null;
  reviewCount: number;
  claimed: boolean;
  verified: boolean;
}

interface OpportunityGap {
  area: string;
  gapType: string;
  description: string;
  priority: "High" | "Medium" | "Low";
  score: number;
}

interface CompetitionPoint {
  garageId: string;
  name: string;
  latitude: number;
  longitude: number;
  competitorCount: number;
  densityLevel: string;
}

export default function GarageMap() {
  const { branchParam } = useBranch();
  const [orgName, setOrgName] = useState("Workspace");
  const [garages, setGarages] = useState<GarageRecord[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityGap[]>([]);
  const [competition, setCompetition] = useState<CompetitionPoint[]>([]);
  const [city, setCity] = useState("Chennai");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGarage, setSelectedGarage] = useState<GarageRecord | null>(null);
  
  // Importer state
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [loading, setLoading] = useState(true);

  // Map view layers: "coverage" | "density"
  const [mapLayer, setMapLayer] = useState<"coverage" | "density">("coverage");

  // Leaflet references
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    api.me().then((me) => setOrgName(me.org.name)).catch(() => {});
  }, []);

  // 1. Dynamic script loader for Leaflet
  useEffect(() => {
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(cssLink);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // 2. Fetch data from backend
  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch garages list
      const res = await api.rawRequest<any>(`/garages?city=${city}&limit=100`);
      setGarages(res.data || []);

      // Fetch opportunities
      const oppRes = await api.rawRequest<any>(`/garages/opportunities?city=${city}`);
      setOpportunities(oppRes.opportunities || []);

      // Fetch competition
      const compRes = await api.rawRequest<any>(`/garages/competition?city=${city}`);
      setCompetition(compRes.densityPoints || []);
    } catch (err) {
      console.error("Failed to load map listings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [city]);

  // 3. Initialize and Update Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || !document.getElementById("map-element")) return;
    const L = (window as any).L;
    if (!L) return;

    // Initialize map if not yet done
    if (!mapRef.current) {
      mapRef.current = L.map("map-element").setView([13.0827, 80.2707], 13); // Default Chennai center
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Close any open popups first to avoid Leaflet reference crashes
    map.closePopup();

    // Clear old markers and circles
    markersRef.current.forEach((m) => m.remove());
    circlesRef.current.forEach((c) => c.remove());
    markersRef.current = [];
    circlesRef.current = [];

    if (garages.length === 0) return;

    // Determine center coord
    const centerLat = parseFloat(garages[0].latitude as any);
    const centerLon = parseFloat(garages[0].longitude as any);
    if (!isNaN(centerLat) && !isNaN(centerLon)) {
      map.setView([centerLat, centerLon], 13);
    }

    // Color mapper for categories
    const getLayerColors = (category: string) => {
      const cat = category.toLowerCase();
      if (cat.includes("ev")) return { color: "#10b981", fill: "rgba(16, 185, 129, 0.15)" }; // Green
      if (cat.includes("luxury")) return { color: "#8b5cf6", fill: "rgba(139, 92, 246, 0.15)" }; // Purple
      if (cat.includes("tyre")) return { color: "#f59e0b", fill: "rgba(245, 158, 11, 0.15)" }; // Amber
      if (cat.includes("bike")) return { color: "#4f46e5", fill: "rgba(79, 70, 229, 0.15)" }; // Indigo
      return { color: "#3b82f6", fill: "rgba(59, 130, 246, 0.15)" }; // Blue standard
    };

    // Render depending on mode
    if (mapLayer === "coverage") {
      garages.forEach((g) => {
        const lat = parseFloat(g.latitude as any);
        const lon = parseFloat(g.longitude as any);
        if (isNaN(lat) || isNaN(lon)) return;

        // Find category from mock categorization
        const nameLower = g.name.toLowerCase();
        let cat = "Car Garage";
        if (nameLower.includes("ev") || nameLower.includes("electric")) cat = "EV Garage";
        else if (nameLower.includes("bike") || nameLower.includes("motorcycle")) cat = "Bike Garage";
        else if (nameLower.includes("german") || nameLower.includes("elite")) cat = "Luxury Garage";
        else if (nameLower.includes("tyre") || nameLower.includes("alignment")) cat = "Tyre Shop";

        const colors = getLayerColors(cat);

        // Service Coverage Circle
        const circle = L.circle([lat, lon], {
          color: colors.color,
          fillColor: colors.fill,
          fillOpacity: 0.5,
          radius: g.serviceRadiusKm * 1000, // in meters
          weight: 1.5,
        }).addTo(map);
        circlesRef.current.push(circle);

        // Marker
        const marker = L.marker([lat, lon])
          .addTo(map)
          .bindPopup(
            `<b>${g.name}</b><br/>` +
            `<span style="font-size: 11.5px;color: #64748b">${cat}</span><br/>` +
            `Service Radius: ${g.serviceRadiusKm} km<br/>` +
            `Rating: ★ ${g.rating?.toFixed(1) || "4.5"}`
          );
        
        marker.on("click", () => {
          setSelectedGarage(g);
        });

        markersRef.current.push(marker);
      });
    } else {
      // Competition density mapping view
      competition.forEach((cp) => {
        const lat = parseFloat(cp.latitude as any);
        const lon = parseFloat(cp.longitude as any);
        if (isNaN(lat) || isNaN(lon)) return;

        const isCritical = cp.competitorCount >= 5;
        const color = isCritical ? "#ef4444" : cp.competitorCount >= 3 ? "#f97316" : "#eab308";
        const fill = isCritical ? "rgba(239, 68, 68, 0.25)" : "rgba(249, 115, 22, 0.25)";

        const circle = L.circle([lat, lon], {
          color,
          fillColor: fill,
          fillOpacity: 0.6,
          radius: 1200, // Bounding footprint
          weight: 2,
        }).addTo(map);
        circlesRef.current.push(circle);

        const marker = L.marker([lat, lon])
          .addTo(map)
          .bindPopup(
            `<b>${cp.name}</b><br/>` +
            `Competitors in 3km: <b>${cp.competitorCount}</b><br/>` +
            `Density Level: <span style="font-weight:bold;color:${color}">${cp.densityLevel}</span>`
          );

        markersRef.current.push(marker);
      });
    }

  }, [leafletLoaded, garages, mapLayer, competition]);

  // Center map around a specific garage
  const focusOnGarage = (g: GarageRecord) => {
    setSelectedGarage(g);
    if (mapRef.current && leafletLoaded) {
      mapRef.current.setView([g.latitude, g.longitude], 15);
      // Find matching marker and open popup
      const idx = garages.findIndex((item) => item.id === g.id);
      if (idx !== -1 && markersRef.current[idx]) {
        markersRef.current[idx].openPopup();
      }
    }
  };

  // OSM Import request
  const handleOSMImport = async () => {
    setImporting(true);
    setImportNotice("");
    try {
      const res = await api.rawRequest<any>("/garages/import", {
        method: "POST",
        body: JSON.stringify({ city }),
      });
      setImportNotice(`Import complete! ${res.message}`);
      loadData();
    } catch (err: any) {
      setImportNotice(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const filteredGarages = garages.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.address ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (g.pincode ?? "").includes(searchQuery)
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar orgName={orgName} onLogout={() => {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }} />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header bar */}
        <div className="border-b border-slate-100 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-charcoal-900 flex items-center gap-2">
              <Compass className="text-indigo-600 animate-spin-slow" size={20} />
              Automotive GIS Sourcing Map
            </h1>
            <p className="text-[12px] text-slate-400">
              Interactive OpenStreetMap-powered service coverage and AI density opportunities analyzer
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* City/Pincode input */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="text-[11.5px] text-slate-400 font-semibold uppercase">Search Area:</span>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City or 6-digit Pincode"
                className="text-[13px] font-bold text-charcoal-900 bg-transparent border-none outline-none w-44"
              />
            </div>

            {/* Live OSM Importer Button */}
            <button
              onClick={handleOSMImport}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-charcoal-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Upload size={13} />
              {importing ? "Importing OSM..." : "Import OSM Locations"}
            </button>
          </div>
        </div>

        {importNotice && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-2.5 text-[12.5px] text-indigo-700 font-medium flex items-center justify-between">
            <span>{importNotice}</span>
            <button onClick={() => setImportNotice("")} className="text-indigo-400 hover:text-indigo-900 font-bold">×</button>
          </div>
        )}

        {/* Workspace body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: List & AI analytics */}
          <div className="w-80 border-r border-slate-100 bg-white flex flex-col h-full overflow-hidden shrink-0">
            {/* Layer switcher */}
            <div className="p-4 border-b border-slate-50 flex gap-2">
              <button
                onClick={() => setMapLayer("coverage")}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-bold border transition-colors ${
                  mapLayer === "coverage"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Layers size={12} /> Coverage Radius
              </button>
              <button
                onClick={() => setMapLayer("density")}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-bold border transition-colors ${
                  mapLayer === "density"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Activity size={12} /> Comp Density
              </button>
            </div>

            {/* List search */}
            <div className="p-4 border-b border-slate-50 relative shrink-0">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search local garages..."
                className="w-full pl-9 pr-3 py-2 text-[12.5px] border border-slate-200 rounded-xl outline-none focus:border-indigo-400"
              />
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {loading ? (
                <div className="py-12 text-center text-[13px] text-slate-400">Loading directories...</div>
              ) : filteredGarages.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-slate-400">No garages found. Import from OSM.</div>
              ) : (
                filteredGarages.map((g) => {
                  const isSel = selectedGarage?.id === g.id;
                  
                  // Category prediction for listing
                  const nameLower = g.name.toLowerCase();
                  let cat = "Car Garage";
                  let catColor = "bg-blue-50 text-blue-700 border-blue-100";
                  if (nameLower.includes("ev") || nameLower.includes("electric")) {
                    cat = "EV Garage";
                    catColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                  } else if (nameLower.includes("bike") || nameLower.includes("motorcycle")) {
                    cat = "Bike Garage";
                    catColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                  } else if (nameLower.includes("german") || nameLower.includes("elite")) {
                    cat = "Luxury Garage";
                    catColor = "bg-violet-50 text-violet-700 border-violet-100";
                  } else if (nameLower.includes("tyre") || nameLower.includes("alignment")) {
                    cat = "Tyre Shop";
                    catColor = "bg-amber-50 text-amber-700 border-amber-100";
                  }

                  return (
                    <div
                      key={g.id}
                      onClick={() => focusOnGarage(g)}
                      className={`p-3.5 rounded-xl2 border cursor-pointer transition-all ${
                        isSel
                          ? "border-indigo-500 bg-indigo-50/20 shadow-sm"
                          : "border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="text-[13px] font-bold text-charcoal-900 leading-snug line-clamp-1">{g.name}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold border uppercase ${catColor}`}>{cat}</span>
                      </div>
                      <p className="text-[11.5px] text-slate-400 mt-1 line-clamp-1">{g.address || "No address listed"}</p>
                      
                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 pt-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-0.5 font-semibold text-amber-600">
                          <Star size={10} fill="currentColor" /> {g.rating?.toFixed(1) || "4.5"} ({g.reviewCount})
                        </span>
                        <span className="font-semibold text-indigo-700 bg-indigo-50/50 px-1.5 py-0.5 rounded">
                          Radius: {g.serviceRadiusKm} km
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* AI Opportunities Sub-footer */}
            {opportunities.length > 0 && (
              <div className="bg-gradient-to-br from-violet-50/60 to-white border-t border-violet-100 p-4 shrink-0 max-h-56 overflow-y-auto">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-violet-700 flex items-center gap-1 mb-2">
                  <Activity size={12} /> AI Sourcing Market Gaps
                </p>
                <div className="space-y-2">
                  {opportunities.slice(0, 2).map((opp, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-2.5 border border-violet-100 shadow-sm">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-charcoal-900">{opp.gapType}</span>
                        <span className="font-bold text-red-500 text-[10px] bg-red-50 px-1.5 rounded">Score: {opp.score}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">{opp.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Area: Leaflet Map */}
          <div className="flex-1 relative h-full bg-slate-100">
            {!leafletLoaded ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50">
                <Activity size={24} className="text-indigo-600 animate-pulse" />
                <span className="text-[13px] font-medium text-slate-400">Loading OpenStreetMap Canvas...</span>
              </div>
            ) : (
              <>
                <div id="map-element" className="w-full h-full" style={{ zIndex: 10 }} />
                
                {/* Floating Legend Overlay */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-xl2 border border-slate-200 p-3.5 shadow-sm z-40 w-48 pointer-events-auto">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <Layers size={11} className="text-slate-400" /> Map Legend
                  </h5>
                  {mapLayer === "coverage" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#10b981] bg-[#10b981]/20 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">EV Garages</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#8b5cf6] bg-[#8b5cf6]/20 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">Luxury Specialists</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#f59e0b] bg-[#f59e0b]/20 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">Tyre Shops</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#4f46e5] bg-[#4f46e5]/20 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">Bike Repair</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#3b82f6] bg-[#3b82f6]/20 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">Car Garages</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#ef4444] bg-[#ef4444]/25 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">Critical (5+ Comp)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#f97316] bg-[#f97316]/25 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">High (3-4 Comp)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-[#eab308] bg-[#eab308]/25 shrink-0" />
                        <span className="text-[11.5px] font-medium text-slate-600">Moderate (1-2 Comp)</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Floating selected garage info overlay */}
            {selectedGarage && (
              <div className="absolute bottom-5 left-5 right-5 md:right-auto md:w-96 bg-white rounded-xl2 border border-slate-100 p-4 shadow-elevated z-50 animate-slideUp">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-[14px] font-bold text-charcoal-900">{selectedGarage.name}</h4>
                    <p className="text-[12px] text-slate-400 mt-0.5">{selectedGarage.address}</p>
                  </div>
                  <button onClick={() => setSelectedGarage(null)} className="text-slate-400 hover:text-slate-900 font-bold">×</button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  {selectedGarage.phone && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Phone size={12} className="text-slate-400" />
                      <span>{selectedGarage.phone}</span>
                    </div>
                  )}
                  {selectedGarage.website && (
                    <div className="flex items-center gap-1.5 text-indigo-600 truncate">
                      <Globe size={12} className="text-indigo-400" />
                      <a href={selectedGarage.website} target="_blank" rel="noreferrer" className="hover:underline truncate">{selectedGarage.website}</a>
                    </div>
                  )}
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-slate-50 pt-3">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded px-1.5 py-0.5 font-bold">
                      Coverage: {selectedGarage.serviceRadiusKm} KM
                    </span>
                  </div>
                  <Link
                    to={`/vendors`}
                    className="rounded-lg bg-charcoal-900 text-white font-semibold text-[11.5px] px-3 py-1.5 hover:bg-charcoal-800 transition-colors shadow-sm"
                  >
                    View Supplier Ledger
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
