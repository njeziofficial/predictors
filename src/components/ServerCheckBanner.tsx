import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import WakeServerPrompt from "@/components/WakeServerPrompt";
import { useApp } from "@/context/AppContext";
import { useWakeServer } from "@/hooks/useWakeServer";
import { HUMAN_CHECK_EVENT } from "@/lib/api";

/**
 * For players already signed in: when a request meets Render's "I'm human" check (the request
 * helper in lib/api.ts says so with HUMAN_CHECK_EVENT), offer the same one-tap wake-up as the
 * sign-in page, then reload what the page was showing. The player stays signed in throughout.
 */
const ServerCheckBanner = () => {
  const wake = useWakeServer();
  const { currentUser } = useApp();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  // The sign-in page has its own prompt.
  const active = !!currentUser && pathname !== "/";
  const { ask } = wake;

  useEffect(() => {
    if (!active) return;
    const onCheck = (e: Event) => {
      const wakeUrl = (e as CustomEvent<{ wakeUrl?: string }>).detail?.wakeUrl;
      if (!wakeUrl) return;
      void ask(wakeUrl).then((result) => {
        if (result !== "awake") return;
        toast.success("The server is awake.");
        void queryClient.invalidateQueries();
      });
    };
    window.addEventListener(HUMAN_CHECK_EVENT, onCheck);
    return () => window.removeEventListener(HUMAN_CHECK_EVENT, onCheck);
  }, [active, ask, queryClient]);

  if (!active || wake.phase === "idle") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <WakeServerPrompt wake={wake} className="w-full max-w-sm bg-card shadow-2xl shadow-black/40" />
    </div>
  );
};

export default ServerCheckBanner;
