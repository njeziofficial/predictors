import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Users, UserCog, Lock, RotateCcw, Info } from "lucide-react";
import { api, type AdminPermissionsDto, type PermissionDefinitionDto, type PermissionsOverviewDto } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

type Tab = "defaults" | "admins";
type Choice = "default" | "allow" | "deny";

// Powers that never move away from the system admin, shown so nobody hunts for a switch.
const RESERVED = [
  "Promoting players to admin and demoting admins",
  "Creating admin accounts",
  "Editing, disabling, resetting or deleting another admin",
  "Changing anyone's back-office permissions",
  "Turning the audit log on or off",
  "Loading test data or clearing the database",
];

const groupBy = (permissions: PermissionDefinitionDto[]) => {
  const groups = new Map<string, PermissionDefinitionDto[]>();
  permissions.forEach((p) => groups.set(p.group, [...(groups.get(p.group) ?? []), p]));
  return [...groups.entries()];
};

const AdminAccessControl = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("defaults");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: api.admin.permissions.overview,
  });

  const onSaved = (next: PermissionsOverviewDto) => {
    queryClient.setQueryData(["admin-permissions"], next);
    // Admins' own permission checks (including any signed in elsewhere) pick this up on refetch.
    queryClient.invalidateQueries({ queryKey: ["admin-permissions-me"] });
  };

  const { mutate: saveDefault, isPending: savingDefault, variables: pendingDefault } = useMutation({
    mutationFn: ({ key, allowed }: { key: string; allowed: boolean }) =>
      api.admin.permissions.updateDefaults({ [key]: allowed }),
    onSuccess: (next, { allowed }) => {
      onSaved(next);
      toast.success(allowed ? "Allowed for all admins." : "Removed for all admins.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save."),
  });

  const { mutate: saveAdmin, isPending: savingAdmin } = useMutation({
    mutationFn: ({ userId, overrides }: { userId: string; overrides: Record<string, boolean | null> }) =>
      api.admin.permissions.updateAdmin(userId, overrides),
    onSuccess: (next) => {
      onSaved(next);
      toast.success("Permissions updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save."),
  });

  const groups = useMemo(() => groupBy(data?.permissions ?? []), [data]);
  const admins = data?.admins ?? [];
  const selected: AdminPermissionsDto | undefined = admins.find((a) => a.userId === selectedId) ?? admins[0];

  return (
    <AdminLayout systemOnly>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-8 pb-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Access Control</h1>
          <p className="text-sm text-muted-foreground">
            Decide what admins can do in the back office. As the system admin you always have full access.
          </p>
        </div>

        <div className="flex w-fit gap-1 rounded-lg bg-secondary p-1">
          {(
            [
              ["defaults", "All admins", Users],
              ["admins", "Individual admins", UserCog],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === value ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load permissions."}
          </div>
        )}

        {data && tab === "defaults" && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              These apply to every admin unless you set an exception for them under Individual admins.
            </p>
            {groups.map(([group, permissions]) => (
              <section key={group} className="overflow-hidden rounded-xl border border-border bg-card">
                <h2 className="border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {group}
                </h2>
                <div className="divide-y divide-border">
                  {permissions.map((p) => {
                    const saving = savingDefault && pendingDefault?.key === p.key;
                    return (
                      <label key={p.key} className="flex cursor-pointer items-center gap-4 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        </div>
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                        <Switch
                          checked={data.defaults[p.key] === true}
                          disabled={savingDefault}
                          onCheckedChange={(allowed) => saveDefault({ key: p.key, allowed })}
                          aria-label={p.label}
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {data && tab === "admins" && admins.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <UserCog className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-60" />
            <p className="text-sm font-medium">No other admins yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Promote a player on the Users page to give them access.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/admin/users")}>
              Go to Users
            </Button>
          </div>
        )}

        {data && tab === "admins" && selected && (
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            {/* Admin picker */}
            <div className="overflow-hidden rounded-xl border border-border bg-card md:self-start">
              {admins.map((a) => {
                const exceptions = Object.keys(a.overrides).length;
                const active = a.userId === selected.userId;
                return (
                  <button
                    key={a.userId}
                    onClick={() => setSelectedId(a.userId)}
                    className={`flex w-full flex-col items-start border-b border-border px-4 py-3 text-left last:border-b-0 transition-colors ${
                      active ? "bg-primary/10" : "hover:bg-secondary/50"
                    }`}
                  >
                    <span className={`text-sm font-medium ${active ? "text-primary" : ""}`}>{a.name}</span>
                    <span className="w-full truncate text-xs text-muted-foreground">{a.email}</span>
                    <span className="mt-1 text-[10px] text-muted-foreground">
                      {a.isDisabled ? "Disabled · " : ""}
                      {exceptions === 0 ? "Follows defaults" : `${exceptions} exception${exceptions === 1 ? "" : "s"}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Their permissions */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    "Default" follows the All admins setting. Allow or Deny makes an exception for {selected.name.split(" ")[0]}.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingAdmin || Object.keys(selected.overrides).length === 0}
                  onClick={() =>
                    saveAdmin({
                      userId: selected.userId,
                      overrides: Object.fromEntries(Object.keys(selected.overrides).map((k) => [k, null])),
                    })
                  }
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to defaults
                </Button>
              </div>

              {groups.map(([group, permissions]) => (
                <section key={group} className="overflow-hidden rounded-xl border border-border bg-card">
                  <h3 className="border-b border-border bg-secondary/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {group}
                  </h3>
                  <div className="divide-y divide-border">
                    {permissions.map((p) => {
                      const override = selected.overrides[p.key];
                      const choice: Choice = override === undefined ? "default" : override ? "allow" : "deny";
                      const effective = selected.effective[p.key] === true;
                      return (
                        <div key={p.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 text-sm font-medium">
                              {p.label}
                              <span
                                className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                                  effective ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                {effective ? "Has access" : "No access"}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">{p.description}</p>
                          </div>
                          <div className="flex shrink-0 gap-1 rounded-lg bg-secondary p-1" role="radiogroup" aria-label={p.label}>
                            {(
                              [
                                ["default", `Default (${data.defaults[p.key] ? "on" : "off"})`],
                                ["allow", "Allow"],
                                ["deny", "Deny"],
                              ] as const
                            ).map(([value, label]) => (
                              <button
                                key={value}
                                role="radio"
                                aria-checked={choice === value}
                                disabled={savingAdmin}
                                onClick={() =>
                                  choice !== value &&
                                  saveAdmin({
                                    userId: selected.userId,
                                    overrides: { [p.key]: value === "default" ? null : value === "allow" },
                                  })
                                }
                                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                                  choice === value
                                    ? value === "deny"
                                      ? "bg-destructive/20 text-destructive"
                                      : value === "allow"
                                        ? "bg-success/20 text-success"
                                        : "bg-background text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {data && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4 text-primary" /> Always yours
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These stay with the system admin and can't be given to other admins:
            </p>
            <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
              {RESERVED.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-primary/80" />
                  {r}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAccessControl;
