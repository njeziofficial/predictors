import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Users, CalendarDays, Radio, Lock, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";

const AdminOverview = () => {
  const { currentUser } = useApp();

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.admin.users.list,
    enabled: currentUser?.role === "admin",
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
  const currentWeek = weeks?.find((w) => w.fixtures.some((f) => f.status === "pre_match"));

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
              {usersLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (users?.length ?? 0)}
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
      </div>
    </AdminLayout>
  );
};

export default AdminOverview;
