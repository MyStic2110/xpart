import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
  sub?: string;
  price?: number; // paise or rupees depending on caller
  badge?: string;
  disabled?: boolean;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  allowClear?: boolean;
  formatPrice?: (price: number) => string;
}

export default function SearchCombobox({
  value,
  onChange,
  options,
  placeholder = "Search and select...",
  searchPlaceholder = "Type to search...",
  disabled = false,
  className = "",
  size = "md",
  allowClear = false,
  formatPrice,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState({ left: 0, top: 0, bottom: 0, width: 0, maxHeight: 300, up: false });

  const selected = options.find((o) => o.value === value) ?? null;

  function reposition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const up = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(300, Math.max(140, up ? spaceAbove : spaceBelow));
    setPos({
      left: r.left,
      top: r.bottom + 6,
      bottom: window.innerHeight - r.top + 6,
      width: Math.max(r.width, 240),
      maxHeight,
      up,
    });
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
    if (open) {
      setQuery("");
      setHighlightIdx(0);
      setTimeout(() => searchInputRef.current?.focus(), 20);
    }
  }, [open]);

  const filtered = options.filter((o) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const matchLabel = o.label.toLowerCase().includes(q);
    const matchSub = o.sub?.toLowerCase().includes(q) ?? false;
    const matchBadge = o.badge?.toLowerCase().includes(q) ?? false;
    return matchLabel || matchSub || matchBadge;
  });

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => (prev > 0 ? prev - 1 : Math.max(0, filtered.length - 1)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[highlightIdx];
      if (item && !item.disabled) {
        onChange(item.value);
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
  }

  useEffect(() => {
    if (open && listRef.current) {
      const activeEl = listRef.current.children[highlightIdx] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightIdx, open]);

  const sizeClasses = size === "sm" ? "h-9 px-3 text-[13px]" : "h-10 px-3.5 text-[13.5px]";

  return (
    <div className={`relative inline-block ${className}`} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border transition-all duration-150 text-left ${sizeClasses} ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : open
            ? "border-charcoal-900 ring-2 ring-charcoal-900/10 bg-white shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 shadow-xs"
        }`}
      >
        <span className={`truncate flex-1 font-medium ${selected ? "text-charcoal-900" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {allowClear && selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 hover:text-charcoal-700 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          {selected?.price !== undefined && (
            <span className="text-[12px] font-semibold text-charcoal-700 font-mono">
              {formatPrice ? formatPrice(selected.price) : `₹${selected.price}`}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              style={{
                position: "fixed",
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
                ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }),
              }}
              className="z-50 flex flex-col rounded-xl border border-slate-200/90 bg-white shadow-xl animate-fadeIn overflow-hidden"
            >
              {/* Search Header */}
              <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-charcoal-900 focus:ring-1 focus:ring-charcoal-900/10 placeholder:text-slate-400"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2 p-0.5 text-slate-400 hover:text-charcoal-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options List */}
              <div ref={listRef} className="flex-1 overflow-y-auto p-1 divide-y divide-slate-50 custom-scrollbar">
                {filtered.length === 0 ? (
                  <div className="py-6 px-3 text-center text-xs text-slate-400">
                    No matching results found for "{query}"
                  </div>
                ) : (
                  filtered.map((item, idx) => {
                    const isSelected = item.value === value;
                    const isHighlighted = idx === highlightIdx;
                    return (
                      <div
                        key={item.value}
                        onClick={() => {
                          if (item.disabled) return;
                          onChange(item.value);
                          setOpen(false);
                          triggerRef.current?.focus();
                        }}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        className={`flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
                          item.disabled
                            ? "opacity-40 cursor-not-allowed"
                            : isHighlighted
                            ? "bg-slate-100 text-charcoal-900 font-medium"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`truncate ${isSelected ? "font-bold text-charcoal-900" : ""}`}>
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.sub && <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.sub}</p>}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.price !== undefined && (
                            <span className="text-xs font-semibold font-mono text-charcoal-900">
                              {formatPrice ? formatPrice(item.price) : `₹${item.price}`}
                            </span>
                          )}
                          {isSelected && <Check className="h-3.5 w-3.5 text-accent-600" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

