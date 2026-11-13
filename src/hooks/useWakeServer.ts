import { useCallback, useEffect, useRef, useState } from "react";
import { checkServer } from "@/lib/api";

// When Render's edge (Cloudflare) refuses the Worker with a bot check, waiting never gets past it,
// but a person ticking "I'm human" at the backend's own address does: their request wakes the
// backend, and then the Worker's requests pass too (seen 13/11/2026). So the app asks for one tap,
// opens that page in a small window, and carries on by itself once the server answers.
//
//   idle    nothing to do
//   ask     the check is needed; waiting for the player to tap "Wake the server"
//   waiting the check's window is open (or was); checking until the server answers
//   blocked the browser refused the window; the player opens it as a link instead
//
// The check's page (Cloudflare's) usually cuts the link back to this window, so we can't rely on
// seeing it close or on closing it ourselves. Instead we check the server every few seconds, and
// at once whenever the player comes back to this tab.
export type WakePhase = "idle" | "ask" | "waiting" | "blocked";
export type WakeResult = "awake" | "timeout" | "cancelled";

// Before the tap: someone else may wake the server meanwhile, so keep an eye on it, gently.
export const ASK_POLL_MS = 10_000;
// After the tap the player is watching, so check more often.
export const WAIT_POLL_MS = 5_000;
// Waking took up to ~90s when measured (12/11/2026); allow for a slow tick and a slow boot.
export const WAIT_MAX_MS = 4 * 60_000;
// A player who never taps: stop checking eventually.
export const ASK_MAX_MS = 10 * 60_000;

interface Run {
  wakeUrl: string;
  resolve: (result: WakeResult) => void;
  deadline: number;
  timer?: ReturnType<typeof setTimeout>;
  checking: boolean;
  // The player has opened the check's page (window or link): check more often.
  tapped: boolean;
  popup: Window | null;
}

const POPUP_W = 440;
const POPUP_H = 640;

/** A small window centred over this one (ignored by phones, which open a tab). */
function popupFeatures(): string {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - POPUP_W) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - POPUP_H) / 2));
  return `popup,width=${POPUP_W},height=${POPUP_H},left=${left},top=${top}`;
}

export function useWakeServer() {
  const [phase, setPhase] = useState<WakePhase>("idle");
  const [wakeUrl, setWakeUrl] = useState<string | null>(null);
  const run = useRef<Run | null>(null);

  const finish = useCallback((result: WakeResult) => {
    const r = run.current;
    if (!r) return;
    run.current = null;
    clearTimeout(r.timer);
    if (result === "awake" && r.popup) {
      // Works only while the link to the window survives; otherwise its own page says to close it.
      try {
        r.popup.close();
      } catch {
        // Nothing to do: the player closes it.
      }
      window.focus();
    }
    setPhase("idle");
    setWakeUrl(null);
    r.resolve(result);
  }, []);

  const check = useCallback(async () => {
    const r = run.current;
    if (!r || r.checking) return;
    clearTimeout(r.timer);
    r.checking = true;
    const result = await checkServer();
    r.checking = false;
    if (run.current !== r) return; // finished or cancelled meanwhile
    if (result.state === "up") return finish("awake");
    if (Date.now() >= r.deadline) return finish("timeout");
    if (result.state === "human_check" && result.wakeUrl !== r.wakeUrl) {
      r.wakeUrl = result.wakeUrl;
      setWakeUrl(result.wakeUrl);
    }
    r.timer = setTimeout(() => void check(), r.tapped ? WAIT_POLL_MS : ASK_POLL_MS);
  }, [finish]);

  /**
   * The check is needed: shows "Wake the server" and resolves "awake" once the server answers,
   * "timeout" if it doesn't in time, or "cancelled" if the player gives up.
   */
  const ask = useCallback(
    (url: string) =>
      new Promise<WakeResult>((resolve) => {
        // A second ask (say, from the banner while sign-in already asked) joins the first.
        const current = run.current;
        if (current) {
          const earlier = current.resolve;
          current.resolve = (result) => {
            earlier(result);
            resolve(result);
          };
          return;
        }
        run.current = { wakeUrl: url, resolve, deadline: Date.now() + ASK_MAX_MS, checking: false, tapped: false, popup: null };
        setWakeUrl(url);
        setPhase("ask");
        run.current.timer = setTimeout(() => void check(), ASK_POLL_MS);
      }),
    [check],
  );

  /** Opens the check's page. Call straight from the tap, or the browser blocks the window. */
  const openCheck = useCallback(() => {
    const r = run.current;
    if (!r) return;
    let popup: Window | null = null;
    try {
      popup = window.open(r.wakeUrl, "op-server-check", popupFeatures());
    } catch {
      popup = null;
    }
    r.popup = popup;
    r.tapped = !!popup;
    r.deadline = Date.now() + WAIT_MAX_MS;
    setPhase(popup ? "waiting" : "blocked");
    clearTimeout(r.timer);
    r.timer = setTimeout(() => void check(), WAIT_POLL_MS);
  }, [check]);

  /** The player opened the check through the fallback link (window blocked). */
  const openedAsLink = useCallback(() => {
    const r = run.current;
    if (!r) return;
    r.tapped = true;
    r.deadline = Date.now() + WAIT_MAX_MS;
    setPhase("waiting");
    clearTimeout(r.timer);
    r.timer = setTimeout(() => void check(), WAIT_POLL_MS);
  }, [check]);

  const cancel = useCallback(() => finish("cancelled"), [finish]);

  // Coming back to this tab (or the check's window closing) is the likeliest moment the box was
  // ticked: check straight away rather than at the next tick.
  useEffect(() => {
    if (phase !== "waiting" && phase !== "blocked") return;
    const now = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", now);
    document.addEventListener("visibilitychange", now);
    return () => {
      window.removeEventListener("focus", now);
      document.removeEventListener("visibilitychange", now);
    };
  }, [phase, check]);

  // Leaving the page mid-check: stop checking, and let whoever was waiting go on.
  useEffect(() => () => finish("cancelled"), [finish]);

  return { phase, wakeUrl, ask, openCheck, openedAsLink, cancel };
}

export type WakeServer = ReturnType<typeof useWakeServer>;
