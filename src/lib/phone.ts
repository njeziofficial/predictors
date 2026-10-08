// Players type their numbers locally ("0803 123 4567"); WhatsApp links need the international
// form without "+" ("2348031234567"). Numbers without a country code are taken as Nigerian.
const DEFAULT_COUNTRY_CODE = "234";

export const toWhatsAppNumber = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  else if (!trimmed.startsWith("+") && digits.startsWith("0")) digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
  return digits.length >= 8 ? digits : null;
};

export const whatsAppLink = (phone: string | null | undefined, message: string): string | null => {
  const number = toWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
};
