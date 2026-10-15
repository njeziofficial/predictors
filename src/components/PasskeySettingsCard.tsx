import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

const KEY = ["passkey-settings"];

/**
 * Settings, system admin only: whether resetting a password (by an admin, or with a Forgot
 * password email) also removes the account's fingerprint/face sign-in. Off: a reset leaves
 * passkeys alone, as they don't depend on the password. On: after a reset only the new
 * password works until the player turns fingerprint/face back on.
 */
const PasskeySettingsCard = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: api.admin.passkeySettings.get });

  const { mutate: save, isPending } = useMutation({
    mutationFn: api.admin.passkeySettings.set,
    onSuccess: (result) => {
      queryClient.setQueryData(KEY, result);
      toast.success(
        result.removeOnPasswordReset
          ? "A password reset now also turns off fingerprint and face sign-in."
          : "A password reset now leaves fingerprint and face sign-in on.",
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save that."),
  });

  const on = data?.removeOnPasswordReset ?? false;

  return (
    <div className="rounded-xl border border-destructive/30 bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="h-4 w-4 text-destructive" />
        <span className="text-sm font-semibold">Fingerprint &amp; Face ID sign-in</span>
        <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          System user only
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="remove-passkeys-on-reset">Turn it off when a password is reset</Label>
          <p className="text-xs text-muted-foreground">
            Applies when an admin resets a player's password, and when a player resets theirs with a Forgot password
            email. On: their fingerprint and face sign-in is removed on every device, so only the new password works
            until they turn it back on in Profile. Off: it keeps working, since it doesn't depend on the password.
            Choose On if resets are usually because an account may have been taken over.
          </p>
        </div>
        {isLoading || isPending ? (
          <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Switch id="remove-passkeys-on-reset" checked={on} onCheckedChange={(next) => save(next)} className="mt-1 shrink-0" />
        )}
      </div>
    </div>
  );
};

export default PasskeySettingsCard;
