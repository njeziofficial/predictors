import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  ShieldOff,
  Trash2,
  Ban,
  CircleCheck,
  Lock,
  KeyRound,
  Copy,
  Check,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { api, type UserSummaryDto } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import CreateUserDialog from "@/components/CreateUserDialog";
import EditUserDialog from "@/components/EditUserDialog";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type RoleFilter = "all" | "admin" | "user";
type StatusFilter = "all" | "active" | "disabled";
type ActivityFilter = "all" | "recent" | "inactive" | "never";
type JoinedFilter = "all" | "7d" | "30d" | "90d";
type ContactFilter = "all" | "complete" | "missing";
type SortKey = "joined_desc" | "joined_asc" | "name_asc" | "name_desc" | "login_desc" | "login_asc";

// `recent` = logged in within the last 7 days; `inactive` = has logged in before, but not in 30+ days.
const RECENT_DAYS = 7;
const INACTIVE_DAYS = 30;

const DEFAULT_FILTERS = {
  role: "all" as RoleFilter,
  status: "all" as StatusFilter,
  activity: "all" as ActivityFilter,
  joined: "all" as JoinedFilter,
  contact: "all" as ContactFilter,
  sort: "joined_desc" as SortKey,
};

const loginTime = (u: UserSummaryDto) => (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : null);

const compareUsers = (sort: SortKey) => (a: UserSummaryDto, b: UserSummaryDto) => {
  switch (sort) {
    case "joined_desc":
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "joined_asc":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "name_asc":
      return a.name.localeCompare(b.name);
    case "name_desc":
      return b.name.localeCompare(a.name);
    case "login_desc":
    case "login_asc": {
      // Users who have never logged in always sink to the bottom, whichever direction.
      const la = loginTime(a);
      const lb = loginTime(b);
      if (la === null && lb === null) return 0;
      if (la === null) return 1;
      if (lb === null) return -1;
      return sort === "login_desc" ? lb - la : la - lb;
    }
  }
};

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

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Any change to what's being shown restarts from the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  const setFilter = <K extends keyof typeof DEFAULT_FILTERS>(key: K, value: (typeof DEFAULT_FILTERS)[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const hasActiveFilters =
    search.trim() !== "" ||
    (Object.keys(DEFAULT_FILTERS) as (keyof typeof DEFAULT_FILTERS)[]).some(
      (k) => k !== "sort" && filters[k] !== DEFAULT_FILTERS[k],
    );

  const clearFilters = () => {
    setSearch("");
    setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }));
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const now = new Date();
    const recentCutoff = subDays(now, RECENT_DAYS).getTime();
    const inactiveCutoff = subDays(now, INACTIVE_DAYS).getTime();
    const joinedDays = { "7d": 7, "30d": 30, "90d": 90 } as const;
    const joinedCutoff = filters.joined === "all" ? null : subDays(now, joinedDays[filters.joined]).getTime();

    return users
      .filter((u) => {
        if (debouncedSearch) {
          const haystack = [u.name, u.email, u.phoneNumber, u.whatsAppName]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(debouncedSearch)) return false;
        }
        if (filters.role !== "all" && u.role !== filters.role) return false;
        if (filters.status === "active" && u.isDisabled) return false;
        if (filters.status === "disabled" && !u.isDisabled) return false;

        const lastLogin = loginTime(u);
        if (filters.activity === "recent" && (lastLogin === null || lastLogin < recentCutoff)) return false;
        if (filters.activity === "inactive" && (lastLogin === null || lastLogin >= inactiveCutoff)) return false;
        if (filters.activity === "never" && lastLogin !== null) return false;

        if (joinedCutoff !== null && new Date(u.createdAt).getTime() < joinedCutoff) return false;

        const hasContact = !!u.phoneNumber && !!u.whatsAppName;
        if (filters.contact === "complete" && !hasContact) return false;
        if (filters.contact === "missing" && hasContact) return false;

        return true;
      })
      .sort(compareUsers(filters.sort));
  }, [users, debouncedSearch, filters]);

  const totalCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Deleting the last user on the final page would otherwise strand you on an empty page.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const counts = useMemo(
    () => ({
      total: users?.length ?? 0,
      admins: users?.filter((u) => u.role === "admin").length ?? 0,
      disabled: users?.filter((u) => u.isDisabled).length ?? 0,
    }),
    [users],
  );

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-sm text-muted-foreground">
              Manage accounts and roles
              {users && (
                <>
                  {" "}
                  · {counts.total} users · {counts.admins} admins · {counts.disabled} disabled
                </>
              )}
            </p>
          </div>
          {/* Creating accounts is the system user's call only — the backend enforces this too. */}
          {currentUser?.isSystemUser && <CreateUserDialog />}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, WhatsApp…"
                className="pl-9"
              />
            </div>
            <Select value={filters.sort} onValueChange={(v) => setFilter("sort", v as SortKey)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="joined_desc">Newest joined</SelectItem>
                <SelectItem value="joined_asc">Oldest joined</SelectItem>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc">Name Z–A</SelectItem>
                <SelectItem value="login_desc">Recently logged in</SelectItem>
                <SelectItem value="login_asc">Least recently logged in</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filters.role} onValueChange={(v) => setFilter("role", v as RoleFilter)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Users</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilter("status", v as StatusFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.activity} onValueChange={(v) => setFilter("activity", v as ActivityFilter)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any activity</SelectItem>
                <SelectItem value="recent">Active in last {RECENT_DAYS} days</SelectItem>
                <SelectItem value="inactive">Inactive {INACTIVE_DAYS}+ days</SelectItem>
                <SelectItem value="never">Never logged in</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.joined} onValueChange={(v) => setFilter("joined", v as JoinedFilter)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Joined any time</SelectItem>
                <SelectItem value="7d">Joined last 7 days</SelectItem>
                <SelectItem value="30d">Joined last 30 days</SelectItem>
                <SelectItem value="90d">Joined last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.contact} onValueChange={(v) => setFilter("contact", v as ContactFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any contact info</SelectItem>
                <SelectItem value="complete">Phone & WhatsApp set</SelectItem>
                <SelectItem value="missing">Missing phone/WhatsApp</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5 mr-1" /> Clear filters
              </Button>
            )}
          </div>
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
                {pagedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                      {users.length === 0 ? "No users yet." : "No users match your filters."}
                    </TableCell>
                  </TableRow>
                )}
                {pagedUsers.map((u: UserSummaryDto) => (
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
                      {currentUser?.isSystemUser && <EditUserDialog user={u} />}
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

        {users && totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <p className="text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
                {totalCount !== users.length && ` (filtered from ${users.length})`}
              </p>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
              </Button>
              <span className="text-muted-foreground text-xs">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
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
