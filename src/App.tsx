import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Predictions from "./pages/Predictions";
import Leaderboard from "./pages/Leaderboard";
import Dashboard from "./pages/Dashboard";
import MatchStatus from "./pages/MatchStatus";
import AdminOverview from "./pages/AdminOverview";
import AdminSettings from "./pages/AdminSettings";
import AdminUsers from "./pages/AdminUsers";
import AdminFixtures from "./pages/AdminFixtures";
import AdminAuditTrail from "./pages/AdminAuditTrail";
import AdminPreviousPoints from "./pages/AdminPreviousPoints";
import Profile from "./pages/Profile";
import ResetPasswordRequired from "./pages/ResetPasswordRequired";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Central gate: a user whose password was reset by an admin can't reach any other
// authenticated route until they change it, instead of every page having to check this itself.
const RequireFreshPassword = ({ children }: { children: JSX.Element }) => {
  const { currentUser } = useApp();
  const location = useLocation();

  if (currentUser?.mustResetPassword && location.pathname !== "/reset-password-required") {
    return <Navigate to="/reset-password-required" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password-required" element={<ResetPasswordRequired />} />
            <Route path="/predict" element={<RequireFreshPassword><Predictions /></RequireFreshPassword>} />
            <Route path="/leaderboard" element={<RequireFreshPassword><Leaderboard /></RequireFreshPassword>} />
            <Route path="/dashboard" element={<RequireFreshPassword><Dashboard /></RequireFreshPassword>} />
            <Route path="/status" element={<RequireFreshPassword><MatchStatus /></RequireFreshPassword>} />
            <Route path="/admin" element={<RequireFreshPassword><AdminOverview /></RequireFreshPassword>} />
            <Route path="/admin/settings" element={<RequireFreshPassword><AdminSettings /></RequireFreshPassword>} />
            <Route path="/admin/users" element={<RequireFreshPassword><AdminUsers /></RequireFreshPassword>} />
            <Route path="/admin/fixtures" element={<RequireFreshPassword><AdminFixtures /></RequireFreshPassword>} />
            <Route path="/admin/audit" element={<RequireFreshPassword><AdminAuditTrail /></RequireFreshPassword>} />
            <Route path="/admin/previous-points" element={<RequireFreshPassword><AdminPreviousPoints /></RequireFreshPassword>} />
            <Route path="/profile" element={<RequireFreshPassword><Profile /></RequireFreshPassword>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
