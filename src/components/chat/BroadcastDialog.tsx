import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { chatKeys, MAX_MESSAGE_LENGTH } from "@/lib/chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import ChatAvatar from "./ChatAvatar";

type Audience = "everyone" | "chosen";

/**
 * An admin message to many players at once. Each copy lands in that player's own chat with the
 * admin, so replies come back as ordinary messages.
 */
const BroadcastDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: chatKeys.directory,
    queryFn: api.chat.directory,
    enabled: open,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? users.filter((u) => u.name.toLowerCase().includes(q) || u.whatsAppName?.toLowerCase().includes(q))
      : users;
  }, [users, search]);

  const recipientCount = audience === "everyone" ? users.length : chosen.size;

  const reset = () => {
    setBody("");
    setAudience("everyone");
    setChosen(new Set());
    setSearch("");
  };

  const { mutate: send, isPending } = useMutation({
    mutationFn: () => api.chat.broadcast(body.trim(), audience === "chosen" ? [...chosen] : undefined),
    onSuccess: ({ recipients }) => {
      toast.success(`Announcement sent to ${recipients} ${recipients === 1 ? "player" : "players"}.`);
      queryClient.invalidateQueries({ queryKey: chatKeys.all });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't send the announcement."),
  });

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allFilteredChosen = filtered.length > 0 && filtered.every((u) => chosen.has(u.id));
  const canSend = body.trim().length > 0 && recipientCount > 0 && !isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
              <Megaphone className="h-4 w-4 text-primary" />
            </span>
            New announcement
          </DialogTitle>
          <DialogDescription>
            Each player gets it in their chat with you, and can reply there.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Send to</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
              {(["everyone", "chosen"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium transition-colors",
                    audience === a ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a === "everyone" ? (
                    <>
                      <Users className="h-3.5 w-3.5" /> Everyone {isLoading ? "" : `(${users.length})`}
                    </>
                  ) : (
                    <>Choose players{chosen.size > 0 ? ` (${chosen.size})` : ""}</>
                  )}
                </button>
              ))}
            </div>
          </div>

          {audience === "chosen" && (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players"
                  className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() =>
                    setChosen((current) => {
                      const next = new Set(current);
                      filtered.forEach((u) => (allFilteredChosen ? next.delete(u.id) : next.add(u.id)));
                      return next;
                    })
                  }
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {allFilteredChosen ? "Clear" : "Select all"}
                </button>
              </div>
              <div className="max-h-52 overflow-y-auto p-1">
                {isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nobody by that name.</p>
                ) : (
                  filtered.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary/60"
                    >
                      <Checkbox checked={chosen.has(u.id)} onCheckedChange={() => toggle(u.id)} />
                      <ChatAvatar id={u.id} name={u.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                      {u.isAdmin && <span className="text-[10px] uppercase text-primary">Admin</span>}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={5}
              placeholder="e.g. Gameweek 8 predictions close Friday at 7pm — get yours in!"
              className="block w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
            />
            <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">
              {body.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => send()} disabled={!canSend}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
            Send to {recipientCount} {recipientCount === 1 ? "player" : "players"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BroadcastDialog;
