import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing, Eye, Loader2, Plus, X } from "lucide-react";
import { api, type AdminStatusDto, type ScraperSettingsDto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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

// Kept in hours, as the backend's ReminderSchedule does (72 = 3 days). Same limits.
const DEFAULT_HOURS = [72, 48, 3];
const MIN_HOURS = 1;
const MAX_HOURS = 14 * 24;
const MAX_REMINDERS = 5;

type Unit = "days" | "hours";

const sortHours = (hours: number[]) => [...hours].sort((a, b) => b - a);
// Whole days read as days, anything else as hours (the backend's ReminderSchedule.Duration).
const reminderDuration = (h: number) =>
  h % 24 === 0 ? (h === 24 ? "1 day" : `${h / 24} days`) : h === 1 ? "1 hour" : `${h} hours`;
const listText = (hours: number[]) => {
  const parts = sortHours(hours).map(reminderDuration);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
};

interface Props {
  settings: ScraperSettingsDto;
  status?: AdminStatusDto;
  // Only the system admin may change reminders; everyone else with settings access sees them.
  canEdit: boolean;
}

/** Prediction reminders: on or off, and how long before each week's first match they go out. */
const ReminderSettingsCard = ({ settings, status, canEdit }: Props) => {
  const queryClient = useQueryClient();
  const savedHours = sortHours(settings.reminderOffsetsHours ?? DEFAULT_HOURS);
  const [enabled, setEnabled] = useState(settings.reminderEnabled);
  const [hours, setHours] = useState(savedHours);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit>("hours");

  // Follow the saved values (including another admin's save) until edited here.
  const savedKey = `${settings.reminderEnabled}|${savedHours.join(",")}`;
  useEffect(() => {
    setEnabled(settings.reminderEnabled);
    setHours(sortHours(settings.reminderOffsetsHours ?? DEFAULT_HOURS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const dirty = enabled !== settings.reminderEnabled || hours.join(",") !== savedHours.join(",");
  const value = Number(amount);
  const candidate = unit === "days" ? value * 24 : value;
  const candidateProblem =
    amount === ""
      ? null
      : !Number.isInteger(value) || candidate < MIN_HOURS || candidate > MAX_HOURS
        ? "Choose between 1 hour and 14 days."
        : hours.includes(candidate)
          ? "There's already a reminder at that time."
          : null;
  const canAdd = amount !== "" && !candidateProblem && hours.length < MAX_REMINDERS;

  const addReminder = () => {
    if (!canAdd) return;
    setHours(sortHours([...hours, candidate]));
    setAmount("");
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.admin.setReminders(enabled, hours),
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin-settings"], saved);
      queryClient.invalidateQueries({ queryKey: ["admin-status"] });
      toast.success(saved.reminderEnabled ? "Prediction reminders saved." : "Prediction reminders turned off.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save prediction reminders.");
    },
  });

  const reach = status?.playersWithNotifications;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Prediction reminders</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-destructive/20 text-destructive">
          System user only
        </span>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          View only. Only the system admin can change reminders.
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A push notification goes to every player who hasn't predicted all of a week's matches yet, at each time chosen
        below, counted back from the week's first match. Players can turn reminders off on their Profile.
        {status?.remindersConfigured && " Players with a phone number also get it by WhatsApp."}
      </p>

      {reach !== undefined && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Players with notifications turned on</span>
          <span className="font-medium">{reach}</span>
        </div>
      )}
      {reach === 0 && (
        <p className="text-xs text-muted-foreground">
          No one has turned notifications on yet. Players do it from the Predict page or their Profile. On iPhone they
          need to add the app to their Home Screen first.
        </p>
      )}

      <fieldset disabled={!canEdit} className="min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="reminders-enabled">Send reminders</Label>
            <p className="text-xs text-muted-foreground">Off: no reminders go out for any week.</p>
          </div>
          <Switch id="reminders-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-2">
          <Label className={!enabled ? "text-muted-foreground" : ""}>Before the week's first match</Label>
          <div className="flex flex-wrap gap-2">
            {hours.map((h) => (
              <span
                key={h}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium"
              >
                {reminderDuration(h)} before
                {canEdit && hours.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setHours(hours.filter((x) => x !== h))}
                    aria-label={`Remove the reminder ${reminderDuration(h)} before`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {canEdit && hours.length < MAX_REMINDERS && (
            <div className="flex flex-wrap gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder={unit === "days" ? "Days" : "Hours"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReminder();
                  }
                }}
                className="w-20 bg-secondary border-border"
                aria-label="How long before the first match"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                <SelectTrigger className="w-28 bg-secondary border-border" aria-label="Unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">hours</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addReminder} disabled={!canAdd}>
                <Plus className="h-4 w-4 mr-1" /> Add reminder
              </Button>
            </div>
          )}
          {candidateProblem && <p className="text-xs text-destructive">{candidateProblem}</p>}
          <p className="text-xs text-muted-foreground">
            Up to {MAX_REMINDERS} reminders, each between 1 hour and 14 days before. They go out within about 15 minutes
            of their time. If the server was asleep at one's time, players get just the latest one due, never two at
            once.
          </p>
        </div>

        {canEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" disabled={!dirty || isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save prediction reminders
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{enabled ? "Save prediction reminders?" : "Turn prediction reminders off?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {enabled
                    ? `Players who haven't finished predicting will be reminded ${listText(hours)} before each week's first match. This takes effect right away.`
                    : "No reminders will go out for any week until you turn them back on."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => save()}>{enabled ? "Save" : "Turn off"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </fieldset>
    </div>
  );
};

export default ReminderSettingsCard;
