import { useEffect, type ReactNode } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  Users,
  History,
  Settings,
  ScrollText,
  User,
  LogOut,
  KeyRound,
  Trophy,
  ShieldOff,
  MessageCircle,
} from "lucide-react";
import { BrandLoader, BrandLogo, BrandMark } from "@/components/Brand";
import { useApp } from "@/context/AppContext";
import { useChat } from "@/context/ChatContext";
import { setArea, usePermissions } from "@/lib/permissions";
import type { Permission } from "@/lib/api";
import { toast } from "sonner";

// `permission`: shown only to admins who have it. `systemOnly`: only the system admin.
const navItems: { path: string; label: string; icon: typeof LayoutDashboard; permission?: Permission; systemOnly?: boolean }[] = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/fixtures", label: "Fixtures", icon: CalendarDays, permission: "fixtures.manage" },
  { path: "/admin/participation", label: "Prediction Check", icon: ClipboardCheck, permission: "participation.view" },
  { path: "/admin/users", label: "Users", icon: Users, permission: "users.view" },
  { path: "/admin/previous-points", label: "Previous Points", icon: History, permission: "previous_points.view" },
  { path: "/admin/audit", label: "Audit Trail", icon: ScrollText, permission: "audit.view" },
  { path: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.view" },
  { path: "/admin/access", label: "Access Control", icon: KeyRound, systemOnly: true },
  { path: "/admin/messages", label: "Messages", icon: MessageCircle },
  { path: "/profile", label: "Profile", icon: User },
];

// Overview is only active on itself; other sections also own their sub-paths (/admin/messages/:id).
const isActive = (pathname: string, path: string) =>
  pathname === path || (path !== "/admin" && pathname.startsWith(`${path}/`));

const UnreadBadge = ({ count, active }: { count: number; active: boolean }) =>
  count > 0 ? (
    <span
      className={`ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
        active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

/**
 * Frame for every back-office page. Pass `permission` (or `systemOnly`) to show a clear
 * "no access" panel instead of the page to admins who lack it; the backend refuses the
 * underlying requests either way. `fill` makes the page exactly the viewport's height (for
 * screens like Messages that scroll inside themselves).
 */
const AdminLayout = ({
  children,
  permission,
  systemOnly,
  fill,
}: {
  children: ReactNode;
  permission?: Permission;
  systemOnly?: boolean;
  fill?: boolean;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useApp();
  const { can, isSystemUser, isLoading } = usePermissions();
  const { unreadTotal } = useChat();

  useEffect(() => setArea("backoffice"), []);

  if (!currentUser) return <Navigate to="/" replace />;
  if (currentUser.role !== "admin") return <Navigate to="/predict" replace />;

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  const goToApp = () => {
    setArea("app");
    navigate("/predict");
  };

  const visible = navItems.filter((i) => (i.systemOnly ? isSystemUser : !i.permission || can(i.permission)));
  const allowed = systemOnly ? isSystemUser : !permission || can(permission);

  const content = isLoading ? (
    <BrandLoader className="h-64" />
  ) : allowed ? (
    children
  ) : (
    <div className="mx-auto max-w-md px-6 pt-24 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <ShieldOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">You don't have access to this page</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {systemOnly
          ? "Only the system admin can open this page."
          : "Your back-office permissions don't include this. Ask the system admin if you need it."}
      </p>
      <button
        onClick={() => navigate("/admin")}
        className="mt-5 text-sm font-medium text-primary hover:underline"
      >
        Back to overview
      </button>
    </div>
  );

  return (
    <div className={fill ? "flex h-[100dvh] flex-col bg-background md:flex-row" : "min-h-screen bg-background md:flex"}>
      {/* Phones: a top bar with the sections in a scrolling row instead of the sidebar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <BrandLogo label="Admin CMS" />
          <div className="flex items-center gap-1">
            <button
              onClick={goToApp}
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> Game
            </button>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
          {visible.map((item) => {
            const active = isActive(location.pathname, item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.path === "/admin/messages" && <UnreadBadge count={unreadTotal} active={active} />}
              </button>
            );
          })}
        </nav>
      </header>

      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-border md:flex md:flex-col">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <BrandMark className="h-9 w-9" />
          <div className="min-w-0">
            <span className="block font-bold text-foreground text-sm">Admin CMS</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {isSystemUser ? "System admin" : "Admin"} · {currentUser.name}
            </span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {visible.map((item) => {
            const active = isActive(location.pathname, item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.path === "/admin/messages" && <UnreadBadge count={unreadTotal} active={active} />}
              </button>
            );
          })}
        </nav>
        <div className="px-2 py-3 border-t border-border space-y-1">
          <button
            onClick={goToApp}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            Go to the game
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>
      <main className={`flex-1 min-w-0 page-transition ${fill ? "min-h-0" : ""}`}>{content}</main>
    </div>
  );
};

export default AdminLayout;
