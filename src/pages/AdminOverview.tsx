import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, CalendarDays, Radio, Lock, UserPlus, BellRing, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { activeWeek } from "@/lib/weeks";
import { usePermissions } from "@/lib/permissions";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";

const AdminOverview = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.admin.users.list,
    enabled: currentUser?.role === "admin" && can("users.view"),
  });

  const { data: weeks, isLoading: weeksLoading } = useQuery({
    queryKey: ["weeks"],
    queryFn: api.weeks.list,
    enabled: currentUser?.role === "admin",
  });

  const { data: status } = useQuery({
    queryKey: ["admin-status"],
    queryFn: api.admin.status,
    refetchInterval: 10_000,
    enabled: currentUser?.role === "admin",
  });

  const totalFixtures = weeks?.reduce((sum, w) => sum + w.fixtures.length, 0) ?? 0;
  const currentWeek = activeWeek(weeks ?? []);

  const { data: participation } = useQuery({
    queryKey: ["admin-participation", currentWeek?.id],
    queryFn: () => api.admin.weeks.participation(currentWeek!.id),
    enabled: currentUser?.role === "admin" && !!currentWeek && can("participation.view"),
    refetchInterval: 60_000,
  });
  const chase = participation?.players.filter((p) => p.predicted < participation.fixtureCount).length ?? 0;
  // Same 30-second lead as the Predict page; null once the week has locked.
  const lockMs = participation?.nextKickoff ? new Date(participation.nextKickoff).getTime() - 30_000 : null;
  const openLock = lockMs !== null && lockMs > Date.now() ? new Date(lockMs) : null;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl px-6 pt-8 pb-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">Snapshot of the prediction game</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
              <Users className="h-3.5 w-3.5" /> Users
            </div>
            <p className="text-2xl font-bold">
              {usersLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (users?.length ?? "—")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
              <CalendarDays className="h-3.5 w-3.5" /> Fixtures
            </div>
            <p className="text-2xl font-bold">
              {weeksLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : totalFixtures}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
              <Radio className="h-3.5 w-3.5" /> Scraper
            </div>
            <p className="text-sm font-semibold">{status?.scraperEnabled ? "Running" : "Paused"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {status?.lastScrapedAt
                ? `Last scraped ${formatDistanceToNow(new Date(status.lastScrapedAt), { addSuffix: true })}`
                : "Never scraped"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
              <Lock className="h-3.5 w-3.5" /> Predictions
            </div>
            <p className={`text-sm font-semibold ${status?.predictionsLocked ? "text-destructive" : ""}`}>
              {status?.predictionsLocked ? "Locked" : "Open"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {status?.predictionsLocked ? "No one can submit predictions" : "Users can submit as normal"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
              <UserPlus className="h-3.5 w-3.5" /> Registration
            </div>
            <p className={`text-sm font-semibold ${status?.registrationClosed ? "text-destructive" : ""}`}>
              {status?.registrationClosed ? "Closed" : "Open"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {status?.registrationClosed ? "New sign-ups are blocked" : "Anyone can sign up"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-1">Current week</p>
          <p className="text-sm text-muted-foreground">
            {currentWeek ? `${currentWeek.name} · ${currentWeek.competition}` : "No active week"}
          </p>
        </div>

        {/* Players still to predict the open week */}
        {participation && openLock && chase > 0 && (
          <button
            onClick={() => navigate("/admin/participation")}
            className="group flex w-full items-center gap-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-left transition-colors hover:bg-destructive/10"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15">
              <BellRing className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {chase} of {participation.players.length} players yet to predict {currentWeek?.name.replace(/.*—\s*/, "")}
              </p>
              <p className="text-xs text-muted-foreground">
                Predictions lock in {formatDistanceToNow(openLock)}. Remind them on WhatsApp.
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
              View <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
