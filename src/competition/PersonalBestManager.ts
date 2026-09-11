import type { GradeBand } from "../puzzle/types";

const STORAGE_KEY = "logicGrid.personalBest";

type PersonalBestStore = Partial<Record<GradeBand, number>>;

function readStore(): PersonalBestStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as PersonalBestStore;
  } catch {
    return {};
  }
}

function writeStore(store: PersonalBestStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage full/unavailable — continue without persistence.
  }
}

/** Highest official score for this grade band, or null if none yet
 * (Build 05 spec §33 — never compared across unrelated bands). */
export function getPersonalBest(gradeBand: GradeBand): number | null {
  const store = readStore();
  return store[gradeBand] ?? null;
}

/**
 * Records `score` as the new personal best for `gradeBand` if it beats
 * (or there is no) existing record. Returns whether this call set a
 * NEW personal best, so the UI can show "NEW PERSONAL BEST" (spec §56)
 * without a separate read-then-compare round trip.
 */
export function submitScore(gradeBand: GradeBand, score: number): boolean {
  const store = readStore();
  const current = store[gradeBand];
  if (current !== undefined && current >= score) return false;
  store[gradeBand] = score;
  writeStore(store);
  return true;
}
