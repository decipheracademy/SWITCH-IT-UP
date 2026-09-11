import type { GradeBand } from "../puzzle/types";
import type { GameResult } from "../results/ResultManager";

const STORAGE_KEY = "logicGrid.officialAttempts";

type AttemptStore = Record<string, GameResult>;

/**
 * Identifies a player by their entered name, normalized (trimmed,
 * lowercased) so "Alex", " alex ", and "ALEX" are treated as the same
 * person. This is NOT real authentication — it's a client-side,
 * localStorage-only check, exactly as honest as every other piece of
 * persistence in this game (see PersonalBestManager/LeaderboardManager).
 * Two different students who happen to type the same name will share a
 * slot; there is no login system, and the spec explicitly says not to
 * pretend LocalStorage is secure (Build 05 spec §80).
 */
function attemptKey(playerName: string, gradeBand: GradeBand): string {
  return `${playerName.trim().toLowerCase()}|${gradeBand}`;
}

function readStore(): AttemptStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as AttemptStore;
  } catch {
    return {};
  }
}

function writeStore(store: AttemptStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full/unavailable — the game continues without this
    // protection rather than crashing, same policy as every other
    // persistence module here.
  }
}

/** Returns this player's already-recorded official result for this
 * grade band, or null if they haven't completed one yet. Checked before
 * starting a fresh official session (GradeSelectScreen) so a repeat
 * attempt shows the existing result instead of letting them play again. */
export function getRecordedAttempt(playerName: string, gradeBand: GradeBand): GameResult | null {
  if (!playerName.trim()) return null; // no identity, nothing to look up
  const store = readStore();
  return store[attemptKey(playerName, gradeBand)] ?? null;
}

/** Records a completed OFFICIAL result as this player's one attempt for
 * this grade band. Never called for practice sessions (the caller —
 * GameState — is responsible for that gate, same pattern as
 * LeaderboardManager/PersonalBestManager). Does not overwrite an
 * existing recorded attempt — the FIRST official completion is the one
 * that counts, matching "one-off scored attempt" (Build 05 spec §10). */
export function recordAttempt(playerName: string, gradeBand: GradeBand, result: GameResult): void {
  if (!playerName.trim()) return;
  const store = readStore();
  const key = attemptKey(playerName, gradeBand);
  if (store[key]) return; // already recorded — first attempt stands
  store[key] = result;
  writeStore(store);
}
