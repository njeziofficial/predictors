import { type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, History, Settings, ScrollText, User, LogOut } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

const navItems = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/fixtures", label: "Fixtures", icon: CalendarDays },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/previous-points", label: "Previous Points", icon: History },
  { path: "/admin/audit", label: "Audit Trail", icon: ScrollText },
  { path: "/admin/settings", label: "Settings", icon: Settings },
  { path: "/profile", label: "Profile", icon: User },
];

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useApp();

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  if (!currentUser) {
    navigate("/");
    return null;
  }

  if (currentUser.role !== "admin") {
    navigate("/predict");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">OP</span>
          </div>
          <span className="font-bold text-foreground text-sm">Admin CMS</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
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
              </button>
            );
          })}
        </nav>
        <div className="px-2 py-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 page-transition">{children}</main>
    </div>
  );
};

export default AdminLayout;
