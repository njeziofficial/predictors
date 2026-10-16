import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CircleAlert, CircleCheck, Loader2, Trophy, Wallet as WalletIcon } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import NavBar from "@/components/NavBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { api, type WalletEntryDto } from "@/lib/api";
import { getArea } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { describeEntry, formatNaira } from "@/lib/wallet";

const Stat = ({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={cn("mt-1 text-xl font-bold tabular-nums", strong && "text-primary")}>{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const EntryRow = ({ entry }: { entry: WalletEntryDto }) => {
  const struck = entry.reversed;
  // Entry fees went into the pot, so they aren't part of what you're owed: shown without a sign.
  const amount = entry.kind === "entry_fee" ? formatNaira(Math.abs(entry.amountKobo)) : formatNaira(entry.amountKobo, { signed: true });
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", struck && "text-muted-foreground line-through")}>{describeEntry(entry)}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(entry.occurredAt), "d MMM yyyy")}
          {entry.note && <> · {entry.note}</>}
          {struck && <> · reversed</>}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          struck ? "text-muted-foreground line-through" : entry.amountKobo > 0 && entry.kind !== "entry_fee" && "text-success",
        )}
      >
        {amount}
      </span>
    </li>
  );
};

const WalletBody = () => {
  const [season, setSeason] = useState<string>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet", season ?? "current"],
    queryFn: () => api.wallet.get(season),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <WalletIcon className="h-6 w-6 text-primary" /> Wallet
          </h1>
          <p className="text-sm text-muted-foreground">Your entry fee, winnings and payouts</p>
        </div>
        {data && data.seasons.length > 1 && (
          <Select value={data.season} onValueChange={setSeason}>
            <SelectTrigger className="w-32" aria-label="Season">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.seasons.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error || !data ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Couldn't load your wallet."}
        </p>
      ) : (
        <>
          {data.paid ? (
            <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-4">
              <CircleCheck className="h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold">Entry fee paid for {data.season}</p>
                <p className="text-xs text-muted-foreground">{formatNaira(data.paidInKobo)} is in the season pot.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <CircleAlert className="h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold">Entry fee not paid yet</p>
                <p className="text-xs text-muted-foreground">
                  The {data.season} entry fee is {formatNaira(data.entryFeeKobo)}. Pay the organiser and an admin will mark
                  it here.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Won" value={formatNaira(data.wonKobo)} />
            <Stat label="Paid to you" value={formatNaira(data.paidOutKobo)} />
            <Stat
              label="Still owed to you"
              value={formatNaira(data.balanceKobo)}
              hint={data.balanceKobo > 0 ? "Sent to your bank by the organiser" : undefined}
              strong={data.balanceKobo > 0}
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Season pot: {formatNaira(data.potKobo)}</p>
              <p className="text-xs text-muted-foreground">
                {data.paidPlayers === 1 ? "1 player has paid" : `${data.paidPlayers} players have paid`}. It's shared out at the end
                of the season.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card px-4">
            <p className="border-b border-border py-3 text-sm font-semibold">History</p>
            {data.entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing recorded for {data.season} yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.entries.map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </ul>
            )}
          </div>
          <p className="pb-4 text-[11px] text-muted-foreground">
            No money moves through the app: entry fees are paid to the organiser and winnings are sent to your bank account.
            This page records both.
          </p>
        </>
      )}
    </div>
  );
};

const Wallet = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) navigate("/");
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  // Admins see it inside whichever side they're using, as with Profile.
  if (currentUser.role === "admin" && getArea() === "backoffice") {
    return (
      <AdminLayout>
        <WalletBody />
      </AdminLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8 page-transition">
      <NavBar />
      <WalletBody />
    </div>
  );
};

export default Wallet;
