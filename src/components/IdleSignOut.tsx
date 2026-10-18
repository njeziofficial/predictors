import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { getIdleMinutes, isIdleExpired, noteActivity, setIdleMinutes } from "@/lib/idleTimeout";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
const CHECK_EVERY_MS = 15_000;

/**
 * Signs the user out after the admin-configured minutes without activity (see lib/idleTimeout).
 * Renders nothing; sits inside the router so it can send them to the login page.
 */
const IdleSignOut = () => {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const signedIn = currentUser !== null;

  const { data } = useQuery({
    queryKey: ["session-settings"],
    queryFn: api.auth.sessionSettings,
    enabled: signedIn,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  useEffect(() => {
    if (data?.minutes) setIdleMinutes(data.minutes);
  }, [data?.minutes]);

  useEffect(() => {
    if (!signedIn) return;

    let lastCheck = 0;
    const check = () => {
      // Pointer moves fire many times a second; once a second is plenty.
      const now = Date.now();
      if (now - lastCheck < 1_000) return;
      lastCheck = now;
      if (!isIdleExpired(now,data?.minutes ?? getIdleMinutes())) return;
      logout();
      navigate("/?idle=1", { replace: true });
    };
    // Checked before counting new activity, so coming back to the app after the timeout (from
    // another app, or a phone that was asleep) signs out rather than counting the tap that woke it.
    const onActivity = () => {
      check();
      noteActivity();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [signedIn, data?.minutes, logout, navigate]);

  return null;
};

export default IdleSignOut;
