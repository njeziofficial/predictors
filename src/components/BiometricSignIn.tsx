import { useState } from "react";
import { Fingerprint, Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBiometricsAvailable } from "@/hooks/usePasskeys";
import { api, type AuthResponse } from "@/lib/api";
import {
  PasskeyCancelled,
  askForPasskey,
  biometricLabel,
  forgetPasskeyOnDevice,
  passkeyUsedHere,
  rememberPasskeyHere,
} from "@/lib/passkeys";

/**
 * "Sign in with Face ID / fingerprint" on the sign-in page, on devices that can. The phone offers
 * the passkeys it has for this site, so there's nothing to type. Shown more prominently once
 * it's been used on this device.
 */
const BiometricSignIn = ({
  onSignedIn,
  onError,
}: {
  onSignedIn: (res: AuthResponse) => void;
  onError: (message: string | null) => void;
}) => {
  const available = useBiometricsAvailable();
  const [busy, setBusy] = useState(false);
  const { method } = biometricLabel();

  if (!available) return null;

  const signIn = async () => {
    setBusy(true);
    onError(null);
    let credentialId: string | null = null;
    try {
      const { flowId, options } = await api.auth.passkeyOptions();
      const response = await askForPasskey(options);
      credentialId = response.rawId;
      const res = await api.auth.passkeyLogin(flowId, response);
      rememberPasskeyHere(credentialId);
      onSignedIn(res);
    } catch (err) {
      if (err instanceof PasskeyCancelled) return;
      const message = err instanceof Error ? err.message : "Couldn't sign in that way. Use your password instead.";
      // Removed from the account (turned off, or by a password reset): the phone can forget it.
      if (credentialId && /isn't set up/.test(message)) void forgetPasskeyOnDevice(credentialId);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  const Icon = /face/i.test(method) ? ScanFace : Fingerprint;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant={passkeyUsedHere() ? "default" : "outline"}
        className="h-11 w-full text-sm font-semibold"
        onClick={signIn}
        disabled={busy}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
        Sign in with {method}
      </Button>
    </div>
  );
};

export default BiometricSignIn;
