import type { GradeBand } from "./types";

/** A puzzle's fixed, authoritative definition — never mutated during
 * play. Board sizes/box shapes are generic so one engine handles all
 * six bands (3×3 through 9×9, 2×2/2×3/3×3 boxes) without per-size
 * special-casing. */
export interface PuzzleDefinition {
  id: string;
  band: GradeBand;
  size: number;
  boxRows: number;
  boxCols: number;
  /** 0 = empty. Row-major, [row][col]. */
  givens: number[][];
  /** The authoritative solved grid. Kept on the definition (not
   * derived by the engine at runtime) so Band 5/6's known-correct
   * source solutions are used as-is rather than re-solved and
   * possibly drifting from the authoritative spec. PuzzleValidator
   * cross-checks this against the solver independently. */
  solution: number[][];
  /** True only for Band 6 — both main diagonals become additional
   * uniqueness constraints (X-Sudoku / diagonal Sudoku). */
  diagonal: boolean;
}

/** row/col grouped as one value so engine APIs don't scatter loose
 * (number, number) pairs that are easy to transpose by accident. */
export interface CellCoord {
  row: number;
  col: number;
}

/** A future move-history entry (Build 04 Trace Back). Not populated or
 * consumed yet in Build 02 — the shape exists now so the engine can
 * start recording without a later rewrite. */
export interface MoveRecord {
  moveId: number;
  row: number;
  col: number;
  previousValue: number; // 0 = was empty
  newValue: number; // 0 = cleared
  order: number;
  playerEntered: boolean;
}

/** Board fullness vs. correctness are deliberately separate states —
 * see Build 02 spec §34. A full board is not necessarily a valid
 * solution, and the player is never told which. "dead-end" (Build 03)
 * is distinct from both: the board is still incomplete, but at least
 * one empty cell has zero legal candidates left — the current path
 * cannot be completed. A puzzle that reaches a valid completion is
 * never classified as dead-end, and a dead-end board is never silently
 * treated as complete. */
export type PuzzleStatus = "in-progress" | "dead-end" | "complete-valid" | "complete-invalid";

export interface ValidationIssue {
  code: string;
  message: string;
  row?: number;
  col?: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  solvable: boolean;
  uniqueSolution: boolean;
  solverSolution: number[][] | null;
  solutionMatchesDeclared: boolean;
}
