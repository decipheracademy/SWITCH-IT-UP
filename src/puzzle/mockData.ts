import type { GradeBand, PlayerGrade } from "./types";

/**
 * Grade/band metadata used by the UI (grade selection cards, HUD
 * labels). The mock puzzle grids that used to live in this file were
 * Build 01 placeholders — Build 02 replaced them with the real,
 * solver-verified puzzle data in PuzzleRepository.ts. This file now
 * holds only display/mapping metadata, not puzzle content.
 */

export const BAND_LABELS: Record<GradeBand, { title: string; grades: string; size: string }> = {
  1: { title: "BAND 1", grades: "Grades 1–2", size: "3×3" },
  2: { title: "BAND 2", grades: "Grades 3–4", size: "4×4" },
  3: { title: "BAND 3", grades: "Grades 5–6", size: "6×6" },
  4: { title: "BAND 4", grades: "Grades 7–8", size: "6×6" },
  5: { title: "BAND 5", grades: "Grades 9–10", size: "9×9" },
  6: { title: "BAND 6", grades: "Grades 11–12", size: "9×9" },
};

/** Individual-grade → grade-band mapping (per correction pass #1).
 * The six-band difficulty architecture is preserved internally; the UI
 * selects by exact grade rather than by band range. */
export const GRADE_TO_BAND: Record<PlayerGrade, GradeBand> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 3,
  7: 4,
  8: 4,
  9: 5,
  10: 5,
  11: 6,
  12: 6,
};

export const ALL_GRADES: PlayerGrade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
