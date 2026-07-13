import { useState, InputHTMLAttributes } from "react";

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  suffix?: React.ReactNode;
}

// Native date/time/month/week inputs always render their own placeholder
// ("dd-mm-yyyy" etc.) inside the field, even when empty — so the floating
// label must stay pinned to the top for these types, or the two overlap.
const ALWAYS_FILLED_TYPES = new Set(["date", "time", "month", "week", "datetime-local"]);

export default function FloatingInput({ label, error, helperText, id, suffix, ...props }: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id || label.toLowerCase().replace(/\s+/g, "-");
  const filled = Boolean(props.value) || ALWAYS_FILLED_TYPES.has(props.type ?? "text");

  return (
    <div className="w-full">
      <div
        className={`relative rounded-xl border bg-white transition-all duration-200 ${
          error
            ? "border-red-400"
            : focused
              ? "border-accent-500 shadow-[0_0_0_3px_rgba(59,102,245,0.12)]"
              : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <label
          htmlFor={inputId}
          className={`absolute left-4 pointer-events-none transition-all duration-200 ${
            focused || filled
              ? "top-2 text-[11px] font-medium text-slate-400"
              : "top-1/2 -translate-y-1/2 text-[15px] text-slate-400"
          }`}
        >
          {label}
        </label>
        <input
          id={inputId}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          className={`w-full bg-transparent rounded-xl px-4 pt-6 pb-2 text-[15px] text-charcoal-900 placeholder-transparent focus:outline-none ${
            suffix ? "pr-12" : ""
          }`}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center">
            {suffix}
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
}
