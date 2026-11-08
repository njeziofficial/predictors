import { describe, expect, it } from "vitest";
import type { WalletEntryDto } from "@/lib/api";
import { describeEntry, formatNaira, groupNairaInput, parseNaira } from "@/lib/wallet";

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

describe("groupNairaInput", () => {
  it("adds commas as an amount is typed", () => {
    expect(groupNairaInput("5000")).toBe("5,000");
    expect(groupNairaInput("1234567")).toBe("1,234,567");
    expect(groupNairaInput("999")).toBe("999");
    expect(groupNairaInput("5,0000")).toBe("50,000");
    expect(groupNairaInput("")).toBe("");
  });

  it("keeps decimals, a minus and what's still being typed", () => {
    expect(groupNairaInput("1250.")).toBe("1,250.");
    expect(groupNairaInput("1250.505")).toBe("1,250.50");
    expect(groupNairaInput("-2000")).toBe("-2,000");
    expect(groupNairaInput("0.5")).toBe("0.5");
  });

  it("gives back what parseNaira reads", () => {
    expect(parseNaira(groupNairaInput("1250000.75"))).toBe(125000075);
  });
});

describe("describeEntry", () => {
  it("names special game prizes but keeps their payouts as bank payments", () => {
    const prize = { kind: "adjustment" as const, amountKobo: 500000, note: "Special game: Real vs Barca ended 2-1 (₦10,000 shared by 2)" };
    expect(describeEntry(entry(prize))).toBe("Special game prize");
    expect(describeEntry(entry({ ...prize, amountKobo: -500000, reversesEntryId: "e0" }))).toBe("Special game prize reversed");
    expect(describeEntry(entry({ kind: "payout", amountKobo: -500000, note: "Special game: Real vs Barca" }))).toBe("Paid to your bank");
  });

  it("says what each entry means to the player", () => {
    expect(describeEntry(entry())).toBe("Entry fee paid");
    expect(describeEntry(entry({ kind: "payout", amountKobo: -500000 }))).toBe("Paid to your bank");
    expect(describeEntry(entry({ kind: "winnings", reversesEntryId: "e0", amountKobo: -100 }))).toBe("Winnings reversed");
  });

  it("names Ballon d'Or prizes, which are adjustments", () => {
    const prize = { kind: "adjustment" as const, amountKobo: 125000, note: "Ballon d'Or 2026: called the winner" };
    expect(describeEntry(entry(prize))).toBe("Ballon d'Or prize");
    expect(describeEntry(entry({ ...prize, amountKobo: -125000, reversesEntryId: "e0" }))).toBe("Ballon d'Or prize reversed");
    expect(describeEntry(entry({ kind: "adjustment", note: "Bank charge" }))).toBe("Adjustment");
  });
});
