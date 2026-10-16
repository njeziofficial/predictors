import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, History, Loader2, MoreHorizontal, Search, Settings2, Wallet as WalletIcon } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/AppContext";
import { api, type AdminWalletDto, type WalletEntryDto, type WalletKind, type WalletPlayerDto } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatNaira, KIND_LABEL, parseNaira } from "@/lib/wallet";

type Filter = "all" | "unpaid" | "paid" | "owed";
type RecordKind = Exclude<WalletKind, "entry_fee">;

const walletKey = (season: string | undefined) => ["admin-wallet", season ?? "current"] as const;
const today = () => format(new Date(), "yyyy-MM-dd");
// A picked day, sent as midday local time so it stays on that day in any timezone.
const dayToIso = (day: string) => new Date(`${day}T12:00:00`).toISOString();
const displayName = (p: WalletPlayerDto) => p.whatsAppName || p.name;

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

const Tile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

// ── Mark entry fees as paid ──────────────────────────────────────────────────

const MarkPaidDialog = ({
  players,
  wallet,
  onClose,
  onSaved,
}: {
  players: WalletPlayerDto[];
  wallet: AdminWalletDto;
  onClose: () => void;
  onSaved: (wallet: AdminWalletDto) => void;
}) => {
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const total = players.length * wallet.entryFeeKobo;

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.admin.wallet.recordEntryFees(
        players.map((p) => p.userId),
        wallet.season,
        note.trim() || undefined,
        dayToIso(day),
      );
      onSaved(result.wallet);
      toast.success(
        result.recorded === 1 ? "1 player marked as paid" : `${result.recorded} players marked as paid`,
        result.alreadyPaid ? { description: `${result.alreadyPaid} had already paid and were skipped.` } : undefined,
      );
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't record the payments."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as paid</DialogTitle>
          <DialogDescription>
            Records the {wallet.season} entry fee of {formatNaira(wallet.entryFeeKobo)} for{" "}
            {players.length === 1 ? "1 player" : `${players.length} players`} ({formatNaira(total)} into the pot).
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-sm">
          {players.map((p) => (
            <li key={p.userId}>{displayName(p)}</li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="paid-on">Paid on</Label>
            <Input id="paid-on" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="paid-note">Note (optional)</Label>
            <Input id="paid-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Transfer reference" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !day}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mark as paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Winnings, payout or adjustment for one player ────────────────────────────

const RECORD_HELP: Record<RecordKind, string> = {
  winnings: "Their share of the pot under the sharing formula. Adds to what they're owed.",
  payout: "Money you've sent to their bank account. Takes from what they're owed.",
  adjustment: "Anything else. Use a minus amount to take from what they're owed. Needs a note.",
};

const RecordDialog = ({
  player,
  initialKind,
  wallet,
  onClose,
  onSaved,
}: {
  player: WalletPlayerDto;
  initialKind: RecordKind;
  wallet: AdminWalletDto;
  onClose: () => void;
  onSaved: (wallet: AdminWalletDto) => void;
}) => {
  const [kind, setKind] = useState<RecordKind>(initialKind);
  const [amount, setAmount] = useState(() => (initialKind === "payout" && player.balanceKobo > 0 ? String(player.balanceKobo / 100) : ""));
  const [day, setDay] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const kobo = parseNaira(amount);
  const invalid =
    kobo === null || kobo === 0 || (kind !== "adjustment" && kobo < 0) || (kind === "adjustment" && !note.trim());

  const save = async () => {
    if (invalid || kobo === null) return;
    setSaving(true);
    try {
      const next = await api.admin.wallet.record({
        userId: player.userId,
        kind,
        amountKobo: kobo,
        season: wallet.season,
        note: note.trim() || undefined,
        occurredAt: dayToIso(day),
      });
      onSaved(next);
      toast.success(`${KIND_LABEL[kind]} of ${formatNaira(Math.abs(kobo))} recorded for ${displayName(player)}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't record it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record for {displayName(player)}</DialogTitle>
          <DialogDescription>
            {wallet.season} · owed {formatNaira(player.balanceKobo)} · {formatNaira(wallet.unallocatedKobo)} of the pot not yet
            shared out
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>What</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RecordKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="winnings">Winnings</SelectItem>
                <SelectItem value="payout">Payout to their bank</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{RECORD_HELP[kind]}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="record-amount">Amount (₦)</Label>
              <Input
                id="record-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                autoFocus
              />
              {amount && kobo === null && <p className="text-xs text-destructive">Enter an amount like 5000 or 1250.50.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="record-day">Date</Label>
              <Input id="record-day" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="record-note">Note{kind === "adjustment" ? "" : " (optional)"}</Label>
            <Textarea
              id="record-note"
              value={note}
              maxLength={300}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === "payout" ? "Transfer reference" : kind === "winnings" ? "e.g. 1st place" : "Why"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || invalid || !day}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── One player's entries, with reversal ──────────────────────────────────────

const LedgerDialog = ({
  player,
  season,
  canManage,
  onClose,
  onSaved,
}: {
  player: WalletPlayerDto;
  season: string;
  canManage: boolean;
  onClose: () => void;
  onSaved: (wallet: AdminWalletDto) => void;
}) => {
  const queryClient = useQueryClient();
  const key = ["admin-wallet-player", player.userId, season];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.admin.wallet.player(player.userId, season) });
  const [reversing, setReversing] = useState<WalletEntryDto | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const reverse = async () => {
    if (!reversing || !reason.trim()) return;
    setSaving(true);
    try {
      onSaved(await api.admin.wallet.reverse(reversing.id, reason.trim()));
      await queryClient.invalidateQueries({ queryKey: key });
      toast.success("Entry reversed");
      setReversing(null);
      setReason("");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't reverse it."));
    } finally {
      setSaving(false);
    }
  };

  const p = data?.player ?? player;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{displayName(p)}</DialogTitle>
          <DialogDescription>
            {season} · paid {formatNaira(p.paidInKobo)} · won {formatNaira(p.wonKobo)} · paid out {formatNaira(p.paidOutKobo)} ·
            owed {formatNaira(p.balanceKobo)}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{errorMessage(error, "Couldn't load the entries.")}</p>
        ) : data.entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing recorded for {season}.</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", e.reversed && "text-muted-foreground line-through")}>
                    {e.reversesEntryId ? `Reversal of ${KIND_LABEL[e.kind].toLowerCase()}` : KIND_LABEL[e.kind]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.occurredAt), "d MMM yyyy")} · by {e.createdByName || "unknown"}
                    {e.note && <> · {e.note}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("text-sm font-semibold tabular-nums", e.reversed && "text-muted-foreground line-through")}>
                    {formatNaira(e.amountKobo, { signed: true })}
                  </span>
                  {canManage && !e.reversed && !e.reversesEntryId && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReversing(e)}>
                      Reverse
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {reversing && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm">
              Reverse the {KIND_LABEL[reversing.kind].toLowerCase()} of {formatNaira(Math.abs(reversing.amountKobo))}? It stays in
              the history, cancelled by an opposite entry.
            </p>
            <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Why (required)" autoFocus />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setReversing(null)} disabled={saving}>
                Keep it
              </Button>
              <Button size="sm" variant="destructive" onClick={reverse} disabled={saving || !reason.trim()}>
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Reverse
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Season and entry fee (system admin) ──────────────────────────────────────

const SeasonDialog = ({
  wallet,
  onClose,
  onSaved,
}: {
  wallet: AdminWalletDto;
  onClose: () => void;
  onSaved: (wallet: AdminWalletDto) => void;
}) => {
  const [season, setSeason] = useState(wallet.currentSeason);
  const [fee, setFee] = useState(String(wallet.entryFeeKobo / 100));
  const [saving, setSaving] = useState(false);
  const kobo = parseNaira(fee);
  const invalid = !/^\d{4}\/\d{2}$/.test(season) || kobo === null || kobo <= 0;

  const save = async () => {
    if (invalid || kobo === null) return;
    setSaving(true);
    try {
      onSaved(await api.admin.wallet.updateSettings(season, kobo));
      toast.success("Wallet settings saved");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Season and entry fee</DialogTitle>
          <DialogDescription>
            New entries go to this season. Changing it starts a fresh pot; earlier seasons keep theirs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wallet-season">Current season</Label>
            <Input id="wallet-season" value={season} onChange={(e) => setSeason(e.target.value.trim())} placeholder="2026/27" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wallet-fee">Entry fee (₦)</Label>
            <Input id="wallet-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || invalid}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── The page ─────────────────────────────────────────────────────────────────

const AdminWallet = () => {
  const { currentUser } = useApp();
  const { can, isSystemUser } = usePermissions();
  const canView = currentUser?.role === "admin" && can("wallet.view");
  const canManage = can("wallet.manage");
  const queryClient = useQueryClient();

  const [season, setSeason] = useState<string>();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [markPaid, setMarkPaid] = useState<WalletPlayerDto[] | null>(null);
  const [recording, setRecording] = useState<{ player: WalletPlayerDto; kind: RecordKind } | null>(null);
  const [ledger, setLedger] = useState<WalletPlayerDto | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: walletKey(season),
    queryFn: () => api.admin.wallet.get(season),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  const onSaved = (next: AdminWalletDto) => {
    queryClient.setQueryData(walletKey(next.season), next);
    if (next.season !== season) setSeason(next.season);
    queryClient.invalidateQueries({ queryKey: ["admin-wallet"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    setSelected(new Set());
  };

  const players = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.players ?? []).filter((p) => {
      if (filter === "unpaid" && p.paid) return false;
      if (filter === "paid" && !p.paid) return false;
      if (filter === "owed" && p.balanceKobo <= 0) return false;
      return !q || p.name.toLowerCase().includes(q) || (p.whatsAppName ?? "").toLowerCase().includes(q);
    });
  }, [data, filter, search]);

  // Only players not yet paid can be ticked for "Mark as paid".
  const selectable = players.filter((p) => !p.paid);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.userId));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!canView) {
    return (
      <AdminLayout>
        <p className="px-6 pt-16 text-center text-sm text-muted-foreground">You don't have permission to view wallets.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl space-y-5 px-4 pb-10 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <WalletIcon className="h-6 w-6 text-primary" /> Wallet
            </h1>
            <p className="text-sm text-muted-foreground">
              Entry fees, winnings and payouts. The money itself moves by bank transfer; this is the record.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data && data.seasons.length > 1 && (
              <Select value={data.season} onValueChange={setSeason}>
                <SelectTrigger className="w-32" aria-label="Season">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.seasons.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                      {s === data.currentSeason ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isSystemUser && data && (
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="mr-1.5 h-4 w-4" /> Season
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error || !data ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{errorMessage(error, "Couldn't load the wallet.")}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Tile
                label={`Pot · ${data.season}`}
                value={formatNaira(data.potKobo)}
                hint={`${data.paidPlayers} of ${data.players.length} paid · ${formatNaira(data.entryFeeKobo)} each`}
              />
              <Tile label="Shared out" value={formatNaira(data.allocatedKobo)} hint="As winnings" />
              <Tile label="Left to share" value={formatNaira(data.unallocatedKobo)} />
              <Tile label="Paid out" value={formatNaira(data.paidOutKobo)} hint="Sent to bank accounts" />
              <Tile label="Still owed" value={formatNaira(data.owedKobo)} hint="Won, not yet sent" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search players" className="pl-9" />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="w-40" aria-label="Show">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All players</SelectItem>
                  <SelectItem value="unpaid">Not paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="owed">Owed winnings</SelectItem>
                </SelectContent>
              </Select>
              {canManage && (
                <Button
                  onClick={() => setMarkPaid(data.players.filter((p) => selected.has(p.userId)))}
                  disabled={selected.size === 0}
                >
                  Mark {selected.size || ""} as paid
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    {canManage && (
                      <th className="w-10 px-3 py-2.5">
                        <Checkbox
                          checked={allSelected}
                          disabled={selectable.length === 0}
                          onCheckedChange={(on) =>
                            setSelected(on ? new Set(selectable.map((p) => p.userId)) : new Set())
                          }
                          aria-label="Select everyone not paid"
                        />
                      </th>
                    )}
                    <th className="px-3 py-2.5 font-medium">Player</th>
                    <th className="px-3 py-2.5 font-medium">Entry fee</th>
                    <th className="px-3 py-2.5 text-right font-medium">Won</th>
                    <th className="px-3 py-2.5 text-right font-medium">Paid out</th>
                    <th className="px-3 py-2.5 text-right font-medium">Owed</th>
                    <th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                        No players match.
                      </td>
                    </tr>
                  ) : (
                    players.map((p) => (
                      <tr key={p.userId} className="border-b border-border last:border-0">
                        {canManage && (
                          <td className="px-3 py-2.5">
                            <Checkbox
                              checked={selected.has(p.userId)}
                              disabled={p.paid}
                              onCheckedChange={() => toggle(p.userId)}
                              aria-label={`Select ${displayName(p)}`}
                            />
                          </td>
                        )}
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{displayName(p)}</p>
                          {(p.whatsAppName || p.isDisabled) && (
                            <p className="text-xs text-muted-foreground">
                              {p.whatsAppName && p.name}
                              {p.isDisabled && " · disabled"}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {p.paid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                              <CircleCheck className="h-3 w-3" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                              <CircleAlert className="h-3 w-3" /> Not paid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{p.wonKobo ? formatNaira(p.wonKobo) : "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{p.paidOutKobo ? formatNaira(p.paidOutKobo) : "—"}</td>
                        <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", p.balanceKobo > 0 && "text-primary")}>
                          {p.balanceKobo ? formatNaira(p.balanceKobo) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`Options for ${displayName(p)}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setLedger(p)}>
                                <History className="mr-2 h-3.5 w-3.5" /> View entries
                              </DropdownMenuItem>
                              {canManage && (
                                <>
                                  <DropdownMenuSeparator />
                                  {!p.paid && <DropdownMenuItem onClick={() => setMarkPaid([p])}>Mark as paid</DropdownMenuItem>}
                                  <DropdownMenuItem onClick={() => setRecording({ player: p, kind: "winnings" })}>
                                    Record winnings
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={p.balanceKobo <= 0}
                                    onClick={() => setRecording({ player: p, kind: "payout" })}
                                  >
                                    Record payout
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setRecording({ player: p, kind: "adjustment" })}>
                                    Adjustment
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {markPaid && <MarkPaidDialog players={markPaid} wallet={data} onClose={() => setMarkPaid(null)} onSaved={onSaved} />}
            {recording && (
              <RecordDialog
                player={recording.player}
                initialKind={recording.kind}
                wallet={data}
                onClose={() => setRecording(null)}
                onSaved={onSaved}
              />
            )}
            {ledger && (
              <LedgerDialog
                player={ledger}
                season={data.season}
                canManage={canManage}
                onClose={() => setLedger(null)}
                onSaved={onSaved}
              />
            )}
            {settingsOpen && <SeasonDialog wallet={data} onClose={() => setSettingsOpen(false)} onSaved={onSaved} />}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminWallet;
