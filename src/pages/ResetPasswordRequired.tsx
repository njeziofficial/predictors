import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const ResetPasswordRequired = () => {
  const { currentUser, updateUser } = useApp();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  const { mutate: savePassword, isPending } = useMutation({
    mutationFn: () => api.users.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      updateUser({ mustResetPassword: false });
      toast.success("Password updated.");
      navigate(currentUser?.role === "admin" ? "/choose" : "/predict");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update password."),
  });

  if (!currentUser) return null;

  const passwordsMatch = newPassword === confirmPassword;
  const formFilled = currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;
  const canSave = formFilled && newPassword.length >= 6 && passwordsMatch && !isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Set a new password</h2>
          <p className="text-sm text-muted-foreground">
            An admin reset your password. Enter the temporary password you were given, then choose a new one to
            continue.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) savePassword();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="temp-password">Temporary password</Label>
            <PasswordInput
              id="temp-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-secondary border-border"
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-secondary border-border"
              minLength={6}
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-secondary border-border"
              minLength={6}
              disabled={isPending}
              required
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!canSave}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordRequired;
