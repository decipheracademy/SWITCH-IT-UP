import { isPlacementValid, type BoardShape } from "./PuzzleConstraints";

/**
 * Generic Sudoku solver — backtracking with a Minimum-Remaining-Values
 * (MRV) heuristic (always branch on the empty cell with the fewest
 * legal candidates first). Works for any size/box shape/diagonal
 * configuration via BoardShape, so 3×3 through 9×9 all share this one
 * implementation.
 *
 * Deliberately has no knowledge of PuzzleDefinition or GradeBand — it
 * operates purely on grids, which keeps it trivially unit-testable and
 * reusable by both PuzzleValidator (checking authored puzzles) and any
 * future puzzle-generation tooling.
 */

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => row.slice());
}

function candidatesFor(grid: number[][], row: number, col: number, shape: BoardShape): number[] {
  const options: number[] = [];
  for (let v = 1; v <= shape.size; v++) {
    if (isPlacementValid(grid, row, col, v, shape)) options.push(v);
  }
  return options;
}

/** Finds the empty cell with the fewest legal candidates (MRV). Returns
 * null if the grid has no empty cells (already complete). */
function findMostConstrainedCell(
  grid: number[][],
  shape: BoardShape
): { row: number; col: number; candidates: number[] } | null {
  let best: { row: number; col: number; candidates: number[] } | null = null;
  for (let r = 0; r < shape.size; r++) {
    for (let c = 0; c < shape.size; c++) {
      if (grid[r][c] !== 0) continue;
      const candidates = candidatesFor(grid, r, c, shape);
      if (!best || candidates.length < best.candidates.length) {
        best = { row: r, col: c, candidates };
      }
      // A cell with zero candidates can't get better than "dead end" —
      // return immediately, the caller will backtrack.
      if (best.candidates.length === 0) return best;
    }
  }
  return best;
}

/**
 * Solves a puzzle. Returns the first solution found, or null if the
 * grid has no solution. Mutates nothing passed in — operates on an
 * internal clone.
 */
export function solve(grid: number[][], shape: BoardShape): number[][] | null {
  const working = cloneGrid(grid);

  function backtrack(): boolean {
    const target = findMostConstrainedCell(working, shape);
    if (target === null) return true; // no empty cells left — solved
    if (target.candidates.length === 0) return false; // dead end

    for (const value of target.candidates) {
      working[target.row][target.col] = value;
      if (backtrack()) return true;
      working[target.row][target.col] = 0;
    }
    return false;
  }

  return backtrack() ? working : null;
}

/**
 * Counts solutions up to `limit` (default 2 — enough to distinguish
 * "unique" from "not unique" without exploring the whole search space
 * once a second solution is found). Used by PuzzleValidator for
 * uniqueness checks.
 */
export function countSolutions(grid: number[][], shape: BoardShape, limit = 2): number {
  const working = cloneGrid(grid);
  let count = 0;

  function backtrack(): void {
    if (count >= limit) return;
    const target = findMostConstrainedCell(working, shape);
    if (target === null) {
      count++;
      return;
    }
    if (target.candidates.length === 0) return;

    for (const value of target.candidates) {
      if (count >= limit) return;
      working[target.row][target.col] = value;
      backtrack();
      working[target.row][target.col] = 0;
    }
  }

  backtrack();
  return count;
}
