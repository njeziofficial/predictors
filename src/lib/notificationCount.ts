/** A notification count as a badge shows it: nothing for none, "9+" past nine. */
export const badgeText = (count: number): string | null => (count <= 0 ? null : count > 9 ? "9+" : String(count));

const players = (n: number) => `${n} ${n === 1 ? "player" : "players"}`;

/**
 * What an admin's send did, in words. Everyone in the audience gets it in the app; only those
 * with notifications on in a browser (targeted) can get it on their phone, and reached of them did.
 */
export const sentSummary = ({
  targeted,
  reached,
  emailed = 0,
  inApp,
}: {
  targeted: number;
  reached: number;
  emailed?: number;
  inApp?: number;
}): string => {
  const inAppText = inApp != null ? `Sent to ${players(inApp)} in the app.` : "Sent.";
  const phones =
    targeted === 0
      ? " Nobody in it has phone notifications on, so they'll see it next time they open the app."
      : reached === targeted
        ? ` ${targeted === 1 ? "The 1 player" : `All ${targeted}`} with phone notifications on got it there too.`
        : ` ${reached} of the ${players(targeted)} with phone notifications on got it there; the rest will see it in the app.`;
  const email = emailed > 0 ? ` ${players(emailed)} also got it by email.` : "";
  return inAppText + phones + email;
};

/** What kind of notification it is, in words (InboxItemDto.kind). */
export const kindLabel = (kind: string): string =>
  kind === "announcement" ? "From the admins" : kind === "reminder" ? "Prediction reminder" : "Test notification";
