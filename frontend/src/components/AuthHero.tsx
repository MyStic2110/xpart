import { Sparkles, ShieldCheck, Gauge } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function AuthHero() {
  const [branding, setBranding] = useState<{
    name: string;
    salonName: string | null;
    logoUrl: string | null;
    loginBgUrl: string | null;
  } | null>(null);
  const [bgFailed, setBgFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    api.getBranding().then(setBranding).catch(() => {});
  }, []);

  const businessName = branding?.salonName || branding?.name || "Xpart Automotive";

  return (
    <div className="relative hidden lg:flex lg:w-[58%] h-full overflow-hidden bg-charcoal-950">
      {/* Background layer */}
      {branding?.loginBgUrl && !bgFailed ? (
        <div className="absolute inset-0">
          <img
            src={branding.loginBgUrl}
            alt="Workshop background"
            onError={() => setBgFailed(true)}
            className="h-full w-full object-cover object-center"
          />
          {/* Studio darkening gradient to guarantee contrast and readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/75 to-charcoal-950/50" />
        </div>
      ) : (
        /* Abstract studio-light backdrop: soft radial glows evoking a detailing bay, no stock imagery needed */
        <div className="absolute inset-0">
          <div className="absolute -top-32 -left-20 w-[34rem] h-[34rem] rounded-full bg-accent-500/20 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-slate-400/10 blur-[110px]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          {/* polished surface reflection strip */}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-charcoal-900/80 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex flex-col justify-between p-14 w-full text-white">
        <div className="flex items-center gap-2.5 animate-fadeIn">
          {branding?.logoUrl && !logoFailed ? (
            <div className="h-9 max-w-[160px] flex items-center justify-center">
              <img
                src={branding.logoUrl}
                alt={businessName}
                onError={() => setLogoFailed(true)}
                className="max-h-9 max-w-[160px] object-contain rounded"
              />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
              <Gauge size={18} strokeWidth={2} className="text-white" />
            </div>
          )}
          <span className="text-[15px] font-semibold tracking-tight">{businessName}</span>
        </div>

        <div className="max-w-md animate-slideUp">
          <h1 className="text-[2.5rem] leading-[1.15] font-semibold tracking-tight">
            One workspace for every bay, every branch, every customer.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-slate-300">
            Run wash, detailing, PPF, and service operations across cities from a single
            intelligent platform built for premium automotive businesses.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <ShieldCheck size={17} strokeWidth={1.75} className="text-accent-400" />
              <span>Enterprise-grade reliability, built for daily operations</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Sparkles size={17} strokeWidth={1.75} className="text-accent-400" />
              <span>Designed with workshop owners across India</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500">© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
      </div>
    </div>
  );
}
