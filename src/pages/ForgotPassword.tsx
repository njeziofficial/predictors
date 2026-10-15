import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Asks for a link to choose a new password. The answer never says whether the email has an account. */
const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const { mutate: send, isPending, data, error } = useMutation({ mutationFn: () => api.auth.forgotPassword(email.trim()) });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            {data ? <MailCheck className="h-6 w-6 text-primary" /> : <Mail className="h-6 w-6 text-primary" />}
          </div>
          <h2 className="text-xl font-bold">{data ? "Check your email" : "Forgot your password?"}</h2>
          <p className="text-sm text-muted-foreground">
            {data
              ? data.message
              : "Enter the email on your account and we'll send you a link to choose a new password."}
          </p>
        </div>

        {!data && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) send();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-secondary border-border"
                disabled={isPending}
                required
              />
            </div>
            {error && <p className="text-xs text-destructive">{error instanceof Error ? error.message : "Something went wrong."}</p>}
            <Button type="submit" className="w-full" disabled={!email.trim() || isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send link
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Signed up with your WhatsApp name only, or an admin? Ask an admin to reset your password.
            </p>
          </form>
        )}

        <Link to="/" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
