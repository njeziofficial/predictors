import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, LinkIcon } from "lucide-react";
import { api } from "@/lib/api";
import { BrandLoader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

/** Chooses a password with the link from a Forgot password or welcome email (/set-password?token=…). */
const SetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: link, isLoading } = useQuery({
    queryKey: ["password-token", token],
    queryFn: () => api.auth.checkPasswordToken(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.auth.setPassword(token, newPassword),
    onSuccess: () => {
      toast.success("Password saved. Sign in with it now.");
      navigate("/", { replace: true });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save your password."),
  });

  const passwordsMatch = newPassword === confirmPassword;
  const canSave = newPassword.length >= 6 && passwordsMatch && !isPending;
  const welcome = link?.purpose === "welcome";

  if (token && isLoading) return <BrandLoader className="min-h-screen" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-6">
        {!link?.valid ? (
          <div className="text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-lg bg-destructive/15 flex items-center justify-center">
              <LinkIcon className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">This link doesn't work</h2>
            <p className="text-sm text-muted-foreground">
              It has expired or was already used. Password links work once: an hour for a reset, a week for a welcome
              email.
            </p>
            <Button asChild className="w-full">
              <Link to="/forgot-password">Send a new link</Link>
            </Button>
            <Link to="/" className="block text-sm text-muted-foreground hover:text-foreground">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">{welcome ? `Welcome, ${link.name?.split(" ")[0] ?? ""}` : "Choose a new password"}</h2>
              <p className="text-sm text-muted-foreground">
                {welcome
                  ? "Choose the password you'll sign in with."
                  : "Choose a new password. You'll be signed out on your other devices."}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canSave) save();
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="set-new-password">New password</Label>
                <PasswordInput
                  id="set-new-password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-secondary border-border"
                  minLength={6}
                  disabled={isPending}
                  required
                />
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-xs text-muted-foreground">At least 6 characters.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set-confirm-password">Confirm new password</Label>
                <PasswordInput
                  id="set-confirm-password"
                  autoComplete="new-password"
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
                Save password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default SetPassword;
