import { useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, Trophy, Radio, Clock, User, LogOut } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

const navItems = [
  { path: "/predict", label: "Predict", icon: ClipboardList },
  { path: "/leaderboard", label: "Standings", icon: Trophy },
  { path: "/status", label: "Live", icon: Radio },
  { path: "/dashboard", label: "History", icon: Clock },
  { path: "/profile", label: "Profile", icon: User },
];

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useApp();

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    navigate("/");
  };

  const items = navItems;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">OP</span>
          </div>
          <span className="font-bold text-foreground">Octopus Prediction</span>
        </div>
        <div className="flex items-center gap-1">
          {items.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
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
