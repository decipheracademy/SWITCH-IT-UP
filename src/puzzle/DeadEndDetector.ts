import type { SudokuEngine } from "./SudokuEngine";
import { CandidateManager } from "./CandidateManager";
import type { CellCoord } from "./PuzzleTypes";

/**
 * Result of a Dead End scan. `cellsWithoutCandidates` are the CURRENT
 * contradiction — where the impossibility becomes visible — not
 * necessarily where the original mistake happened. That distinction
 * matters: Build 04's Trace Back is what lets the player investigate
 * which earlier move actually caused this, not this detector.
 */
export interface DeadEndResult {
  isDeadEnd: boolean;
  cellsWithoutCandidates: CellCoord[];
}

/**
 * Determines whether the current board state contains an empty cell
 * with zero legal candidate values.
 *
 * This is the entire Dead End mechanic: it asks the existing
 * CandidateManager (which in turn only ever consults the CURRENT
 * board's row/column/box/diagonal constraints via SudokuEngine) "what
 * can still legally go here?" for every empty cell. It never compares
 * any placed value against the hidden solution — a locally legal move
 * that happens to be globally wrong is invisible to this detector until
 * its consequence actually closes off some other cell's options
 * entirely. That gap is the delayed-consequence mechanic (see Build 02
 * spec §4/§17 and Build 03 spec §6).
 *
 * Deliberately a static, stateless scan over the engine's live state —
 * no new rules engine, no duplicated constraint logic, no reference to
 * Three.js, the DOM, or the hidden solution.
 */
export class DeadEndDetector {
  static detect(engine: SudokuEngine): DeadEndResult {
    const cellsWithoutCandidates: CellCoord[] = [];

    for (let row = 0; row < engine.size; row++) {
      for (let col = 0; col < engine.size; col++) {
        if (engine.getCell(row, col) !== 0) continue; // only empty cells can be a dead end
        const candidates = CandidateManager.getCandidates(engine, row, col);
        if (candidates.length === 0) {
          cellsWithoutCandidates.push({ row, col });
        }
      }
    }

    return {
      isDeadEnd: cellsWithoutCandidates.length > 0,
      cellsWithoutCandidates,
    };
  }
}
