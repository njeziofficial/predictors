import { api } from "@/lib/api";

// Push notifications in this browser: the service worker (public/sw.js) shows them, and the
// backend keeps each user's subscriptions and sends prediction reminders to them.

/**
 * - unsupported: this browser can't do push at all.
 * - needs-install: an iPhone/iPad in a Safari tab: push only works once the app is added to the
 *   Home Screen and opened from there.
 * - denied: the user blocked notifications for the site; only their settings can undo that.
 * - off / on: whether this browser is subscribed.
 */
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Registers the service worker; it only handles notifications, so it's safe on every page. */
export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Not available here (e.g. a non-HTTPS dev host): push just reads as unsupported.
  });
};

const currentSubscription = async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
};

export async function getPushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  return (await currentSubscription()) ? "on" : "off";
}

// The server's key arrives base64url; subscribe() wants the raw bytes.
const keyBytes = (base64url: string) => {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

/** Asks for permission (call it from a tap), subscribes this browser and saves it for the signed-in user. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return getPushState();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const serverKey = keyBytes((await api.push.publicKey()).publicKey);

  let subscription = await registration.pushManager.getSubscription();
  // Subscribed under another server key (keys were replaced): start over with the current one.
  if (subscription && !sameKey(subscription.options.applicationServerKey, serverKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  await api.push.subscribe(subscription.toJSON());
  return "on";
}

/** Stops notifications in this browser, for the signed-in user. */
export async function disablePush(): Promise<PushState> {
  const subscription = supported() ? await currentSubscription() : null;
  if (subscription) {
    await api.push.unsubscribe(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  }
  return getPushState();
}

/**
 * Re-saves this browser's subscription for whoever is signed in, so it follows the account (and
 * comes back if the server dropped it). Quiet: does nothing unless notifications are already on.
 */
export async function syncPushSubscription(): Promise<void> {
  try {
    if (!supported() || Notification.permission !== "granted") return;
    const subscription = await currentSubscription();
    if (subscription) await api.push.subscribe(subscription.toJSON());
  } catch {
    // Offline or the server is waking: the next app start tries again.
  }
}

/**
 * On sign-out: unsubscribes this browser, so the next person to use it doesn't get the last
 * one's reminders. The backend forgets the subscription when its push service reports it gone.
 */
export async function forgetPushOnThisDevice(): Promise<void> {
  try {
    if (supported()) await (await currentSubscription())?.unsubscribe();
  } catch {
    // Nothing to undo.
  }
}
