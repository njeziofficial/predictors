import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrandMark } from "@/components/Brand";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsAppName, setWhatsAppName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useApp();
  const navigate = useNavigate();
  const { data: registration } = useQuery({
    queryKey: ["registration-status"],
    queryFn: api.auth.registrationStatus,
  });

  const passwordsMatch = password === confirmPassword;
  const allFilled =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    phoneNumber.trim().length > 0 &&
    whatsAppName.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;
  const canSubmit = allFilled && name.trim().length >= 2 && password.length >= 6 && passwordsMatch && !loading;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await api.auth.register(
        name.trim(),
        email.trim(),
        phoneNumber.trim(),
        whatsAppName.trim(),
        password,
      );
      login(res.token, {
        id: res.userId,
        name: res.name,
        email: res.email,
        role: res.role,
        mustResetPassword: res.mustResetPassword,
        isSystemUser: res.isSystemUser,
      });
      toast.success("Account created! Welcome aboard.");
      navigate("/predict");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <BrandMark className="mx-auto mb-2 h-14 w-14" />
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>Join Octopus Prediction</CardDescription>
        </CardHeader>
        <CardContent>
          {registration?.open === false ? (
            <div className="rounded-lg border border-border bg-secondary p-4 text-center space-y-1">
              <p className="text-sm font-medium">Registration is closed</p>
              <p className="text-xs text-muted-foreground">
                New sign-ups are not being accepted right now. Please contact an admin if you need an account.
              </p>
            </div>
          ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              minLength={2}
            />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              type="tel"
              placeholder="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              placeholder="WhatsApp Name"
              value={whatsAppName}
              onChange={(e) => setWhatsAppName(e.target.value)}
              required
              disabled={loading}
            />
            <PasswordInput
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
            <div className="space-y-1.5">
              <PasswordInput
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading ? "Creating account…" : "Register"}
            </Button>
          </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/" className="text-primary underline">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
