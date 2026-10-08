import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useChat } from "@/context/ChatContext";

/**
 * Shared data the server announces when it changes (LiveUpdateNotifier → the hub's DataChanged),
 * mapped to the cached queries built from it. Invalidating only refetches queries a page is
 * showing right now; the rest are just marked stale and reload when next used.
 */
export type LiveArea = "fixtures" | "leaderboard" | "settings";

export const LIVE_AREA_QUERIES: Record<LiveArea, QueryKey[]> = {
  // Scores, statuses and kickoffs; points earned change as fixtures end.
  fixtures: [["weeks"], ["predictions"], ["admin-participation"], ["admin-status"]],
  // Standings, and the points they're made of.
  leaderboard: [["leaderboard"], ["predictions"], ["previous-points-mine"]],
  settings: [["predictions-lock-status"], ["registration-status"], ["admin-settings"], ["admin-status"]],
};

export const ALL_LIVE_AREAS = Object.keys(LIVE_AREA_QUERIES) as LiveArea[];

/**
 * How often a page showing live data should poll. While the hub is connected the server pushes
 * every change, so polling is only a rare safety net; without it (reconnecting, or a proxy that
 * blocks WebSockets), poll — quickly only while matches are actually being played. The scraper
 * itself only checks scores once a minute, so faster than 15s would just repeat the same answer.
 */
export function useLivePollInterval(): (matchesInPlay: boolean) => number {
  const { status } = useChat();
  return (matchesInPlay) => (status === "connected" ? 120_000 : matchesInPlay ? 15_000 : 60_000);
}

export const hasMatchesInPlay = (weeks: { fixtures: { status: string }[] }[] | undefined) =>
  !!weeks?.some((w) => w.fixtures.some((f) => f.status === "live"));

export function invalidateLiveAreas(queryClient: QueryClient, areas: readonly string[]) {
  const keys = new Map<string, QueryKey>();
  for (const area of areas) {
    for (const key of LIVE_AREA_QUERIES[area as LiveArea] ?? []) keys.set(JSON.stringify(key), key);
  }
  keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}
