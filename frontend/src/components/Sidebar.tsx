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
  Bell,
} from "lucide-react";
import { api, Notification } from "../api";

const NAV = [
  { label: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
  { label: "Planner", icon: CalendarDays, to: "/calendar" },
  { label: "Enquiry", icon: Inbox, to: "/enquiry" },
  { label: "Job Card", icon: ClipboardList, to: "/job-cards" },
  { label: "Client 360°", icon: Target, to: "/client-360" },
  { label: "Billing", icon: Receipt, to: "/billing" },
  { label: "Clients", icon: Users, to: "/clients" },
  { label: "Feedbacks", icon: MessageSquareHeart, to: "/feedbacks" },
  { label: "Products", icon: Package, to: "/products" },
  { label: "Inventory", icon: Boxes, to: "/inventory" },
  { label: "Vendors", icon: Truck, to: "/vendors" },
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

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  useEffect(() => {
    function load() {
      api.listNotifications().then(setNotifications).catch(() => {});
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <aside className="hidden md:flex w-64 flex-col justify-between border-r border-slate-100 bg-white px-4 py-6">
      <div>
        <div className="flex items-center justify-between px-2 mb-4 relative">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-charcoal-900 flex items-center justify-center shrink-0">
              <Gauge size={15} strokeWidth={2} className="text-white" />
            </div>
            <span className="text-[14px] font-semibold text-charcoal-900 tracking-tight truncate max-w-[110px]">{orgName}</span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-1.5 rounded-lg hover:bg-slate-50 transition-colors shrink-0 ${showNotifications ? "bg-slate-50 text-charcoal-900" : "text-slate-400"}`}
            >
              <Bell size={16} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
              )}
            </button>

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute left-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-elevated z-50 overflow-hidden animate-slideUp">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/50">
                    <span className="text-[12px] font-semibold text-charcoal-900">Notifications ({unreadCount} unread)</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.markAllNotificationsRead();
                            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                          } catch {}
                        }}
                        className="text-[11px] font-bold text-accent-700 hover:underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-[12px]">
                        <Bell size={20} strokeWidth={1.5} className="mx-auto text-slate-300 mb-1.5" />
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map((n) => {
                        let Icon = Bell;
                        let iconColor = "text-slate-400 bg-slate-50 border-slate-100";
                        if (n.type === "enquiry") {
                          Icon = Inbox;
                          iconColor = "text-sky-500 bg-sky-50 border-sky-100";
                        } else if (n.type === "payment") {
                          Icon = Receipt;
                          iconColor = "text-emerald-500 bg-emerald-50 border-emerald-100";
                        } else if (n.type === "feedback") {
                          Icon = MessageSquareHeart;
                          iconColor = "text-rose-500 bg-rose-50 border-rose-100";
                        }

                        return (
                          <div
                            key={n.id}
                            onClick={async () => {
                              if (!n.isRead) {
                                try {
                                  await api.markNotificationRead(n.id);
                                  setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, isRead: true } : item));
                                } catch {}
                              }
                            }}
                            className={`flex items-start gap-3 p-3.5 text-left text-[12.5px] cursor-pointer transition-colors ${
                              n.isRead ? "bg-white hover:bg-slate-50" : "bg-sky-50/[0.12] hover:bg-sky-50/[0.2] border-l-2 border-sky-400 pl-3"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${iconColor}`}>
                              <Icon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`font-semibold text-charcoal-900 leading-tight ${n.isRead ? "" : "text-sky-950 font-bold"}`}>{n.title}</p>
                              <p className="mt-0.5 text-slate-500 text-[11.5px] leading-snug break-words">{n.message}</p>
                              <p className="mt-1 text-slate-400 text-[10px]">{new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Branch switcher — scopes every operational module to the chosen branch */}
        <div className="mb-6 px-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Viewing</label>
          <div className="mt-1.5 relative">
            <button
              type="button"
              onClick={() => setBranchOpen((v) => !v)}
              className={`group flex w-full items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 text-left transition-all ${
                branchOpen ? "border-accent-500 ring-2 ring-accent-500/15" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-charcoal-900 text-white">
                <Building2 size={15} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-charcoal-900">
                  {selectedBranch ? selectedBranch.name : "All branches"}
                </p>
                <p className="truncate text-[10.5px] leading-tight text-slate-400">
                  {selectedBranch ? selectedBranch.city : `${branches.length} branch${branches.length === 1 ? "" : "es"}`}
                </p>
              </div>
              <ChevronDown
                size={15}
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

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors text-left ${
                  isActive
                    ? "bg-charcoal-900 text-white"
                    : "text-slate-400 hover:bg-slate-50 hover:text-charcoal-900"
                }`
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors text-left ${
              isActive || settingsActive || location.pathname.startsWith("/settings")
                ? "bg-charcoal-900 text-white"
                : "text-slate-400 hover:bg-slate-50 hover:text-charcoal-900"
            }`
          }
        >
          <Settings size={16} strokeWidth={1.75} />
          Settings
        </NavLink>

        <button
          onClick={onLogout}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-red-500 mt-1"
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
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
        active ? "bg-accent-500/10" : "hover:bg-slate-50"
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-accent-500 text-white" : "bg-slate-100 text-slate-400"
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
