import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Trophy,
  ArrowRight,
  ShieldCheck,
  CalendarDays,
  ClipboardCheck,
  Users,
  Settings,
  Target,
  BarChart3,
  Medal,
  LogOut,
  Loader2,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { setArea, usePermissions } from "@/lib/permissions";
import type { Permission } from "@/lib/api";

// What the back office card lists, when the admin has the permission.
const BACK_OFFICE_ITEMS: { permission: Permission; icon: typeof CalendarDays; text: string }[] = [
  { permission: "fixtures.manage", icon: CalendarDays, text: "Manage fixtures and results" },
  { permission: "participation.view", icon: ClipboardCheck, text: "See who's yet to predict" },
  { permission: "users.view", icon: Users, text: "Look after players" },
  { permission: "settings.view", icon: Settings, text: "Game settings" },
];

const APP_ITEMS = [
  { icon: Target, text: "Predict this week's matches" },
  { icon: BarChart3, text: "Season and weekly standings" },
  { icon: Medal, text: "Weekly champions" },
];

/** After signing in, back-office users pick where to go: the back office or the game itself. */
const ChooseDestination = () => {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const { can, isSystemUser, isLoading } = usePermissions();

  useEffect(() => {
    if (!currentUser) navigate("/");
    else if (currentUser.role !== "admin") navigate("/predict", { replace: true });
  }, [currentUser, navigate]);

  if (currentUser?.role !== "admin") return null;

  const go = (area: "backoffice" | "app") => {
    setArea(area);
    navigate(area === "backoffice" ? "/admin" : "/predict");
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  const firstName = currentUser.name.split(" ")[0];
  const backOfficeItems = BACK_OFFICE_ITEMS.filter((i) => can(i.permission));

  return (
    <div className="relative min-h-screen overflow-clip bg-background">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/30">
              <span className="text-sm font-bold text-primary-foreground">OP</span>
            </div>
            <span className="text-sm font-semibold tracking-wide">Octopus Prediction</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 fade-in-up">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Signed in</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {firstName}.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Where would you like to go?</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Back office */}
            <button
              onClick={() => go("backoffice")}
              className="group relative flex flex-col rounded-2xl border border-border bg-card/80 p-6 text-left shadow-xl shadow-black/30 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                  <LayoutDashboard className="h-5 w-5 text-primary" />
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  {isSystemUser ? "System admin · full access" : "Admin"}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold">Back office</h2>
              <p className="mt-1 text-sm text-muted-foreground">Run the league behind the scenes.</p>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                {isLoading ? (
                  <li className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your access…
                  </li>
                ) : backOfficeItems.length > 0 ? (
                  backOfficeItems.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-primary/80" /> {text}
                    </li>
                  ))
                ) : (
                  <li>Your access is limited. Ask the system admin if you need more.</li>
                )}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Open back office
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            {/* Main application */}
            <button
              onClick={() => go("app")}
              className="group relative flex flex-col rounded-2xl border border-border bg-card/80 p-6 text-left shadow-xl shadow-black/30 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15">
                <Trophy className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">Main application</h2>
              <p className="mt-1 text-sm text-muted-foreground">Play the game like every other player.</p>
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                {APP_ITEMS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-amber-400/80" /> {text}
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400">
                Open the game
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            You can switch between the two at any time from the menu.
          </p>
        </main>
      </div>
    </div>
  );
};

export default ChooseDestination;
