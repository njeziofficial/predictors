import { useSyncExternalStore } from "react";
import { isIos, isStandalone } from "@/lib/push";

// Installing the app to the home screen. Chrome, Edge and Samsung Internet offer it through the
// "beforeinstallprompt" event, which fires once, soon after the page loads: it's caught here at
// startup (listenForInstallPrompt, from main.tsx) and kept until a player taps Install.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const listenForInstallPrompt = () => {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep Chrome's own mini-bar from showing; the app offers it where it makes sense.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
};

/**
 * - installed: running as the installed app (or just installed).
 * - prompt: the browser can install it with one tap.
 * - in-app: inside another app's browser (WhatsApp, Instagram, Facebook...), which can't install.
 * - ios: iPhone/iPad Safari: Share → Add to Home Screen.
 * - manual: a phone browser that hasn't offered the prompt (yet): its menu has the option.
 * - none: a desktop browser that can't install it; nothing to show.
 */
export type InstallState = "installed" | "prompt" | "in-app" | "ios" | "manual" | "none";

// Android WebViews mark themselves "wv"; the big apps add their own name to the user agent.
const inAppBrowser = () => /\bwv\b|FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|Twitter/i.test(navigator.userAgent);
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIos();

const currentState = (): InstallState => {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (inAppBrowser()) return "in-app";
  if (isIos()) return "ios";
  return isPhone() ? "manual" : "none";
};

export const useInstallState = () =>
  useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    currentState,
    () => "none" as InstallState,
  );

/** Shows the browser's install dialog; true if the player installed it. */
export async function installApp(): Promise<boolean> {
  const prompt = deferred;
  if (!prompt) return false;
  // The event can only be used once.
  deferred = null;
  notify();
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome === "accepted";
}
