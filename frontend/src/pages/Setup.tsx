import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { api } from "../api";
import { useBranch } from "../BranchContext";
import FloatingInput from "../components/FloatingInput";
import AuthHero from "../components/AuthHero";

const STEPS = ["Business", "Your account"];

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    orgName: "",
    branchName: "",
    city: "",
    ownerName: "",
    ownerPhone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loadBranches } = useBranch();

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    setStep(1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.signup(form);
      localStorage.setItem("token", res.token);
      loadBranches();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-full bg-white">
      <AuthHero />

      <div className="flex flex-1 items-center justify-center px-6 sm:px-10">
        <div className="w-full max-w-[380px] animate-slideUp">
          <div className="flex items-center gap-2 mb-7">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? "bg-charcoal-900" : "bg-slate-100"
                  }`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs font-medium text-slate-400 mb-1">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </p>

          <h2 className="text-2xl font-semibold text-charcoal-900 tracking-tight">
            {step === 0 ? "Tell us about your workshop" : "Create your login"}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {step === 0
              ? "This sets up your business and first branch."
              : "You'll use this phone number to log in every time."}
          </p>

          {step === 0 ? (
            <form onSubmit={next} className="mt-8 flex flex-col gap-4">
              <FloatingInput
                label="Business name"
                value={form.orgName}
                onChange={(e) => update("orgName", e.target.value)}
                required
                autoFocus
                helperText="Shown on invoices and customer messages"
              />
              <FloatingInput
                label="First branch name"
                value={form.branchName}
                onChange={(e) => update("branchName", e.target.value)}
                required
              />
              <FloatingInput
                label="City"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                required
              />
              <button
                type="submit"
                className="mt-2 group flex items-center justify-center gap-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white transition-all hover:bg-charcoal-800"
              >
                Continue
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
              <FloatingInput
                label="Your name"
                value={form.ownerName}
                onChange={(e) => update("ownerName", e.target.value)}
                required
                autoFocus
              />
              <FloatingInput
                label="Phone number"
                value={form.ownerPhone}
                onChange={(e) => update("ownerPhone", e.target.value)}
                required
              />
              <FloatingInput
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
                helperText="At least 6 characters"
              />

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-[14px] font-medium text-charcoal-900 transition-colors hover:bg-slate-50"
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white transition-all hover:bg-charcoal-800 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-accent-600 hover:text-accent-500">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
