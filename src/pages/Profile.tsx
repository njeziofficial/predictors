import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, User as UserIcon, KeyRound } from "lucide-react";
import { BrandLoader } from "@/components/Brand";
import { useApp } from "@/context/AppContext";
import { api, type UserProfileDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import NavBar from "@/components/NavBar";
import AdminLayout from "@/components/AdminLayout";
import { getArea } from "@/lib/permissions";

const ProfileBody = ({ profile }: { profile: UserProfileDto }) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState(profile.name);
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber ?? "");
  const [whatsAppName, setWhatsAppName] = useState(profile.whatsAppName ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { mutate: saveProfile, isPending: isSavingProfile } = useMutation({
    mutationFn: () => api.users.updateProfile(name.trim(), phoneNumber.trim(), whatsAppName.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update profile."),
  });

  const { mutate: savePassword, isPending: isSavingPassword } = useMutation({
    mutationFn: () => api.users.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update password."),
  });

  const profileValid = name.trim().length >= 2 && phoneNumber.trim().length > 0 && whatsAppName.trim().length > 0;
  const passwordsMatch = newPassword === confirmPassword;
  const passwordFormFilled = currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;
  const canSavePassword = passwordFormFilled && newPassword.length >= 6 && passwordsMatch && !isSavingPassword;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account details</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Your details</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{profile.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="font-medium capitalize">{profile.role}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Member since</p>
            <p className="font-medium">{format(new Date(profile.createdAt), "MMM d, yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last login</p>
            <p className="font-medium">
              {profile.lastLoginAt ? format(new Date(profile.lastLoginAt), "MMM d, HH:mm") : "Never"}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Full name</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-secondary border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Phone number</Label>
          <Input
            id="profile-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="bg-secondary border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-whatsapp">WhatsApp name</Label>
          <Input
            id="profile-whatsapp"
            value={whatsAppName}
            onChange={(e) => setWhatsAppName(e.target.value)}
            className="bg-secondary border-border"
          />
        </div>

        <Button className="w-full" disabled={!profileValid || isSavingProfile} onClick={() => saveProfile()}>
          {isSavingProfile && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      </div>

      {profile.role === "admin" ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Change password</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Admins can't change their own password. Only the system user can reset it for you.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Change password</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-secondary border-border"
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
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-secondary border-border"
              minLength={6}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>

          <Button className="w-full" disabled={!canSavePassword} onClick={() => savePassword()}>
            {isSavingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </div>
      )}
    </div>
  );
};

const Profile = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile"],
    queryFn: api.users.me,
    enabled: !!currentUser,
    // Only changes when you save it here, which refreshes it.
    staleTime: 5 * 60_000,
  });

  if (!currentUser) return null;

  const body = (
    <>
      {isLoading && (
        <BrandLoader className="h-64" />
      )}
      {error && (
        <div className="mx-auto max-w-2xl px-4 pt-12">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load profile</p>
          </div>
        </div>
      )}
      {profile && <ProfileBody profile={profile} />}
    </>
  );

  // Admins see their profile inside whichever side they're using.
  if (currentUser.role === "admin" && getArea() === "backoffice") {
    return <AdminLayout>{body}</AdminLayout>;
  }

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />
      {body}
    </div>
  );
};

export default Profile;
