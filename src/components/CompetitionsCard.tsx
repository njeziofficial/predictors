import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Loader2, Trophy } from "lucide-react";
import { api, type CompetitionDto } from "@/lib/api";
import { LA_LIGA, useCompetition } from "@/context/CompetitionContext";
import { usePermissions } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/**
 * The competitions players predict, each with its own weeks and tables, and the switch that
 * opens or closes one. La Liga is always on. Needs "Switch competitions on or off".
 */
const CompetitionsCard = () => {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canSwitch = can("competitions.manage");
  const { options: competitions } = useCompetition("admin");
  // The switch waiting on its confirmation.
  const [pending, setPending] = useState<CompetitionDto | null>(null);

  const { mutate: setEnabled, isPending } = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.admin.competitions.setEnabled(id, enabled),
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-competitions-scraping"] });
      toast.success(
        c.enabled
          ? `${c.name} is open. Its fixtures are being read now and will appear for players shortly.`
          : `${c.name} is closed. Its weeks and points are kept for when it comes back.`,
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to change the competition."),
  });

  if (competitions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Competitions</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Each competition has its own weeks, weekly tables and season table. Players only see the ones that are on.
      </p>

      {!canSwitch && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          View only. Ask the system admin for "Switch competitions on or off" to change these.
        </div>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {competitions.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.id === LA_LIGA
                  ? "Always on"
                  : c.enabled
                    ? "On: players can see and predict it"
                    : "Off: hidden from players, not scraped"}
              </p>
            </div>
            <Switch
              aria-label={`${c.name} on`}
              checked={c.enabled}
              disabled={!canSwitch || c.id === LA_LIGA || isPending}
              onCheckedChange={() => setPending(c)}
            />
          </li>
        ))}
      </ul>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.enabled ? `Switch ${pending?.name} off?` : `Switch ${pending?.name} on?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {pending?.enabled ? (
                  <>
                    <p>Players stop seeing it and can't predict it. The scraper stops reading it.</p>
                    <p>Its weeks, predictions and points are kept, and come back if you switch it on again.</p>
                  </>
                ) : (
                  <>
                    <p>
                      Players get a competition switcher and can predict {pending?.name}, with its own weekly and season
                      tables. The scraper starts reading its fixtures straight away.
                    </p>
                    <p>La Liga isn't affected.</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) setEnabled({ id: pending.id, enabled: !pending.enabled });
                setPending(null);
              }}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pending?.enabled ? "Switch off" : "Switch on"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompetitionsCard;
