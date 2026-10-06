import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { api, type UpdateUserDetailsPayload, type UserSummaryDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = Required<UpdateUserDetailsPayload>;

const toForm = (u: UserSummaryDto): Form => ({
  name: u.name,
  email: u.email,
  phoneNumber: u.phoneNumber ?? "",
  whatsAppName: u.whatsAppName ?? "",
});

// Only the fields that differ from the saved user, trimmed — so one detail or all of them can be updated.
const changedFields = (form: Form, original: Form): UpdateUserDetailsPayload => {
  const changes: UpdateUserDetailsPayload = {};
  (Object.keys(form) as (keyof Form)[]).forEach((key) => {
    const value = form[key].trim();
    if (value !== original[key]) changes[key] = value;
  });
  return changes;
};

// Mirrors the backend's UpdateDetails checks, for the fields being changed only.
const validate = (changes: UpdateUserDetailsPayload, isSystemUser: boolean) => {
  const errors: Partial<Record<keyof Form, string>> = {};
  if (changes.name !== undefined && changes.name.length < 2) errors.name = "Name must be at least 2 characters.";
  if (changes.email !== undefined) {
    if (isSystemUser) errors.email = "The system user's email can only be changed in the server configuration.";
    else if (!EMAIL_RE.test(changes.email)) errors.email = "Enter a valid email address.";
  }
  return errors;
};

// System user only: edit a user's name, email, phone and WhatsApp name. Save is enabled as soon
// as any one field changes, and only the changed fields are sent.
const EditUserDialog = ({ user }: { user: UserSummaryDto }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(user));

  const original = toForm(user);
  const changes = changedFields(form, original);
  const hasChanges = Object.keys(changes).length > 0;
  const errors = validate(changes, user.isSystemUser);

  const setField = (key: keyof Form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload: UpdateUserDetailsPayload) => api.admin.users.updateDetails(user.id, payload),
    onSuccess: (updated, payload) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      const count = Object.keys(payload).length;
      toast.success(`Updated ${count} detail${count === 1 ? "" : "s"} for ${updated.name}.`);
      setOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update user."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || Object.keys(errors).length > 0) return;
    save(changes);
  };

  const field = (key: keyof Form, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`eu-${key}`}>
        {label}
        {changes[key] !== undefined && <span className="ml-1.5 text-[11px] font-normal text-primary">edited</span>}
      </Label>
      <Input
        id={`eu-${key}`}
        type={type}
        value={form[key]}
        disabled={key === "email" && user.isSystemUser}
        onChange={(e) => setField(key, e.target.value)}
      />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Start from the latest saved details each time it opens.
        if (next) setForm(toForm(user));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Edit details">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit {user.name}</DialogTitle>
            <DialogDescription>
              Change any of these details — only the ones you edit are saved. Clear phone or WhatsApp name to remove
              it.
            </DialogDescription>
          </DialogHeader>

          {field("name", "Name")}
          {field("email", "Email", "email")}
          {user.isSystemUser && (
            <p className="-mt-2 text-[11px] text-muted-foreground">
              The system user's email is set in the server configuration.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field("phoneNumber", "Phone", "tel")}
            {field("whatsAppName", "WhatsApp name")}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!hasChanges || Object.keys(errors).length > 0 || isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Save{hasChanges ? ` ${Object.keys(changes).length} change${Object.keys(changes).length === 1 ? "" : "s"}` : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;
