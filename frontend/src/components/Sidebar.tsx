import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useBranch } from "../BranchContext";
import {
  LayoutGrid,
  Inbox,
  ClipboardList,
  CalendarClock,
  Receipt,
  Users,
  MessageSquareHeart,
  Package,
  Boxes,
  Truck,
  Wallet,
  BarChart3,
  Building2,
  SlidersHorizontal,
  UserCog,
  Car,
  CarFront,
  Target,
  Plug,
  Settings,
  ChevronDown,
  Check,
  Gauge,
  CalendarDays,
  Cctv,
  LogOut,
  Stethoscope,
  MapPin,
} from "lucide-react";

const NAV = [
  { label: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
  { label: "Planner", icon: CalendarDays, to: "/calendar" },
  { label: "Enquiry", icon: Inbox, to: "/enquiry" },
  { label: "Job Card", icon: ClipboardList, to: "/job-cards" },
  { label: "Diagnostics", icon: Stethoscope, to: "/diagnostics" },
  { label: "Client 360°", icon: Target, to: "/client-360" },
  { label: "Billing", icon: Receipt, to: "/billing" },
  { label: "Clients", icon: Users, to: "/clients" },
  { label: "Products", icon: Package, to: "/products" },
  { label: "Inventory", icon: Boxes, to: "/inventory" },
  { label: "Vendors", icon: Truck, to: "/vendors" },
  { label: "Garage Map", icon: MapPin, to: "/garage-map" },
  { label: "Expenses", icon: Wallet, to: "/expenses" },
  { label: "Reports", icon: BarChart3, to: "/reports" },
];

const SETTINGS_SUBNAV = [
  { label: "All branches", icon: Building2, to: "/branches" },
  { label: "Staff & mechanics", icon: UserCog, to: "/users" },
  { label: "Vehicle make", icon: Car, to: "/settings/vehicle-makes" },
  { label: "Vehicle model", icon: CarFront, to: "/settings/vehicle-models" },
  { label: "Connectors", icon: Plug, to: "/settings/connectors" },
  { label: "Cameras", icon: Cctv, to: "/settings/cameras" },
  { label: "Software setting", icon: SlidersHorizontal, to: "/settings/software" },
];

export default function Sidebar({ orgName, onLogout }: { orgName: string; onLogout: () => void }) {
  const location = useLocation();
  const settingsActive = SETTINGS_SUBNAV.some((s) => location.pathname.startsWith(s.to));
  const { branchId, setBranchId, branches } = useBranch();
  const [branchOpen, setBranchOpen] = useState(false);

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  return (
    <aside className="hidden md:flex w-64 h-full shrink-0 flex-col border-r border-slate-200/80 bg-white px-4 py-4 z-20 overflow-hidden">
      {/* Brand Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-2.5 px-2 mb-3.5">
          <div className="w-7 h-7 rounded-lg bg-charcoal-900 flex items-center justify-center shrink-0">
            <Gauge size={15} strokeWidth={2} className="text-white" />
          </div>
          <span className="text-[14px] font-semibold text-charcoal-900 tracking-tight truncate">{orgName}</span>
        </div>

        {/* Branch switcher — scopes every operational module to the chosen branch */}
        <div className="mb-3 px-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Viewing</label>
          <div className="mt-1 relative">
            <button
              type="button"
              onClick={() => setBranchOpen((v) => !v)}
              className={`group flex w-full items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 text-left transition-all ${branchOpen ? "border-accent-500 ring-2 ring-accent-500/15" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-charcoal-900 text-white">
                <Building2 size={14} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold leading-tight text-charcoal-900">
                  {selectedBranch ? selectedBranch.name : "All branches"}
                </p>
                <p className="truncate text-[10px] leading-tight text-slate-400">
                  {selectedBranch ? selectedBranch.city : `${branches.length} branch${branches.length === 1 ? "" : "es"}`}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${branchOpen ? "rotate-180 text-accent-600" : "group-hover:text-slate-500"}`}
              />
            </button>

            {branchOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBranchOpen(false)} />
                <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elevated animate-slideUp">
                  <div className="max-h-72 overflow-y-auto p-1.5">
                    <BranchOption
                      label="All branches"
                      sub="Org-wide view"
                      active={branchId === "all"}
                      onClick={() => {
                        setBranchId("all");
                        setBranchOpen(false);
                      }}
                    />
                    {branches.length > 0 && <div className="my-1 h-px bg-slate-100" />}
                    {branches.map((b) => (
                      <BranchOption
                        key={b.id}
                        label={b.name}
                        sub={b.city}
                        active={branchId === b.id}
                        onClick={() => {
                          setBranchId(b.id);
                          setBranchOpen(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Middle Navigation - Scrollable with pinned top and bottom */}
      <nav className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-0.5 custom-scrollbar my-1">
        {NAV.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-left ${isActive
                ? "bg-charcoal-900 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-charcoal-900"
              }`
            }
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Pinned Bottom Navigation */}
      <div className="shrink-0 flex flex-col gap-0.5 pt-2.5 border-t border-slate-100 mt-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors text-left ${isActive || settingsActive || location.pathname.startsWith("/settings")
              ? "bg-charcoal-900 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-50 hover:text-charcoal-900"
            }`
          }
        >
          <Settings size={16} strokeWidth={1.75} />
          Settings
        </NavLink>

        <button
          onClick={onLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut size={16} strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </aside>
  );
}

function BranchOption({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${active ? "bg-accent-500/10" : "hover:bg-slate-50"
        }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-accent-500 text-white" : "bg-slate-100 text-slate-400"
          }`}
      >
        <Building2 size={13} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-medium leading-tight ${active ? "text-accent-700" : "text-charcoal-900"}`}>{label}</p>
        <p className="truncate text-[10.5px] leading-tight text-slate-400">{sub}</p>
      </div>
      {active && <Check size={15} strokeWidth={2.5} className="shrink-0 text-accent-600" />}
    </button>
  );
}
