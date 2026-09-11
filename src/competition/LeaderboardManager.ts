import type { GradeBand } from "../puzzle/types";

export interface LeaderboardEntry {
  playerName: string;
  grade: number;
  gradeBand: GradeBand;
  score: number;
  mistakes: number;
  traceBacks: number;
  efficiency: number;
  badges: string[];
  completedAt: string; // ISO timestamp
}

const STORAGE_KEY = "logicGrid.leaderboards";
const MAX_ENTRIES_PER_BAND = 10;

type LeaderboardStore = Partial<Record<GradeBand, LeaderboardEntry[]>>;

/** Reads the whole store, tolerating a missing key or malformed JSON
 * (Build 05 spec §79 — the game must fail gracefully on bad stored
 * data, never throw). */
function readStore(): LeaderboardStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as LeaderboardStore;
  } catch {
    return {};
  }
}

function writeStore(store: LeaderboardStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full/unavailable — the game continues without persistence
    // rather than crashing (spec §79).
  }
}

/** Sort order per Build 05 spec §31/§57: score desc, then fewer
 * mistakes, then fewer Trace Backs. Never uses time — the game is
 * untimed. */
function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.mistakes !== b.mistakes) return a.mistakes - b.mistakes;
    return a.traceBacks - b.traceBacks;
  });
}

/** Only OFFICIAL sessions may be submitted (enforced by the caller —
 * ResultManager — not re-checked here, since this module has no
 * concept of "mode"). Keeps only the top MAX_ENTRIES_PER_BAND per
 * band, per grade band isolation (spec §29/§59 — never mixes bands). */
export function submitScore(entry: LeaderboardEntry): LeaderboardEntry[] {
  const store = readStore();
  const existingRaw = store[entry.gradeBand];
  const existing = Array.isArray(existingRaw) ? existingRaw : [];
  const merged = sortEntries([...existing, entry]).slice(0, MAX_ENTRIES_PER_BAND);
  store[entry.gradeBand] = merged;
  writeStore(store);
  return merged;
}

export function getLeaderboard(gradeBand: GradeBand): LeaderboardEntry[] {
  const store = readStore();
  const raw = store[gradeBand];
  return sortEntries(Array.isArray(raw) ? raw : []);
}

/** 1-based rank of `score` within its band's current leaderboard, or
 * null if the leaderboard for that band is empty. Computed by counting
 * how many existing entries would sort strictly above this score under
 * the same rules submitScore uses, so it reflects where a
 * not-yet-submitted result WOULD land. */
export function computeRank(gradeBand: GradeBand, entry: Pick<LeaderboardEntry, "score" | "mistakes" | "traceBacks">): number {
  const existing = getLeaderboard(gradeBand);
  let rank = 1;
  for (const e of existing) {
    const entryIsBetter =
      e.score > entry.score ||
      (e.score === entry.score && e.mistakes < entry.mistakes) ||
      (e.score === entry.score && e.mistakes === entry.mistakes && e.traceBacks < entry.traceBacks);
    if (entryIsBetter) rank++;
  }
  return rank;
}

/** True if any official completion has ever been recorded for this
 * band — used by BadgeManager's FIRST_GRID badge via the caller. */
export function hasAnyCompletion(gradeBand: GradeBand): boolean {
  return getLeaderboard(gradeBand).length > 0;
}
