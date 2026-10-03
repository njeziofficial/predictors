import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { POINTS } from "@/lib/constants";
import { toast } from "sonner";
import { Trophy, Target, Zap, TrendingUp, LogIn } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("disabled") === "1") {
      toast.error("Your account has been disabled. Please contact an admin.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.auth.login(email.trim(), password);
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
      toast.error(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left hero */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="max-w-lg">
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight">
            Octopus{" "}
            <span className="text-primary">Prediction</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
            The ultimate weekly football prediction game. Predict every match, score big points, top the table.
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Predict Matches</p>
                <p className="text-xs text-muted-foreground">Pick outcomes for every match each week before kick-off.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Earn Points</p>
                <p className="text-xs text-muted-foreground">
                  Home win {POINTS.home_win}pts · Away win {POINTS.away_win}pts · Draw {POINTS.draw}pts · Correct score {POINTS.correct_score}pts.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Climb the Table</p>
                <p className="text-xs text-muted-foreground">Compete against friends and rise to the top of the leaderboard.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right sign-in card */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Join Octopus Prediction</h2>
            <p className="text-sm text-muted-foreground">Sign in or create a free account to start predicting.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-secondary border-border"
            />
            <PasswordInput
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="bg-secondary border-border"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <a href="/register" className="text-primary underline">Register</a>
          </p>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wider">Scoring</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Home Win</span>
                <span className="text-primary font-semibold">+{POINTS.home_win} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Away Win</span>
                <span className="text-primary font-semibold">+{POINTS.away_win} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Draw</span>
                <span className="text-primary font-semibold">+{POINTS.draw} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Correct Score</span>
                <span className="text-primary font-semibold">+{POINTS.correct_score} pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
