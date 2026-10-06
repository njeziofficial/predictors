import type { PreviousPointsImportRow } from "@/lib/api";

// Reads the league table as it's posted in the WhatsApp group:
//
//   OCTOPUS LEAGUE WEEK 7 TABLE
//   1.Gigalolu            105          19        124
//   19.MsBaba           63         ----       63
//   *Correct Score update*
//   *God’s O*  09
//   Don Thiago :   01
//
// A numbered line is a player; its last number is their total. Lines after a "correct score"
// heading are "name count" pairs, joined to players by name (see resolveName).

export interface LeagueTable {
  week: number | null;
  rows: PreviousPointsImportRow[];
  // Correct-score lines that matched no player (or several), so their counts weren't applied.
  warnings: string[];
}

// Same rules as the backend's name matching: case, spaces and punctuation don't count.
export const normalizeName = (name: string | null | undefined) =>
  (name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// A prefix match ("Anony" ↔ "Anonymous") needs this many characters so short names can't collide.
const MIN_PREFIX = 4;

// Index of the one candidate matching name exactly, else the one matching by prefix either way
// round; null when none or several do.
export const resolveName = (name: string, candidates: string[]): number | null => {
  const key = normalizeName(name);
  const keys = candidates.map(normalizeName);
  const exact = keys.flatMap((k, i) => (k === key ? [i] : []));
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;
  const prefix = keys.flatMap((k, i) =>
    Math.min(k.length, key.length) >= MIN_PREFIX && (k.startsWith(key) || key.startsWith(k)) ? [i] : [],
  );
  return prefix.length === 1 ? prefix[0] : null;
};

const PLAYER_LINE = /^\s*\d+\s*[.)]\s*(.*?\p{L}.*?)((?:\s+(?:\d+|-+))+)\s*$/u;
const CORRECT_SCORE_LINE = /^\s*\*?\s*([^*:]*?\p{L}[^*:]*?)\s*\*?\s*:?\s*(\d+)\s*\*?\s*$/u;
const cleanName = (name: string) => name.replace(/[*:]/g, "").replace(/\s+/g, " ").trim();

// Null when the text doesn't look like a league table (fewer than two numbered player lines).
export const parseLeagueTable = (text: string): LeagueTable | null => {
  const rows: PreviousPointsImportRow[] = [];
  const scores: { name: string; count: number }[] = [];
  let inCorrectScores = false;

  for (const line of text.split(/\r?\n/)) {
    const player = line.match(PLAYER_LINE);
    if (player) {
      const numbers = player[2].trim().split(/\s+/);
      rows.push({ whatsAppName: cleanName(player[1]), points: Number(numbers[numbers.length - 1]), correctScores: 0 });
      continue;
    }
    if (/correct\s*scores?/i.test(line)) {
      inCorrectScores = true;
      continue;
    }
    const score = inCorrectScores ? line.match(CORRECT_SCORE_LINE) : null;
    if (score) scores.push({ name: cleanName(score[1]), count: Number(score[2]) });
  }
  if (rows.length < 2) return null;

  const names = rows.map((r) => r.whatsAppName!);
  const applied = new Set<number>();
  const warnings: string[] = [];
  for (const { name, count } of scores) {
    const i = resolveName(name, names);
    if (i === null) warnings.push(`Correct scores for "${name}" (${count}) match no player in the table.`);
    else if (applied.has(i)) warnings.push(`"${name}" is listed twice under correct scores; used ${count}.`);
    if (i === null) continue;
    rows[i].correctScores = count;
    applied.add(i);
  }

  const week = text.match(/week\s*(\d+)/i);
  return { week: week ? Number(week[1]) : null, rows, warnings };
};
