import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PasskeyCancelled, biometricLabel, biometricsAvailable, createPasskey, rememberPasskeyHere } from "@/lib/passkeys";

export const PASSKEYS_KEY = ["passkeys"];

/** Whether this device can sign in with fingerprint or face; null while finding out. */
export const useBiometricsAvailable = () => {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void biometricsAvailable().then((yes) => live && setAvailable(yes));
    return () => {
      live = false;
    };
  }, []);
  return available;
};

/** Sets up signing in with this device's fingerprint or face for the signed-in user. */
export const useSetUpBiometrics = (onDone?: () => void) => {
  const queryClient = useQueryClient();
  const { method, deviceName } = biometricLabel();

  return useMutation({
    mutationFn: async () => {
      const { flowId, options } = await api.passkeys.registrationOptions();
      const response = await createPasskey(options);
      return api.passkeys.register(flowId, deviceName, response);
    },
    onSuccess: (passkey) => {
      rememberPasskeyHere(passkey.credentialId);
      toast.success(`Done. Next time, sign in with your ${method}.`);
      onDone?.();
    },
    onError: (err) => {
      // Closing the phone's prompt isn't an error worth a message.
      if (err instanceof PasskeyCancelled) return;
      toast.error(err instanceof Error ? err.message : "Couldn't set that up. Please try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  });
};
