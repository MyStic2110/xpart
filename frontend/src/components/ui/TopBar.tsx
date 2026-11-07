import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  ChevronDown,
  User,
  LogOut,
  Menu,
  X,
  Inbox,
  Receipt,
  Check,
} from "lucide-react";
import { api, Notification, MeResponse } from "../../api";
import { useBranch } from "../../BranchContext";
import { cn } from "../../lib/utils";

export interface TopBarProps {
  title?: string;
  subtitle?: string;
  onToggleMobileNav?: () => void;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, onToggleMobileNav, actions }: TopBarProps) {
  const navigate = useNavigate();
  const { branchId, setBranchId, branches } = useBranch();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [branchDropdown, setBranchDropdown] = useState(false);

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
    api.listNotifications().then(setNotifications).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 sm:px-10 backdrop-blur-md">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3.5 min-w-0">
        {onToggleMobileNav && (
          <button
            onClick={onToggleMobileNav}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 md:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          {title && <h1 className="text-lg font-semibold tracking-tight text-charcoal-900 truncate">{title}</h1>}
          {subtitle && <p className="text-xs text-slate-400 hidden sm:block truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Right: Actions, Branch pill, Notifications, User menu */}
      <div className="flex items-center gap-3">
        {actions}

        {/* Branch Quick Switcher Pill */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setBranchDropdown((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs font-medium text-charcoal-900 hover:bg-slate-100 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <span className="truncate max-w-[130px] font-semibold">
              {selectedBranch ? selectedBranch.name : "All branches"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {branchDropdown && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setBranchDropdown(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated z-40 animate-slideUp">
                <button
                  type="button"
                  onClick={() => {
                    setBranchId("all");
                    setBranchDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    branchId === "all" ? "bg-accent-500/10 text-accent-700" : "hover:bg-slate-50 text-charcoal-900"
                  )}
                >
                  <div>
                    <p className="font-semibold">All branches</p>
                    <p className="text-[11px] text-slate-400">Org-wide operational view</p>
                  </div>
                  {branchId === "all" && <Check className="h-4 w-4 text-accent-600" />}
                </button>
                <div className="my-1 h-px bg-slate-100" />
                {branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBranchId(b.id);
                      setBranchDropdown(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                      branchId === b.id ? "bg-accent-500/10 text-accent-700" : "hover:bg-slate-50 text-charcoal-900"
                    )}
                  >
                    <div>
                      <p className="font-semibold">{b.name}</p>
                      <p className="text-[11px] text-slate-400">{b.city}</p>
                    </div>
                    {branchId === b.id && <Check className="h-4 w-4 text-accent-600" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((prev) => !prev)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-elevated z-40 overflow-hidden animate-slideUp">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70">
                  <span className="text-xs font-bold text-charcoal-900">
                    Notifications ({unreadCount} unread)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await api.markAllNotificationsRead();
                          setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                        } catch {}
                      }}
                      className="text-[11px] font-bold text-accent-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 p-3.5 text-xs transition-colors cursor-pointer",
                          n.isRead ? "bg-white hover:bg-slate-50" : "bg-sky-50/20 hover:bg-sky-50/30"
                        )}
                        onClick={async () => {
                          if (!n.isRead) {
                            try {
                              await api.markNotificationRead(n.id);
                              setNotifications((prev) =>
                                prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
                              );
                            } catch {}
                          }
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-charcoal-900">{n.title}</p>
                          <p className="mt-0.5 text-slate-500 leading-snug">{n.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Avatar Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-charcoal-900 text-white font-semibold text-xs tracking-wider shadow-sm hover:bg-charcoal-800 transition-colors"
          >
            {me?.user.name ? me.user.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-elevated z-40 animate-slideUp">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-charcoal-900 truncate">{me?.user.name || "Owner"}</p>
                  <p className="text-[11px] text-slate-400 truncate">{me?.user.phone || ""}</p>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-charcoal-900 hover:bg-slate-50 transition-colors mt-1"
                >
                  Workshop Settings
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default TopBar;

