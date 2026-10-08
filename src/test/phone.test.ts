import { describe, it, expect } from "vitest";
import { toWhatsAppNumber, whatsAppLink } from "@/lib/phone";

describe("toWhatsAppNumber", () => {
  it("turns local Nigerian numbers into international ones", () => {
    expect(toWhatsAppNumber("08031234567")).toBe("2348031234567");
    expect(toWhatsAppNumber("0803 123 4567")).toBe("2348031234567");
  });

  it("keeps numbers that already have a country code", () => {
    expect(toWhatsAppNumber("+234 803 123 4567")).toBe("2348031234567");
    expect(toWhatsAppNumber("+44 7700 900123")).toBe("447700900123");
    expect(toWhatsAppNumber("00447700900123")).toBe("447700900123");
    expect(toWhatsAppNumber("2348031234567")).toBe("2348031234567");
  });

  it("gives up on missing or too-short numbers", () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber("0800")).toBeNull();
  });
});

describe("whatsAppLink", () => {
  it("builds a wa.me link with the message filled in", () => {
    expect(whatsAppLink("08031234567", "Hi Jules & co")).toBe("https://wa.me/2348031234567?text=Hi%20Jules%20%26%20co");
    expect(whatsAppLink(null, "Hi")).toBeNull();
  });
});
