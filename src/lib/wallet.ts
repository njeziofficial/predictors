import type { WalletEntryDto, WalletKind } from "./api";

/** "₦3,000" or "₦1,250.50"; signed: true adds "+" to amounts above nothing. */
export function formatNaira(kobo: number, { signed = false } = {}): string {
  const naira = Math.abs(kobo) / 100;
  const text = `₦${naira.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (kobo < 0) return `−${text}`;
  return signed && kobo > 0 ? `+${text}` : text;
}

/** Naira typed by an admin ("3000", "3,000", "₦1,250.50") as kobo; null if it isn't an amount. */
export function parseNaira(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export const KIND_LABEL: Record<WalletKind, string> = {
  entry_fee: "Entry fee",
  winnings: "Winnings",
  payout: "Payout",
  adjustment: "Adjustment",
};

/** What an entry means to the player reading it. */
export function describeEntry(entry: WalletEntryDto): string {
  if (entry.reversesEntryId) return `${KIND_LABEL[entry.kind]} reversed`;
  switch (entry.kind) {
    case "entry_fee":
      return "Entry fee paid";
    case "winnings":
      return "Winnings";
    case "payout":
      return "Paid to your bank";
    default:
      return "Adjustment";
  }
}
