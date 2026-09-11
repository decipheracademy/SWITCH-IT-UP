import type { SudokuEngine } from "./SudokuEngine";

/**
 * Computes the set of values currently legal for a cell, given only
 * the CURRENT board state (row/column/box/diagonal) — never the hidden
 * solution. This is what makes the delayed-consequence mechanic work:
 * if the solution requires 3 but 1 is not currently excluded by any
 * constraint, 1 is a legal candidate and must be offered (Build 02
 * spec §17).
 *
 * Kept as a small stateless module (not a method bag on SudokuEngine)
 * so it's trivial to unit test in isolation and easy to extend later
 * (e.g. Build 03's Dead End detector reuses this directly).
 */
export class CandidateManager {
  static getCandidates(engine: SudokuEngine, row: number, col: number): number[] {
    if (!engine.isEditable(row, col)) return [];
    const candidates: number[] = [];
    for (const value of engine.values) {
      if (engine.isValueAllowed(row, col, value)) candidates.push(value);
    }
    return candidates;
  }

  /** True if an empty editable cell has no legal candidates left. This
   * is exactly the condition Build 03's Dead End detector will scan
   * the board for — exposed now so that detector can be added later
   * without touching this module. */
  static isDeadEnd(engine: SudokuEngine, row: number, col: number): boolean {
    if (!engine.isEditable(row, col)) return false;
    if (engine.getCell(row, col) !== 0) return false;
    return CandidateManager.getCandidates(engine, row, col).length === 0;
  }
}
