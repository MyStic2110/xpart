import { useRef, useState } from "react";
import { Upload, Check, Loader2 } from "lucide-react";
import { api } from "../api";

export default function FileInput({
  label,
  onUploaded,
}: {
  label: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setDone(false);
    setUploading(true);
    try {
      const res = await api.uploadFile(file);
      onUploaded(res.url);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="text-[13px] font-medium text-slate-500">{label}</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-left text-[13px] text-slate-400 transition-colors hover:border-slate-300"
      >
        <span className="truncate">{fileName || "No file chosen"}</span>
        {uploading ? (
          <Loader2 size={15} className="animate-spin text-slate-400" />
        ) : done ? (
          <Check size={15} className="text-emerald-500" />
        ) : (
          <Upload size={15} className="text-slate-300" />
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={handleChange} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
