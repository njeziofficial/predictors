import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";

const KEY = ["session-settings"];
const MIN = 1;
const MAX = 1440;

/**
 * Settings: how many minutes without activity sign everyone (players and admins) out. Changing it
 * needs "security.idle_timeout", which only the system admin has until they grant it on Access
 * control; other admins see the current value.
 */
const IdleTimeoutCard = () => {
  const queryClient = useQueryClient();
  const { can, isSystemUser } = usePermissions();
  const canEdit = can("security.idle_timeout");
  const { data, isLoading } = useQuery({ queryKey: KEY, queryFn: api.auth.sessionSettings });

  const [minutes, setMinutes] = useState("");
  useEffect(() => {
    if (data) setMinutes(String(data.minutes));
  }, [data]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: api.admin.setIdleTimeout,
    onSuccess: (result) => {
      queryClient.setQueryData(KEY, result);
      toast.success(`Players and admins are now signed out after ${result.minutes} minutes without activity.`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save that."),
  });

  const value = Number(minutes);
  const valid = Number.isInteger(value) && value >= MIN && value <= MAX;
  const changed = data !== undefined && value !== data.minutes;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Idle sign-out</span>
        {!isSystemUser && !canEdit && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            System admin only
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Anyone signed in (players and admins) is signed out after this many minutes without a tap, click, key press or
        scroll, including when the app is closed or the phone is locked for that long.
      </p>

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && changed) save(value);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="idle-timeout-minutes">Minutes</Label>
            <Input
              id="idle-timeout-minutes"
              type="number"
              inputMode="numeric"
              min={MIN}
              max={MAX}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              disabled={!canEdit || isPending}
              className="w-28"
            />
          </div>
          {canEdit && (
            <Button type="submit" size="sm" disabled={!valid || !changed || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          )}
          {canEdit && minutes !== "" && !valid && (
            <p className="w-full text-xs text-destructive">
              Choose a whole number of minutes from {MIN} to {MAX}.
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export default IdleTimeoutCard;
