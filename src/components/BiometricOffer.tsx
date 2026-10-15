import { useEffect, useState } from "react";
import { Fingerprint, Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApp } from "@/context/AppContext";
import { useSetUpBiometrics } from "@/hooks/usePasskeys";
import { api } from "@/lib/api";
import { biometricLabel, biometricsAvailable, declineBiometricsOffer, takeBiometricsOffer } from "@/lib/passkeys";

/**
 * Right after a password sign-in, on a device that can and hasn't been set up: a one-time
 * offer to sign in with fingerprint or face next time. The player decides; "Not now" stops it
 * being offered on this device, and Profile has the same option any time.
 */
const BiometricOffer = () => {
  const { currentUser } = useApp();
  const [open, setOpen] = useState(false);
  const { method } = biometricLabel();
  const setUp = useSetUpBiometrics(() => setOpen(false));

  useEffect(() => {
    if (!currentUser || currentUser.mustResetPassword || !takeBiometricsOffer()) return;
    let live = true;
    void (async () => {
      if (!(await biometricsAvailable())) return;
      // Already has passkeys (set up on another device, say): Profile is enough.
      const existing = await api.passkeys.list().catch(() => null);
      if (live && existing?.length === 0) setOpen(true);
    })();
    return () => {
      live = false;
    };
  }, [currentUser]);

  const notNow = () => {
    declineBiometricsOffer();
    setOpen(false);
  };

  const Icon = /face/i.test(method) ? ScanFace : Fingerprint;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && notNow()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Icon className="h-6 w-6 text-primary" />
          </span>
          <DialogTitle>Sign in faster next time?</DialogTitle>
          <DialogDescription>
            Use your {method} instead of typing your password. Your fingerprint and face stay on your device. You can turn
            it off any time in Profile.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={() => setUp.mutate()} disabled={setUp.isPending}>
            {setUp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
            Use {method}
          </Button>
          <Button variant="ghost" className="w-full" onClick={notNow} disabled={setUp.isPending}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BiometricOffer;
