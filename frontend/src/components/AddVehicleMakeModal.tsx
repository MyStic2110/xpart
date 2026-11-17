import { useState } from "react";
import { X, Car, Plus } from "lucide-react";
import { api, VehicleMake } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (make: VehicleMake) => void;
}

export default function AddVehicleMakeModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a brand/make name.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const created = await api.createVehicleMake(name.trim());
      setName("");
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create make");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-scaleUp">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-charcoal-900">
              <Car className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-charcoal-900">Add Vehicle Make</h3>
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
            <label className="text-xs font-semibold text-slate-600">Brand / Make Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tata, Mahindra, BYD"
              required
              autoFocus
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-charcoal-900 focus:outline-none focus:ring-1 focus:ring-charcoal-900/10 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
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
              {saving ? "Saving..." : "Create Make"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

