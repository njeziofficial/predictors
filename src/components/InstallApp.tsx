import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, EllipsisVertical, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallSteps, NotificationsPrompt } from "@/components/PushNotifications";
import { installApp, useInstallState, type InstallState } from "@/lib/install";
import { isIos } from "@/lib/push";

const install = async () => {
  if (await installApp()) toast.success("Installed. Find Octopus on your home screen.");
};

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.origin);
    toast.success("Link copied. Paste it in Chrome to install.");
  } catch {
    toast.error("Couldn't copy. Open the menu and choose Open in browser.");
  }
};

/** What to do to install the app in this browser. */
const HowToInstall = ({ state }: { state: Exclude<InstallState, "installed" | "none"> }) => {
  if (state === "prompt")
    return (
      <Button size="sm" onClick={install}>
        <Download className="h-4 w-4 mr-2" /> Install app
      </Button>
    );
  if (state === "ios") return <InstallSteps />;
  if (state === "in-app")
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          You opened this inside another app, which can't install it. Tap{" "}
          <EllipsisVertical className="inline h-3.5 w-3.5 text-primary" /> and choose{" "}
          <span className="font-medium text-foreground">{isIos() ? "Open in Safari" : "Open in Chrome"}</span> (or "Open
          in browser"), then install from there.
        </p>
        <Button size="sm" variant="outline" onClick={copyLink}>
          <Copy className="h-4 w-4 mr-2" /> Copy link
        </Button>
      </div>
    );
  return (
    <p className="text-xs text-muted-foreground">
      Tap your browser's menu <EllipsisVertical className="inline h-3.5 w-3.5 text-primary" /> and choose{" "}
      <span className="font-medium text-foreground">Install app</span> or{" "}
      <span className="font-medium text-foreground">Add to home screen</span>. On Samsung Internet it's ≡ → Add page to →
      Home screen.
    </p>
  );
};

const DISMISSED_KEY = "op_install_prompt_dismissed";
const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * For the Predict page: offers installing the app until it's installed or dismissed, then the
 * notifications nudge. On iPhone installing comes first anyway: notifications need it.
 */
export const AppPrompt = () => {
  const state = useInstallState();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (state === "installed" || state === "none" || dismissed) return <NotificationsPrompt />;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable: it just shows again next visit.
    }
  };

  return (
    <div className="relative rounded-xl border border-primary/40 bg-primary/10 p-4 pr-10 space-y-3">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Get the app</p>
          <p className="text-xs text-muted-foreground">
            Add Octopus to your home screen: it opens full screen, like any other app, and can remind you before
            predictions close.
          </p>
        </div>
      </div>
      <HowToInstall state={state} />
    </div>
  );
};

/** For the Profile page: whether the app is installed, and how to install it if not. */
export const InstallCard = () => {
  const state = useInstallState();
  if (state === "none") return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">App</span>
        {state === "installed" && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium bg-success/20 text-success">
            <Check className="h-3 w-3" /> Installed
          </span>
        )}
      </div>
      {state === "installed" ? (
        <p className="text-xs text-muted-foreground">You're using the installed app.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Install Octopus on this device to open it from your home screen.</p>
          <HowToInstall state={state} />
        </>
      )}
    </div>
  );
};
