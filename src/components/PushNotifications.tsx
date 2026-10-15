import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, BellOff, Loader2, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, type NotificationPreferencesDto } from "@/lib/api";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";

const usePushState = () => {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getPushState().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  const run = useCallback(async (action: () => Promise<PushState>, success?: (s: PushState) => void) => {
    setBusy(true);
    try {
      const next = await action();
      setState(next);
      success?.(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  const turnOn = () =>
    run(enablePush, (s) => {
      if (s === "on") toast.success("Notifications are on for this device.");
      else if (s === "denied") toast.error("Notifications are blocked. Allow them in your settings to get reminders.");
    });
  const turnOff = () => run(disablePush, () => toast.success("Notifications are off for this device."));

  return { state, busy, turnOn, turnOff };
};

// iPhone and iPad only show web app notifications once the app is on the Home Screen.
export const InstallSteps = () => (
  <ol className="space-y-1.5 text-xs text-muted-foreground">
    <li className="flex items-center gap-2">
      <span className="font-semibold text-foreground">1.</span> Tap <Share className="h-3.5 w-3.5 text-primary" /> Share in
      Safari's toolbar.
    </li>
    <li className="flex items-center gap-2">
      <span className="font-semibold text-foreground">2.</span> Choose <SquarePlus className="h-3.5 w-3.5 text-primary" /> Add
      to Home Screen.
    </li>
    <li className="flex items-center gap-2">
      <span className="font-semibold text-foreground">3.</span> Open Octopus from your Home Screen and turn reminders on.
    </li>
  </ol>
);

/** What a player wants notifications for, on all their devices. Saved as soon as it's switched. */
const NotificationChoices = () => {
  const queryClient = useQueryClient();
  const { data: prefs } = useQuery({ queryKey: ["notification-preferences"], queryFn: api.push.preferences });
  const { mutate: save, isPending } = useMutation({
    mutationFn: api.push.setPreferences,
    onSuccess: (saved) => queryClient.setQueryData(["notification-preferences"], saved),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save your choice."),
  });

  const choices: { key: keyof NotificationPreferencesDto; label: string; help: string }[] = [
    {
      key: "reminders",
      label: "Prediction reminders",
      help: "Before a week's first match, if you haven't finished your predictions.",
    },
    {
      key: "announcements",
      label: "News from the admins",
      help: "Notifications the league's admins send, like a change to the fixtures.",
    },
    {
      key: "email",
      label: "By email when notifications are off",
      help: "If notifications aren't on in any of your browsers, get the reminders and news above by email instead.",
    },
  ];

  return (
    <div className="space-y-3">
      {choices.map((c) => (
        <div key={c.key} className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor={`notify-${c.key}`}>{c.label}</Label>
            <p className="text-xs text-muted-foreground">{c.help}</p>
          </div>
          <Switch
            id={`notify-${c.key}`}
            checked={prefs?.[c.key] ?? true}
            disabled={!prefs || isPending}
            onCheckedChange={(on) => prefs && save({ ...prefs, [c.key]: on })}
          />
        </div>
      ))}
    </div>
  );
};

/** For the Profile page: what to be notified about, and notifications on this device. */
export const NotificationsCard = () => {
  const { state, busy, turnOn, turnOff } = usePushState();
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true);
    try {
      const { reached } = await api.push.test();
      if (reached > 0) toast.success("Test sent. It should appear in a few seconds.");
      else toast.error("This device didn't take the test. Turn notifications off and on again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send a test.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Notifications</span>
      </div>

      <NotificationChoices />

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This device</span>
          {state === "on" && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded font-medium bg-success/20 text-success">On</span>
          )}
        </div>

        {state === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : state === "on" ? (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={sendTest} disabled={testing || busy}>
              {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send a test
            </Button>
            <Button variant="outline" className="flex-1" onClick={turnOff} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellOff className="h-4 w-4 mr-2" />}
              Turn off
            </Button>
          </div>
        ) : state === "off" ? (
          <>
            <p className="text-xs text-muted-foreground">Notifications are off on this device.</p>
            <Button className="w-full" onClick={turnOn} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellRing className="h-4 w-4 mr-2" />}
              Turn on notifications
            </Button>
          </>
        ) : state === "needs-install" ? (
          <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3">
            <p className="text-xs font-medium">On iPhone, add the app to your Home Screen first:</p>
            <InstallSteps />
          </div>
        ) : state === "denied" ? (
          <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.
          </p>
        ) : (
          <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            This browser can't show notifications. Try Chrome on Android, or the app from your iPhone's Home Screen.
          </p>
        )}
      </div>
    </div>
  );
};

const DISMISSED_KEY = "op_push_prompt_dismissed";

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/** For the Predict page: a one-time nudge to turn reminders on, until it's done or dismissed. */
export const NotificationsPrompt = () => {
  const { state, busy, turnOn } = usePushState();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (dismissed || (state !== "off" && state !== "needs-install")) return null;

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
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Never miss a week</p>
          <p className="text-xs text-muted-foreground">
            Get a reminder on this device before the first match if you haven't finished your predictions.
          </p>
        </div>
      </div>
      {state === "needs-install" ? (
        <InstallSteps />
      ) : (
        <Button size="sm" onClick={turnOn} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Turn on reminders
        </Button>
      )}
    </div>
  );
};
