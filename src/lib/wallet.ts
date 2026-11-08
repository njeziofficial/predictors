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

/** An amount as it's being typed, with thousands commas: "5000.5" becomes "5,000.5". Keeps a minus and an unfinished decimal. */
export function groupNairaInput(input: string): string {
  const cleaned = input.replace(/[^\d.-]/g, "");
  const [whole, ...decimals] = cleaned.replace(/-/g, "").split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+$)/g, ",");
  const decimal = cleaned.includes(".") ? `.${decimals.join("").slice(0, 2)}` : "";
  return `${cleaned.startsWith("-") ? "-" : ""}${grouped}${decimal}`;
}

export const KIND_LABEL: Record<WalletKind, string> = {
  entry_fee: "Entry fee",
  winnings: "Winnings",
  payout: "Payout",
  adjustment: "Adjustment",
};

// Ballon d'Or prizes are adjustments (the organiser's money, not the season pot) noted like this.
const isBallonDorPrize = (entry: WalletEntryDto) => entry.kind === "adjustment" && !!entry.note?.startsWith("Ballon d'Or");

// Special game prizes and their payouts are noted like this, and managed on that page.
export const isSpecialGameEntry = (entry: WalletEntryDto) => !!entry.note?.startsWith("Special game:");

/** What an entry means to the player reading it. */
export function describeEntry(entry: WalletEntryDto): string {
  if (entry.kind === "adjustment" && isSpecialGameEntry(entry))
    return entry.reversesEntryId ? "Special game prize reversed" : "Special game prize";
  if (isBallonDorPrize(entry)) return entry.reversesEntryId ? "Ballon d'Or prize reversed" : "Ballon d'Or prize";
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
