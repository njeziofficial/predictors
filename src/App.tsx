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
import AdminParticipation from "./pages/AdminParticipation";
import Profile from "./pages/Profile";
import ResetPasswordRequired from "./pages/ResetPasswordRequired";
import NotFound from "./pages/NotFound";
import ChooseDestination from "./pages/ChooseDestination";
import AdminAccessControl from "./pages/AdminAccessControl";
import Messages from "./pages/Messages";
import AdminMessages from "./pages/AdminMessages";
import { ChatProvider } from "@/context/ChatContext";

// Data is treated as fresh for 30s, so moving between pages reuses what was just loaded instead
// of refetching it on every mount. Shared game data (fixtures, standings, settings) stays current
// through the server's DataChanged pushes (see ChatContext), not through polling.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // One retry for a flaky network; the request helper already handles expired sessions.
      retry: 1,
    },
  },
});

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
          {/* Inside the router: a message toast's "Open" navigates to the chat. */}
          <ChatProvider>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password-required" element={<ResetPasswordRequired />} />
              <Route path="/choose" element={<RequireFreshPassword><ChooseDestination /></RequireFreshPassword>} />
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
              <Route path="/admin/access" element={<RequireFreshPassword><AdminAccessControl /></RequireFreshPassword>} />
              <Route path="/admin/participation" element={<RequireFreshPassword><AdminParticipation /></RequireFreshPassword>} />
              <Route path="/profile" element={<RequireFreshPassword><Profile /></RequireFreshPassword>} />
              <Route path="/messages/:conversationId?" element={<RequireFreshPassword><Messages /></RequireFreshPassword>} />
              <Route path="/admin/messages/:conversationId?" element={<RequireFreshPassword><AdminMessages /></RequireFreshPassword>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ChatProvider>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
