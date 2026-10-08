import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, Trophy, Radio, Clock, User, LogOut, LayoutDashboard, MessageCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useChat } from "@/context/ChatContext";
import { setArea } from "@/lib/permissions";
import { toast } from "sonner";

const navItems = [
  { path: "/predict", label: "Predict", icon: ClipboardList },
  { path: "/leaderboard", label: "Standings", icon: Trophy },
  { path: "/status", label: "Live", icon: Radio },
  { path: "/dashboard", label: "History", icon: Clock },
  { path: "/messages", label: "Messages", icon: MessageCircle },
  { path: "/profile", label: "Profile", icon: User },
];

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useApp();
  const { unreadTotal } = useChat();

  // This bar only appears on the game's pages, so an admin seeing it is using the game.
  useEffect(() => {
    if (currentUser?.role === "admin") setArea("app");
  }, [currentUser?.role]);

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  const items = navItems;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      {/* Narrow screens: brand and account actions on top, the sections in a scrolling row below. */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">OP</span>
          </div>
          <span className="font-bold text-foreground">Octopus Prediction</span>
        </div>
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 [scrollbar-width:none] lg:order-none lg:mx-0 lg:w-auto lg:px-0">
          {items.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const badge = item.path === "/messages" ? unreadTotal : 0;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {badge > 0 && (
                  <span
                    className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                      active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          {currentUser?.role === "admin" && (
            <button
              onClick={() => {
                setArea("backoffice");
                navigate("/admin");
              }}
              title="Back office"
              className="ml-1 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
              Back office
            </button>
          )}
          <button
            onClick={handleLogout}
            className="ml-2 p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default NavBar;
