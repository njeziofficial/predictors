import { describe, expect, it } from "vitest";
import type { WalletEntryDto } from "@/lib/api";
import { describeEntry, formatNaira, parseNaira } from "@/lib/wallet";

const entry = (over: Partial<WalletEntryDto> = {}): WalletEntryDto => ({
  id: "e1",
  userId: "u1",
  season: "2026/27",
  kind: "entry_fee",
  amountKobo: 300000,
  note: null,
  occurredAt: "2026-08-01T12:00:00Z",
  createdAt: "2026-08-01T12:00:00Z",
  createdByName: "Admin",
  reversesEntryId: null,
  reversed: false,
  ...over,
});

describe("formatNaira", () => {
  it("shows naira from kobo, with kobo only when there are some", () => {
    expect(formatNaira(300000)).toBe("₦3,000");
    expect(formatNaira(125050)).toBe("₦1,250.5");
    expect(formatNaira(0)).toBe("₦0");
  });

  it("signs amounts when asked, and always signs a minus", () => {
    expect(formatNaira(500000, { signed: true })).toBe("+₦5,000");
    expect(formatNaira(-500000)).toBe("−₦5,000");
    expect(formatNaira(0, { signed: true })).toBe("₦0");
  });
});

describe("parseNaira", () => {
  it("reads what an admin types as kobo", () => {
    expect(parseNaira("3000")).toBe(300000);
    expect(parseNaira("₦3,000")).toBe(300000);
    expect(parseNaira("1250.50")).toBe(125050);
    expect(parseNaira("-200")).toBe(-20000);
  });

  it("refuses what isn't an amount", () => {
    expect(parseNaira("")).toBeNull();
    expect(parseNaira("three thousand")).toBeNull();
    expect(parseNaira("1.234")).toBeNull();
  });
});

describe("describeEntry", () => {
  it("says what each entry means to the player", () => {
    expect(describeEntry(entry())).toBe("Entry fee paid");
    expect(describeEntry(entry({ kind: "payout", amountKobo: -500000 }))).toBe("Paid to your bank");
    expect(describeEntry(entry({ kind: "winnings", reversesEntryId: "e0", amountKobo: -100 }))).toBe("Winnings reversed");
  });
});
