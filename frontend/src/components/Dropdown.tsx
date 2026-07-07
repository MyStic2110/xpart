import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  sub?: string; // optional secondary line
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string; // wrapper — use for width (e.g. "w-40", "w-full")
  size?: "sm" | "md";
  capitalize?: boolean;
  ariaLabel?: string;
  // "bare" drops the default bordered-box trigger styling so callers can render
  // a custom trigger (e.g. a colored status pill) via triggerClassName. The menu
  // stays the same modern panel.
  bare?: boolean;
  triggerClassName?: string;
}

// A modern, dependency-free replacement for native <select>. The menu renders in
// a portal with fixed positioning anchored to the trigger, so it never clips
// inside cards, drawers, table rows, or overflow-scroll containers. Flips above
// the trigger when there isn't room below. Closes on select / outside / Escape.
export default function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled,
  className = "",
  size = "md",
  capitalize,
  ariaLabel,
  bare,
  triggerClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, bottom: 0, width: 0, maxHeight: 288, up: false });

  const selected = options.find((o) => o.value === value) ?? null;

  function reposition() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const up = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(288, Math.max(120, up ? spaceAbove : spaceBelow));
    setPos({ left: r.left, top: r.bottom + 6, bottom: window.innerHeight - r.top + 6, width: r.width, maxHeight, up });
  }

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const handler = () => reposition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pad = size === "sm" ? "px-3 py-2 text-[13px]" : "px-3.5 py-2.5 text-[13.5px]";
  const triggerCls = bare
    ? `flex items-center justify-between gap-1 ${triggerClassName}`
    : `flex w-full items-center justify-between gap-2 rounded-xl border bg-white text-left font-medium transition-all disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 ${pad} ${
        open ? "border-accent-500 ring-2 ring-accent-500/15" : "border-slate-200 hover:border-slate-300"
      }`;

  return (
    <div className={`relative ${bare ? "inline-block" : ""} ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={triggerCls}
      >
        <span className={`truncate ${bare ? "" : selected ? "text-charcoal-900" : "text-slate-400"} ${capitalize ? "capitalize" : ""}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={bare ? 12 : 15}
          className={`shrink-0 ${bare ? "" : "text-slate-400"} transition-transform duration-200 ${open ? "rotate-180" : ""} ${open && !bare ? "text-accent-600" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
            <div
              role="listbox"
              className="fixed z-[61] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elevated animate-slideUp"
              style={{
                left: pos.left,
                width: pos.width,
                minWidth: 184,
                ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }),
              }}
            >
              <div className="overflow-y-auto p-1.5" style={{ maxHeight: pos.maxHeight }}>
                {options.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[12px] text-slate-400">No options</p>
                ) : (
                  options.map((o) => {
                    const active = o.value === value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={o.disabled}
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          active ? "bg-accent-500/10" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate font-medium leading-tight ${active ? "text-accent-700" : "text-charcoal-900"} ${
                              capitalize ? "capitalize" : ""
                            }`}
                          >
                            {o.label}
                          </p>
                          {o.sub && <p className="truncate text-[10.5px] leading-tight text-slate-400">{o.sub}</p>}
                        </div>
                        {active && <Check size={15} strokeWidth={2.5} className="shrink-0 text-accent-600" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
