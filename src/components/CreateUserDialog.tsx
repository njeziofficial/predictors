import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, Check } from "lucide-react";
import { api, type CreateUserPayload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const EMPTY_FORM = {
  name: "",
  email: "",
  role: "User" as CreateUserPayload["role"],
  phoneNumber: "",
  whatsAppName: "",
  password: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors the backend's CreateUserRequest validation so errors show inline instead of a bare HTTP 400.
const validate = (form: typeof EMPTY_FORM) => {
  const errors: Partial<Record<keyof typeof EMPTY_FORM, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Name must be at least 2 characters.";
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (form.password && form.password.length < 6) errors.password = "Password must be at least 6 characters.";
  return errors;
};

type Created = { name: string; role: CreateUserPayload["role"]; password: string | null };

// Only the system admin may create admins (`allowAdmin`); the backend refuses it for anyone else.
const CreateUserDialog = ({ allowAdmin = false }: { allowAdmin?: boolean }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const errors = submitted ? validate(form) : {};

  const setField = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setCreated(null);
    setCopied(false);
  };

  const { mutate: createUser, isPending } = useMutation({
    mutationFn: (payload: CreateUserPayload) => api.admin.users.create(payload),
    onSuccess: (res, payload) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`${res.user.name} created.`);
      setCreated({ name: res.user.name, role: payload.role, password: res.temporaryPassword });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create user."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validate(form)).length > 0) return;

    createUser({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      phoneNumber: form.phoneNumber.trim() || undefined,
      whatsAppName: form.whatsAppName.trim() || undefined,
      password: form.password || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" /> Create user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>{created.name} created</DialogTitle>
              <DialogDescription>
                {created.password
                  ? created.role === "Admin"
                    ? "Share this password with them through a secure channel. It won't be shown again — it's their password now, not a temporary one, since admins can't change their own."
                    : "Share this temporary password with the user through a secure channel. It won't be shown again, and they'll be forced to change it before they can submit predictions."
                  : created.role === "Admin"
                    ? "The admin can log in with the password you set."
                    : "The user can log in with the password you set, and will be forced to change it before they can submit predictions."}
              </DialogDescription>
            </DialogHeader>
            {created.password && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
                <code className="flex-1 font-mono text-sm">{created.password}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(created.password!);
                    setCopied(true);
                    toast.success("Copied to clipboard.");
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>
                Create another
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>Create user</DialogTitle>
              <DialogDescription>Add a new user or admin account.</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="cu-name">Name</Label>
              <Input id="cu-name" value={form.name} onChange={(e) => setField("name", e.target.value)} autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            {allowAdmin && (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setField("role", v as CreateUserPayload["role"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="User">User</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cu-phone">
                  Phone <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="cu-phone"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cu-whatsapp">
                  WhatsApp name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="cu-whatsapp"
                  value={form.whatsAppName}
                  onChange={(e) => setField("whatsAppName", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cu-password">
                Password <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <PasswordInput
                id="cu-password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder="Leave blank to generate one"
                autoComplete="new-password"
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Create {form.role === "Admin" ? "admin" : "user"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;
