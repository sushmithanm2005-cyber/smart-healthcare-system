import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(full_name, email, password);
      toast.success("Account created");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="register-page">
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-background">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-2 mb-10">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-semibold tracking-tight">NeuroDetect</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Healthcare</p>
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Get started</p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight mb-8">
            Create your <span className="text-primary font-medium">account</span>
          </h1>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Full name</label>
              <input
                type="text" required value={full_name} onChange={(e) => setFullName(e.target.value)}
                data-testid="register-name-input"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="Dr. Aisha Khan"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                data-testid="register-email-input"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="you@clinic.com"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Password</label>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                data-testid="register-password-input"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                placeholder="Min. 6 characters"
              />
            </div>
            <button type="submit" disabled={loading} data-testid="register-submit-button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Account
            </button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline" data-testid="link-to-login">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>

      <div className="hidden lg:block relative bg-primary overflow-hidden">
        <div className="absolute inset-0 grain opacity-30" />
        <div className="absolute inset-0"
             style={{
               background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(circle at 70% 80%, rgba(20, 184, 166, 0.5), transparent 50%)",
             }} />
        <svg className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full h-40 opacity-60"
             viewBox="0 0 800 100" preserveAspectRatio="none" fill="none">
          <path d="M0 50 L100 50 L120 30 L140 70 L160 20 L180 80 L200 50 L320 50 L340 35 L360 65 L380 25 L400 75 L420 50 L600 50 L620 40 L640 60 L660 50 L800 50"
                stroke="white" strokeWidth="2" className="ecg-line" />
        </svg>
      </div>
    </div>
  );
}
