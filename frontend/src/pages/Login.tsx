import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, AlertCircle, FlaskConical } from "lucide-react";
import { api } from "../api";
import { useBranch } from "../BranchContext";
import FloatingInput from "../components/FloatingInput";
import AuthHero from "../components/AuthHero";

const DEV_TEST_ACCOUNTS = [
  { label: "Owner — Xpart Automotive", phone: "9999999999", password: "secret123" },
  { label: "Owner — Test Workshop 2", phone: "8888888888", password: "secret123" },
];

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loadBranches } = useBranch();

  async function doLogin(loginPhone: string, loginPassword: string) {
    setError("");
    setLoading(true);
    try {
      const res = await api.login(loginPhone, loginPassword);
      localStorage.setItem("token", res.token);
      loadBranches();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setLoading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    doLogin(phone, password);
  }

  return (
    <div className="flex h-screen w-full bg-white">
      <AuthHero />

      <div className="flex flex-1 items-center justify-center px-6 sm:px-10">
        <div className="w-full max-w-[380px] animate-slideUp">
          <h2 className="text-2xl font-semibold text-charcoal-900 tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-400">Log in to continue to your workspace.</p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <FloatingInput
              label="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
            />
            <FloatingInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 group flex items-center justify-center gap-2 rounded-xl bg-charcoal-900 px-4 py-3 text-[14px] font-medium text-white transition-all hover:bg-charcoal-800 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log in"}
              {!loading && (
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            New workshop?{" "}
            <Link to="/signup" className="font-medium text-accent-600 hover:text-accent-500">
              Set up your account
            </Link>
          </p>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                <FlaskConical size={13} />
                DEV MODE — test logins
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {DEV_TEST_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.phone}
                    type="button"
                    disabled={loading}
                    onClick={() => doLogin(acc.phone, acc.password)}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-xs transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    <span className="font-medium text-charcoal-900">{acc.label}</span>
                    <span className="text-amber-600">
                      {acc.phone} / {acc.password}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
