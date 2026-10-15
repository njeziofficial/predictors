/** A notification count as a badge shows it: nothing for none, "9+" past nine. */
export const badgeText = (count: number): string | null => (count <= 0 ? null : count > 9 ? "9+" : String(count));
