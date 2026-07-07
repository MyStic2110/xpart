import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Building2,
  UserCog,
  Car,
  CarFront,
  Plug,
  SlidersHorizontal,
  Cctv,
  ChevronRight,
  Settings,
  Tag,
} from "lucide-react";
import { api } from "../api";
import Sidebar from "../components/Sidebar";

const SETTINGS_CARDS = [
  {
    title: "All branches",
    description: "Manage workshop locations, working hours, city, and GST details.",
    icon: Building2,
    to: "/branches",
    color: "text-blue-600 bg-blue-50/60 border-blue-100",
  },
  {
    title: "Staff & mechanics",
    description: "Manage user accounts, assign roles, and set service commission rates.",
    icon: UserCog,
    to: "/users",
    color: "text-emerald-600 bg-emerald-50/60 border-emerald-100",
  },
  {
    title: "Vehicle makes",
    description: "Add and configure global or custom vehicle manufacturers.",
    icon: Car,
    to: "/settings/vehicle-makes",
    color: "text-sky-600 bg-sky-50/60 border-sky-100",
  },
  {
    title: "Vehicle models",
    description: "Map vehicle models to manufacturers and configure their size segment.",
    icon: CarFront,
    to: "/settings/vehicle-models",
    color: "text-purple-600 bg-purple-50/60 border-purple-100",
  },
  {
    title: "Connectors",
    description: "Link third-party messaging (WhatsApp/Gupshup) and telephony APIs.",
    icon: Plug,
    to: "/settings/connectors",
    color: "text-amber-600 bg-amber-50/60 border-amber-100",
  },
  {
    title: "Offers & coupons",
    description: "Configure discount codes, campaign target rules, and track ROI revenue performance.",
    icon: Tag,
    to: "/settings/offers",
    color: "text-rose-600 bg-rose-50/60 border-rose-100",
  },
  {
    title: "Cameras",
    description: "Connect the CCTV/IP cameras at each branch (inside & outside) and run the MediaPipe AI monitor.",
    icon: Cctv,
    to: "/settings/cameras",
    color: "text-violet-600 bg-violet-50/60 border-violet-100",
  },
  {
    title: "Software settings",
    description: "Modify platform preferences, defaults, and system-level parameters.",
    icon: SlidersHorizontal,
    to: "/settings/software",
    color: "text-slate-600 bg-slate-100/60 border-slate-200",
  },
];

export default function SettingsDashboard() {
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("Workspace");

  useEffect(() => {
    api.me()
      .then((me) => setOrgName(me.org.name))
      .catch(() => {});
  }, []);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      <Sidebar orgName={orgName} onLogout={logout} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 sm:px-12 py-10 animate-fadeIn">
          <div className="flex items-center gap-2.5 animate-slideUp">
            <div className="w-8 h-8 rounded-lg bg-charcoal-900 flex items-center justify-center">
              <Settings size={16} strokeWidth={2} className="text-white" />
            </div>
            <div>
              <h1 className="text-[1.75rem] font-semibold text-charcoal-900 tracking-tight">Settings Hub</h1>
              <p className="mt-1 text-[14px] text-slate-400">Configure your workshop operations, staff assignments, and platform preferences.</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-slideUp">
            {SETTINGS_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.title}
                  to={card.to}
                  className="group relative rounded-xl2 border border-slate-100 bg-white p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated flex flex-col justify-between"
                >
                  <div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${card.color} transition-colors duration-200`}>
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <h3 className="mt-4 text-[15px] font-semibold text-charcoal-900 group-hover:text-accent-600 transition-colors duration-200">
                      {card.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                      {card.description}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-end text-slate-400 group-hover:text-accent-600 transition-colors duration-200">
                    <span className="text-[12px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-1.5">Configure</span>
                    <ChevronRight size={15} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
