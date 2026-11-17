import { useState, useEffect } from "react";
import { X, Car, Plus } from "lucide-react";
import { api, VehicleMake, VehicleModel } from "../api";
import Dropdown from "./Dropdown";

interface Props {
  open: boolean;
  onClose: () => void;
  makes: VehicleMake[];
  defaultMakeId?: string;
  onCreated: (model: VehicleModel) => void;
}

const SEGMENTS = [
  { value: "Small", label: "Small (Hatchback)" },
  { value: "Medium", label: "Medium (Sedan / Compact SUV)" },
  { value: "Large", label: "Large (Midsize SUV)" },
  { value: "XL / Premium", label: "XL / Premium / Luxury" },
  { value: "Small Bike", label: "Small Bike / Scooter" },
  { value: "Super Bikes", label: "Super Bikes" },
  { value: "All", label: "All / Generic" },
];

export default function AddVehicleModelModal({ open, onClose, makes, defaultMakeId = "", onCreated }: Props) {
  const [makeId, setMakeId] = useState(defaultMakeId);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("Medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMakeId(defaultMakeId || (makes[0]?.id ?? ""));
      setName("");
      setSegment("Medium");
      setError("");
    }
  }, [open, defaultMakeId, makes]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!makeId) {
      setError("Please select a make/brand.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a model name.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const created = await api.createVehicleModel({
        makeId,
        name: name.trim(),
        segment,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create model");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleUp">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-charcoal-900">
              <Car className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-charcoal-900">Add New Car / Vehicle Model</h3>
              <p className="text-[11px] text-slate-400">Add to your workshop's vehicle catalogue</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-charcoal-900 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600">Vehicle Make / Brand *</label>
            <Dropdown
              value={makeId}
              onChange={setMakeId}
              placeholder="Select make"
              className="mt-1.5 w-full"
              options={makes.map((m) => ({ value: m.id, label: m.name }))}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Model Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Curvv, Thar Roxx, Exter, Fronx"
              required
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-charcoal-900 focus:outline-none focus:ring-1 focus:ring-charcoal-900/10 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Vehicle Segment / Size *</label>
            <Dropdown
              value={segment}
              onChange={setSegment}
              placeholder="Select segment"
              className="mt-1.5 w-full"
              options={SEGMENTS}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-charcoal-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-charcoal-800 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Add Model"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

