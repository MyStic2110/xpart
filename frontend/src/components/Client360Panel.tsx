import { Wallet, Star, User } from "lucide-react";
import { Client360 } from "../api";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-[13px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-charcoal-900">{value ?? "----"}</span>
    </div>
  );
}

export default function Client360Panel({ data }: { data: Client360 | null }) {
  const v = data ?? {
    branch: null,
    lastVisitOn: null,
    totalVisits: 0,
    totalSpendings: 0,
    membership: null,
    activePackages: null,
    walletBalance: 0,
    rewardPoints: 0,
    gender: "----",
    dateOfBirth: null,
    anniversary: null,
    sourceOfClient: null,
  };

  return (
    <div className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card sticky top-6">
      <div className="flex items-center gap-2 mb-3">
        <User size={16} className="text-slate-400" />
        <h3 className="text-[15px] font-semibold text-charcoal-900">Client 360° view</h3>
      </div>
      <div className="divide-y divide-slate-100">
        <Row label="Branch" value={v.branch} />
        <Row label="Last visit on" value={v.lastVisitOn} />
        <Row label="Total visits" value={v.totalVisits} />
        <Row label="Total spendings" value={`₹${(v.totalSpendings / 100).toLocaleString("en-IN")}`} />
        <Row label="Membership" value={v.membership} />
        <Row label="Active packages" value={v.activePackages} />
        <Row
          label="My wallet"
          value={
            <span className="flex items-center gap-1">
              <Wallet size={12} /> ₹{(v.walletBalance / 100).toLocaleString("en-IN")}
            </span>
          }
        />
        <Row
          label="Reward points"
          value={
            <span className="flex items-center gap-1">
              <Star size={12} /> {v.rewardPoints}
            </span>
          }
        />
        <Row label="Gender" value={<span className="capitalize">{v.gender}</span>} />
        <Row label="Date of birth" value={v.dateOfBirth} />
        <Row label="Anniversary" value={v.anniversary} />
        <Row label="Source of client" value={v.sourceOfClient} />
      </div>
    </div>
  );
}
