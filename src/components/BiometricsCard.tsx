import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Fingerprint, Loader2, ScanFace, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PASSKEYS_KEY, useBiometricsAvailable, useSetUpBiometrics } from "@/hooks/usePasskeys";
import { api, type PasskeyDto } from "@/lib/api";
import { biometricLabel, forgetPasskeyOnDevice, passkeyIdHere, rememberPasskeyHere } from "@/lib/passkeys";

/**
 * Profile: signing in with fingerprint or face (passkeys). A switch turns it on or off for the
 * device the player is on; their other devices are listed below to remove. Off until they turn
 * it on, and their password works either way.
 */
export const BiometricsCard = () => {
  const queryClient = useQueryClient();
  const available = useBiometricsAvailable();
  const { method } = biometricLabel();
  const [hereId, setHereId] = useState(passkeyIdHere);
  const [removing, setRemoving] = useState<PasskeyDto | null>(null);

  const { data: passkeys = [], isLoading, isSuccess } = useQuery({ queryKey: PASSKEYS_KEY, queryFn: api.passkeys.list });
  const thisDevice = hereId ? passkeys.find((p) => p.credentialId === hereId) : undefined;
  const others = passkeys.filter((p) => p !== thisDevice);

  // This device's passkey was removed elsewhere (another device, or a password reset): it's off.
  useEffect(() => {
    if (isSuccess && hereId && !thisDevice) {
      rememberPasskeyHere(null);
      setHereId(null);
    }
  }, [isSuccess, hereId, thisDevice]);

  const setUp = useSetUpBiometrics(() => setHereId(passkeyIdHere()));

  const remove = useMutation({
    mutationFn: (passkey: PasskeyDto) => api.passkeys.remove(passkey.id),
    onSuccess: (_, passkey) => {
      void forgetPasskeyOnDevice(passkey.credentialId);
      if (passkey === thisDevice) setHereId(null);
      toast.success(
        passkey === thisDevice
          ? `${method[0].toUpperCase()}${method.slice(1)} sign-in is off on this device.`
          : `Removed "${passkey.name}". It signs in with your password now.`,
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't turn that off."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  });

  const on = !!thisDevice;
  const busy = setUp.isPending || remove.isPending;
  const toggle = (next: boolean) => {
    if (next) setUp.mutate();
    else if (thisDevice) setRemoving(thisDevice);
  };

  const Icon = /face/i.test(method) ? ScanFace : Fingerprint;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Fingerprint &amp; Face ID</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Sign in with your fingerprint or face instead of typing your password. It's optional, and your password keeps
        working. Your fingerprint and face never leave your device; the app only gets a secure key from it.
      </p>

      {available === null || isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : available ? (
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-3">
          <Icon className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <Label htmlFor="biometrics-here" className="text-sm font-medium">
              Use {method} on this device
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {on ? "On. The sign-in page offers it." : "Off. You sign in with your password."}
            </p>
          </div>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch id="biometrics-here" checked={on} onCheckedChange={toggle} disabled={busy} />
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          This device or browser can't sign in with fingerprint or face. On a phone, set up a fingerprint, face or screen
          lock in its settings, then open the app in Chrome (Android) or Safari (iPhone).
        </p>
      )}

      {others.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {available ? "Your other devices" : "Devices that can sign you in"}
          </span>
          <ul className="space-y-2">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Added {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    {p.lastUsedAt && ` · last used ${formatDistanceToNow(new Date(p.lastUsedAt), { addSuffix: true })}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${p.name}`}
                  className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setRemoving(p)}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removing === thisDevice ? `Turn off ${method} on this device?` : `Remove "${removing?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removing === thisDevice ? "You'll sign in here with your password." : "That device won't be able to sign you in with fingerprint or face any more; it'll use your password."}{" "}
              You can turn it back on any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removing && remove.mutate(removing)}
            >
              {removing === thisDevice ? "Turn off" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
