import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { api } from "../api";

export default function MultiFileInput({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError("");
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const res = await api.uploadFile(file);
        uploaded.push(res.url);
      }
      onChange([...urls, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="text-[13px] font-medium text-slate-500">Upload Images (Multiple)</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-left text-[13px] text-slate-400 transition-colors hover:border-slate-300"
      >
        <span>{urls.length > 0 ? `${urls.length} file(s) selected` : "No file chosen"}</span>
        {uploading ? <Loader2 size={15} className="animate-spin text-slate-400" /> : <Upload size={15} className="text-slate-300" />}
      </button>
      <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleChange} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {urls.map((url) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((u) => u !== url))}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-charcoal-900 text-white"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
