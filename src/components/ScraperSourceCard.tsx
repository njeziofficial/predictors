import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Eye, Globe, Loader2 } from "lucide-react";
import { api, type ScraperSettingsDto, type SourceMode } from "@/lib/api";
import {
  SOURCE_MODES,
  describeSource,
  moveSource,
  sameSource,
  savedSource,
  sourceError,
  sourceWarnings,
  toggleSource,
  type ScraperSource,
} from "@/lib/scraperSource";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

interface Props {
  settings: ScraperSettingsDto;
  /** Only the system user may change the source; everyone else with settings access sees it. */
  canEdit: boolean;
}

// Which site(s) live scores come from. Saved on its own (not by "Save settings"), and only by
// the system user: a bad choice can stop new weeks appearing or feed every player wrong scores.
const ScraperSourceCard = ({ settings, canEdit }: Props) => {
  const queryClient = useQueryClient();
  const saved = savedSource(settings);
  const available = settings.availableSources;
  const roundSources = settings.roundSources ?? [];

  // Follows the saved choice (including another session's change) until edited here.
  const [draft, setDraft] = useState<ScraperSource>(saved);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(savedSource(settings));
  }, [settings, dirty]);

  const edit = (change: Partial<ScraperSource>) => {
    setDraft((prev) => ({ ...prev, ...change }));
    setDirty(true);
  };

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.admin.setScraperSource(draft),
    onSuccess: (next) => {
      queryClient.setQueryData(["admin-settings"], next);
      setDirty(false);
      toast.success("Live score source saved. It's used from the next poll.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save the live score source.");
    },
  });

  const error = sourceError(draft);
  const warnings = sourceWarnings(draft, roundSources);
  const changed = dirty && !sameSource(draft, saved);
  // Chosen sources first, in order, then the rest as they're listed by the backend.
  const listed = [...draft.sourceOrder, ...available.filter((s) => !draft.sourceOrder.includes(s))];

  const roundBadge = (name: string) =>
    roundSources.includes(name) && (
      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary/15 text-primary">Adds weeks</span>
    );

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Live score source</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-destructive/20 text-destructive">
          System user only
        </span>
      </div>

      {!canEdit ? (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            View only. Only the system admin can change where live scores come from.
          </div>
          <div className="flex items-start justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{SOURCE_MODES.find((m) => m.value === saved.mode)?.label}</span>
            <span className="text-right">{describeSource(saved)}</span>
          </div>
        </>
      ) : (
        <>
          <RadioGroup
            value={draft.mode}
            onValueChange={(v) => edit({ mode: v as SourceMode })}
            className="gap-3"
          >
            {SOURCE_MODES.map((m) => (
              <div key={m.value} className="flex items-start gap-3">
                <RadioGroupItem value={m.value} id={`source-mode-${m.value}`} className="mt-0.5" />
                <div>
                  <Label htmlFor={`source-mode-${m.value}`}>{m.label}</Label>
                  <p className="text-xs text-muted-foreground">{m.help}</p>
                </div>
              </div>
            ))}
          </RadioGroup>

          {draft.mode === "Single" ? (
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Select value={draft.sourceName} onValueChange={(v) => edit({ sourceName: v })}>
                <SelectTrigger id="source" className="bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {available.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                      {roundSources.includes(s) && " (adds weeks)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Sources, in order</Label>
              <p className="text-xs text-muted-foreground">
                Tick the sites to use and put them in order.{" "}
                {draft.mode === "Fallback"
                  ? "The first is read every poll; the rest only when the ones before fail."
                  : "Each poll starts one further down the list."}
              </p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {listed.map((name) => {
                  const position = draft.sourceOrder.indexOf(name);
                  const included = position >= 0;
                  return (
                    <li key={name} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={`source-${name}`}
                        checked={included}
                        onCheckedChange={() => edit({ sourceOrder: toggleSource(draft.sourceOrder, name) })}
                      />
                      <Label
                        htmlFor={`source-${name}`}
                        className={`flex flex-1 items-center gap-2 ${included ? "" : "text-muted-foreground"}`}
                      >
                        {included && <span className="w-4 text-xs text-muted-foreground">{position + 1}.</span>}
                        {name}
                        {roundBadge(name)}
                      </Label>
                      {included && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            aria-label={`Move ${name} up`}
                            disabled={position === 0}
                            onClick={() => edit({ sourceOrder: moveSource(draft.sourceOrder, name, -1) })}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            aria-label={`Move ${name} down`}
                            disabled={position === draft.sourceOrder.length - 1}
                            onClick={() => edit({ sourceOrder: moveSource(draft.sourceOrder, name, 1) })}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          {warnings.map((w) => (
            <div
              key={w}
              className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
              <span>{w}</span>
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            Switching is safe at any time: fixtures are matched by team name, so predictions and points carry over. A
            match that has started or finished never goes back to "not started", and only sources that give the date
            can change a kickoff time.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" disabled={!changed || !!error || isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save live score source
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Change the live score source?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{describeSource(draft)}</p>
                    {warnings.map((w) => (
                      <p key={w}>{w}</p>
                    ))}
                    <p>This takes effect from the next poll; it doesn't require saving settings below.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => save()}>Apply</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
};

export default ScraperSourceCard;
