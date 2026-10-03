import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Shield, ShieldOff, Trash2, Ban, CircleCheck, Lock, KeyRound, Copy, Check } from "lucide-react";
import { api, type UserSummaryDto } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [pendingResetId, setPendingResetId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; password: string; role: "user" | "admin" } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.admin.users.list,
    enabled: currentUser?.role === "admin",
  });

  const { mutate: setRole, isPending: isSettingRole } = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "Admin" | "User" }) => api.admin.users.setRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update role."),
  });

  const { mutate: setStatus, isPending: isSettingStatus } = useMutation({
    mutationFn: ({ id, isDisabled }: { id: string; isDisabled: boolean }) =>
      api.admin.users.setStatus(id, isDisabled),
    onSuccess: (_, { isDisabled }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(isDisabled ? "User disabled." : "User re-enabled.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update status."),
  });

  const { mutate: resetPassword, isPending: isResetting } = useMutation({
    mutationFn: (id: string) => api.admin.users.resetPassword(id),
    onSuccess: (res, id) => {
      const user = users?.find((u) => u.id === id);
      setResetResult({ name: user?.name ?? "User", password: res.temporaryPassword, role: user?.role ?? "user" });
      setPendingResetId(null);
      setCopied(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to reset password."),
  });

  const { mutate: removeUser, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.admin.users.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted.");
      setPendingDeleteId(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete user."),
  });

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-6 pt-8 pb-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage accounts and roles</p>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load users</p>
          </div>
        )}

        {users && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: UserSummaryDto) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        {u.name}
                        {u.isSystemUser && (
                          <span
                            className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary/20 text-primary"
                            title="System user — cannot be modified, disabled, or deleted"
                          >
                            <Lock className="h-2.5 w-2.5" /> System
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.phoneNumber ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.whatsAppName ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          u.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          u.isDisabled ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
                        }`}
                      >
                        {u.isDisabled ? "disabled" : "active"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.lastLoginAt ? format(new Date(u.lastLoginAt), "MMM d, HH:mm") : "Never"}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      {(() => {
                        const demoteBlocked = u.role === "admin" && currentUser?.isSystemUser !== true;
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSettingRole || u.isSystemUser || demoteBlocked}
                            title={
                              u.isSystemUser
                                ? "The system user's role cannot be changed"
                                : demoteBlocked
                                  ? "Only the system user can demote another admin"
                                  : undefined
                            }
                            onClick={() => setRole({ id: u.id, role: u.role === "admin" ? "User" : "Admin" })}
                          >
                            {u.role === "admin" ? (
                              <>
                                <ShieldOff className="h-3.5 w-3.5 mr-1" /> Demote
                              </>
                            ) : (
                              <>
                                <Shield className="h-3.5 w-3.5 mr-1" /> Promote
                              </>
                            )}
                          </Button>
                        );
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSettingStatus || u.id === currentUser?.id || u.isSystemUser}
                        title={
                          u.isSystemUser
                            ? "The system user can never be disabled"
                            : u.id === currentUser?.id
                              ? "You cannot disable your own account"
                              : undefined
                        }
                        onClick={() => setStatus({ id: u.id, isDisabled: !u.isDisabled })}
                      >
                        {u.isDisabled ? (
                          <>
                            <CircleCheck className="h-3.5 w-3.5 mr-1" /> Enable
                          </>
                        ) : (
                          <>
                            <Ban className="h-3.5 w-3.5 mr-1" /> Disable
                          </>
                        )}
                      </Button>
                      {(() => {
                        const canReset =
                          !u.isSystemUser && (u.role !== "admin" || currentUser?.isSystemUser === true);
                        const disabledReason = u.isSystemUser
                          ? "The system user's password can never be changed"
                          : u.role === "admin"
                            ? "Only the system user can reset another admin's password"
                            : undefined;
                        return (
                          <AlertDialog
                            open={pendingResetId === u.id}
                            onOpenChange={(open) => setPendingResetId(open ? u.id : null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isResetting || !canReset}
                                title={disabledReason}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reset {u.name}'s password?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {u.role === "admin"
                                    ? `A new password will be generated and shown once. Unlike a regular user, ${u.name} won't be forced to change it — this becomes their password directly, and only the system user can reset it again.`
                                    : `A new temporary password will be generated and shown once. ${u.name} will be forced to change it the next time they try to submit predictions.`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction disabled={isResetting} onClick={() => resetPassword(u.id)}>
                                  {isResetting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                  Reset password
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        );
                      })()}
                      {(() => {
                        const deleteBlocked = u.role === "admin" && currentUser?.isSystemUser !== true;
                        const deleteDisabledReason = u.isSystemUser
                          ? "The system user can never be deleted"
                          : deleteBlocked
                            ? "Only the system user can delete another admin"
                            : undefined;
                        return (
                      <AlertDialog
                        open={pendingDeleteId === u.id}
                        onOpenChange={(open) => setPendingDeleteId(open ? u.id : null)}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={u.isSystemUser || deleteBlocked}
                            title={deleteDisabledReason}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {u.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the user and all of their predictions. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction disabled={isDeleting} onClick={() => removeUser(u.id)}>
                              {isDeleting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AlertDialog open={!!resetResult} onOpenChange={(open) => !open && setResetResult(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Password reset for {resetResult?.name}</AlertDialogTitle>
              <AlertDialogDescription>
                {resetResult?.role === "admin"
                  ? "Share this password with them through a secure channel. It won't be shown again — it's their password now, not a temporary one, since admins can't change their own."
                  : "Share this temporary password with the user through a secure channel. It won't be shown again, and they'll be forced to change it before they can submit predictions."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
              <code className="flex-1 font-mono text-sm">{resetResult?.password}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!resetResult) return;
                  await navigator.clipboard.writeText(resetResult.password);
                  setCopied(true);
                  toast.success("Copied to clipboard.");
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setResetResult(null)}>Done</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
