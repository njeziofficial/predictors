import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useApp } from "@/context/AppContext";
import { api, type LoginMethod } from "@/lib/api";
import { POINTS } from "@/lib/constants";
import { toast } from "sonner";
import { Target, Zap, TrendingUp, Mail, MessageCircle, Lock, Loader2, AlertCircle, ArrowRight } from "lucide-react";

const FEATURES = [
  { icon: Target, title: "Predict every match", text: "Pick outcomes for each fixture before kick-off." },
  {
    icon: Zap,
    title: "Earn points",
    text: `Home win ${POINTS.home_win} · Away win ${POINTS.away_win} · Draw ${POINTS.draw} · Correct score ${POINTS.correct_score} points.`,
  },
  { icon: TrendingUp, title: "Climb the table", text: "Top the weekly podium and the season standings." },
];

const METHODS = {
  email: {
    tab: "Email",
    icon: Mail,
    label: "Email address",
    placeholder: "you@example.com",
    type: "email",
    hint: "The email address you registered with.",
  },
  whatsapp: {
    tab: "WhatsApp name",
    icon: MessageCircle,
    label: "WhatsApp name",
    placeholder: "e.g. God's own",
    type: "text",
    hint: "As on your profile. Capitals, spaces and punctuation don't matter.",
  },
} as const;

// Remembers which way this device last signed in.
const METHOD_KEY = "op_login_method";
const readSavedMethod = (): LoginMethod => {
  try {
    return localStorage.getItem(METHOD_KEY) === "whatsapp" ? "whatsapp" : "email";
  } catch {
    return "email";
  }
};

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: registration } = useQuery({
    queryKey: ["registration-status"],
    queryFn: api.auth.registrationStatus,
  });

  useEffect(() => {
    if (searchParams.get("disabled") === "1") {
      toast.error("Your account has been disabled. Please contact an admin.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [method, setMethod] = useState<LoginMethod>(readSavedMethod);
  const field = METHODS[method];

  const identifierRef = useRef<HTMLInputElement>(null);
  const switchMethod = (next: LoginMethod) => {
    if (next === method) return;
    setMethod(next);
    setIdentifier("");
    setError(null);
    // The field remounts for the new method; focus it once it has.
    requestAnimationFrame(() => identifierRef.current?.focus());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    if (method === "email" && !value.includes("@")) {
      setError("That doesn't look like an email address. Switch to WhatsApp name to sign in with that.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.auth.login(method, value, password);
      try {
        localStorage.setItem(METHOD_KEY, method);
      } catch {
        // Storage can be unavailable (private mode); the switch just won't be remembered.
      }
      login(res.token, {
        id: res.userId,
        name: res.name,
        email: res.email,
        role: res.role,
        mustResetPassword: res.mustResetPassword,
        isSystemUser: res.isSystemUser,
      });
      toast.success(`Welcome, ${res.name}!`);
      if (res.mustResetPassword) {
        navigate("/reset-password-required");
      } else {
        navigate(res.role === "admin" ? "/admin" : "/predict");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-clip bg-background">
      {/* Backdrop: a warm glow and a faint pitch grid */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 right-0 h-[24rem] w-[24rem] rounded-full bg-primary/5 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row lg:items-center lg:gap-16">
        {/* Brand and pitch */}
        <section className="flex-1 px-6 pt-12 lg:px-10 lg:py-12 fade-in-up">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30">
              <span className="text-sm font-bold text-primary-foreground">OP</span>
            </div>
            <span className="text-sm font-semibold tracking-wide">Octopus Prediction</span>
          </div>

          <h1 className="mt-10 text-4xl font-bold leading-[1.1] tracking-tight lg:text-5xl">
            Call the results.
            <br />
            <span className="text-primary">Top the table.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            The weekly football prediction league for the Octopus community. Predict every match, score points and
            compete for the weekly podium.
          </p>

          <ul className="mt-8 hidden space-y-4 sm:block">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Sign-in card */}
        <section className="flex flex-1 items-center justify-center px-6 py-10 lg:py-12">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card/80 p-7 shadow-2xl shadow-black/40 backdrop-blur fade-in-up">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground">Choose how you'd like to sign in.</p>
            </div>

            {/* Sign-in method */}
            <div
              role="tablist"
              aria-label="Sign in with"
              className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/60 p-1"
            >
              {(Object.keys(METHODS) as LoginMethod[]).map((m) => {
                const { tab, icon: Icon } = METHODS[m];
                const active = m === method;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls="login-form"
                    onClick={() => switchMethod(m)}
                    disabled={loading}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} />
                    {tab}
                  </button>
                );
              })}
            </div>

            <form id="login-form" onSubmit={handleLogin} className="mt-5 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-identifier" className="text-xs font-medium text-muted-foreground">
                  {field.label}
                </Label>
                <div className="relative">
                  <field.icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="login-identifier"
                    // A different key per method so the browser offers the right saved values.
                    key={method}
                    ref={identifierRef}
                    type={field.type}
                    inputMode={method === "email" ? "email" : "text"}
                    autoComplete={method === "email" ? "email" : "username"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={field.placeholder}
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError(null);
                    }}
                    required
                    disabled={loading}
                    aria-invalid={!!error}
                    className="h-11 border-border bg-secondary pl-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">{field.hint}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-xs font-medium text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <PasswordInput
                    id="login-password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    required
                    disabled={loading}
                    aria-invalid={!!error}
                    className="h-11 border-border bg-secondary pl-9"
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
                >
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full text-sm font-semibold"
                disabled={loading || !identifier.trim() || !password}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {registration?.open !== false && (
              <p className="mt-6 text-center text-xs text-muted-foreground">
                New to the league?{" "}
                <a href="/register" className="font-medium text-primary hover:underline">
                  Create an account
                </a>
              </p>
            )}

            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Scoring
              </p>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-xs">
                {[
                  ["Home win", POINTS.home_win],
                  ["Away win", POINTS.away_win],
                  ["Draw", POINTS.draw],
                  ["Correct score", POINTS.correct_score],
                ].map(([label, pts]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold text-primary">+{pts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
