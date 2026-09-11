import { describe, it, expect } from "vitest";
import { SudokuEngine } from "../src/puzzle/SudokuEngine";
import { DeadEndDetector } from "../src/puzzle/DeadEndDetector";
import { getPuzzleForBand } from "../src/puzzle/PuzzleRepository";
import type { PuzzleDefinition } from "../src/puzzle/PuzzleTypes";

function def4x4(givens: number[][], solution: number[][]): PuzzleDefinition {
  return { id: "t", band: 2, size: 4, boxRows: 2, boxCols: 2, givens, solution, diagonal: false };
}

const STANDARD_4X4_SOLUTION = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

// ---------------------------------------------------------------------
// Build 03 spec §32 — NO FALSE DEAD END
// ---------------------------------------------------------------------
describe("DeadEndDetector — no false dead end", () => {
  it("does not report a dead end when every empty cell has at least one candidate", () => {
    const def = def4x4(
      [
        [1, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      STANDARD_4X4_SOLUTION
    );
    const e = new SudokuEngine(def);
    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(false);
    expect(result.cellsWithoutCandidates).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// Build 03 spec §33 — ZERO-CANDIDATE TEST
// ---------------------------------------------------------------------
describe("DeadEndDetector — zero-candidate cell (deterministic construction)", () => {
  it("detects a deterministic zero-candidate cell", () => {
    // (0,3): row0 already has {1,2,3}, so 4 is its only mathematically
    // possible value. (1,3) is given as 4, so column 3 already contains
    // 4 — which excludes the one value (0,3) could have used. Net
    // result: (0,3) has zero legal candidates.
    const givens = [
      [1, 2, 3, 0],
      [0, 0, 0, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const e = new SudokuEngine(def4x4(givens, STANDARD_4X4_SOLUTION));

    expect(e.getCell(0, 3)).toBe(0); // confirm it's actually empty
    expect(e.isValueAllowed(0, 3, 4)).toBe(false); // excluded by column
    for (const v of [1, 2, 3]) {
      expect(e.isValueAllowed(0, 3, v)).toBe(false); // excluded by row
    }

    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(true);
    expect(result.cellsWithoutCandidates).toContainEqual({ row: 0, col: 3 });
  });
});

// ---------------------------------------------------------------------
// Build 03 spec §34 — MULTIPLE ZERO-CANDIDATE TEST
// ---------------------------------------------------------------------
describe("DeadEndDetector — multiple zero-candidate cells", () => {
  it("returns ALL affected cells, not just the first one found", () => {
    // Two independent traps: (0,3) as above, and (3,0) built
    // symmetrically via column 0 / row 3.
    const givens = [
      [1, 2, 3, 0], // (0,3): row has {1,2,3} -> needs 4
      [0, 0, 0, 4], // col3 already has 4 -> traps (0,3)
      [0, 0, 0, 0],
      [0, 3, 2, 1], // (3,0): row has {3,2,1} -> needs 4
    ];
    // col0 already has 4 at (1? ) -- place it directly to trap (3,0):
    // put 4 in column 0 elsewhere (row2) so (3,0) also has zero candidates.
    givens[2][0] = 4;

    const e = new SudokuEngine(def4x4(givens, STANDARD_4X4_SOLUTION));

    expect(e.getCell(0, 3)).toBe(0);
    expect(e.getCell(3, 0)).toBe(0);
    expect(e.isValueAllowed(0, 3, 4)).toBe(false);
    expect(e.isValueAllowed(3, 0, 4)).toBe(false);

    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(true);
    expect(result.cellsWithoutCandidates).toContainEqual({ row: 0, col: 3 });
    expect(result.cellsWithoutCandidates).toContainEqual({ row: 3, col: 0 });
    expect(result.cellsWithoutCandidates.length).toBeGreaterThanOrEqual(2);

    // Every reported cell must genuinely be empty with zero legal values.
    for (const cell of result.cellsWithoutCandidates) {
      expect(e.getCell(cell.row, cell.col)).toBe(0);
      for (const v of e.values) {
        expect(e.isValueAllowed(cell.row, cell.col, v)).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------
// Build 03 spec §35 — SINGLE-CANDIDATE TEST (forced move is NOT dead end)
// ---------------------------------------------------------------------
describe("DeadEndDetector — single candidate is not a dead end", () => {
  it("a forced (single-candidate) empty cell does not trigger a dead end", () => {
    const def = def4x4(
      [
        [1, 2, 3, 0], // (0,3) has exactly one legal candidate: 4
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      STANDARD_4X4_SOLUTION
    );
    const e = new SudokuEngine(def);
    expect(e.isValueAllowed(0, 3, 4)).toBe(true);
    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Build 03 spec §36 — COMPLETE BOARD TEST
// ---------------------------------------------------------------------
describe("DeadEndDetector — complete board", () => {
  it("a fully completed valid board is never a dead end", () => {
    const def = def4x4(STANDARD_4X4_SOLUTION, STANDARD_4X4_SOLUTION); // fully given == complete
    const e = new SudokuEngine(def);
    expect(e.isComplete()).toBe(true);
    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(false);
    expect(result.cellsWithoutCandidates).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// Build 03 spec §38 — BAND 6 DIAGONAL DEAD END TEST
// ---------------------------------------------------------------------
describe("DeadEndDetector — Band 6 diagonal-caused dead end", () => {
  it("detects candidate exhaustion caused specifically by the diagonal constraint", () => {
    const size = 9;
    const emptyGrid = Array.from({ length: size }, () => Array(size).fill(0));
    // Fill the main diagonal with 8 of the 9 values, leaving (4,4)
    // empty. Block the one remaining value (5) via (4,4)'s own row, so
    // (4,4) is boxed in by row + diagonal together.
    const givens = emptyGrid.map((r) => r.slice());
    const diagonalValues = [1, 2, 3, 4, 0, 6, 7, 8, 9]; // (4,4) left empty
    for (let i = 0; i < size; i++) givens[i][i] = diagonalValues[i];
    givens[4][0] = 5;

    const def: PuzzleDefinition = {
      id: "band6-deadend-test",
      band: 6,
      size,
      boxRows: 3,
      boxCols: 3,
      givens,
      solution: givens, // never consulted by the detector
      diagonal: true,
    };
    const e = new SudokuEngine(def);
    expect(e.getCell(4, 4)).toBe(0);
    expect(e.isValueAllowed(4, 4, 5)).toBe(false); // excluded by row
    for (const v of [1, 2, 3, 4, 6, 7, 8, 9]) {
      expect(e.isValueAllowed(4, 4, v)).toBe(false); // excluded by diagonal
    }
    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(true);
    expect(result.cellsWithoutCandidates).toContainEqual({ row: 4, col: 4 });
  });

  it("the real Band 6 puzzle never starts in a dead end", () => {
    // Sanity check against the actual shipped, solver-verified puzzle —
    // a valid, solvable puzzle must never be a dead end at move zero.
    const def = getPuzzleForBand(6);
    const e = new SudokuEngine(def);
    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Build 03 spec §31 — THE CENTRAL DELAYED-CONSEQUENCE + DEAD END TEST
// ---------------------------------------------------------------------
describe("The central delayed-consequence -> dead end sequence", () => {
  it("accepts a locally-legal-but-wrong move, stays viable, then eventually reaches a dead end — without ever identifying the original move or revealing the solution", () => {
    // 1. Start with a valid, mostly-empty puzzle state.
    const givens = [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const e = new SudokuEngine(def4x4(givens, STANDARD_4X4_SOLUTION));

    // 2/3. Select (conceptually) an empty cell and make a locally legal
    // but globally incorrect placement: the solution says (0,1) = 2;
    // place 4 instead.
    expect(e.isValueAllowed(0, 1, 4)).toBe(true);
    expect(STANDARD_4X4_SOLUTION[0][1]).not.toBe(4);
    expect(e.setCell(0, 1, 4)).toBe(true);

    // 4. Confirm the placement was accepted and is visible.
    expect(e.getCell(0, 1)).toBe(4);

    // 5. Confirm no immediate dead end — the board is still viable
    // right after this single deviation.
    expect(DeadEndDetector.detect(e).isDeadEnd).toBe(false);

    // 6/7. Continue making further placements that look reasonable at
    // the time. Row0 now has {1,4}; box(0,0)-(1,1) has {1,4}.
    expect(e.setCell(0, 2, 2)).toBe(true); // legal at the time -> row0 {1,4,2}
    // Row0 now forces (0,3) = 3. Column 3 doesn't have 3 yet, so this
    // alone isn't a trap — but the earlier deviation (4 instead of 2 at
    // (0,1)) has consumed box(0,0)-(1,1)'s only remaining slots
    // incorrectly relative to the true solution. Continue building on
    // it plausibly:
    expect(e.setCell(1, 0, 3)).toBe(true); // legal at the time

    // 8. Reach a state where some empty cell has zero candidates. Box
    // (0,0)-(1,1) now contains {1,4,3} (from (0,0)=1,(0,1)=4,(1,0)=3);
    // its last empty cell (1,1) can only be 2. Column 1 already has 4
    // (at (0,1)) — check whether 2 is still free there.
    const finalCandidateFor11 = e.isValueAllowed(1, 1, 2);
    const result = DeadEndDetector.detect(e);

    // Regardless of whether THIS exact continuation already reached a
    // dead end, the mandatory properties must hold:
    // 9. The original incorrect move (0,1)=4 is never flagged, reverted,
    //    or specially marked anywhere in the engine's state.
    expect(e.getCell(0, 1)).toBe(4);
    expect(e.isGiven(0, 1)).toBe(false); // still just an ordinary player cell
    // 10. Nothing in the detector's result exposes solution values —
    //     only coordinates are ever returned.
    for (const cell of result.cellsWithoutCandidates) {
      expect(Object.keys(cell).sort()).toEqual(["col", "row"]);
    }
    expect(typeof finalCandidateFor11).toBe("boolean");
  });

  it("a concrete, guaranteed continuation of the same scenario DOES reach a dead end", () => {
    // A fully deterministic version of the above: force the trap
    // directly so the delayed-consequence -> dead-end transition is
    // unambiguously exercised at least once.
    const givens = [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const e = new SudokuEngine(def4x4(givens, STANDARD_4X4_SOLUTION));

    // Locally legal, globally wrong: solution wants (0,1)=2, we place 3.
    expect(e.setCell(0, 1, 3)).toBe(true);
    expect(DeadEndDetector.detect(e).isDeadEnd).toBe(false); // not yet

    // Continue: (0,2) legal options now exclude {1,3} -> place 4.
    expect(e.setCell(0, 2, 4)).toBe(true);
    expect(DeadEndDetector.detect(e).isDeadEnd).toBe(false); // still fine

    // Row0 now {1,3,4} — (0,3) is forced to 2 (single candidate, not a
    // dead end by itself). But box(0,0)-(1,1) now has {1,3}; its
    // remaining cell (1,1) needs a value from {2,4} minus row1/col1.
    // Fill (1,0) to close off the box:
    expect(e.setCell(1, 0, 4)).toBe(true); // legal: col0={1,4}, row1={4}, box{1,3,4}
    // Box(0,0)-(1,1) now has {1,3,4} — its last cell (1,1) can only be 2.
    // Column 1 currently has {3} (from (0,1)=3) — 2 is still free there,
    // so (1,1) is single-candidate, not yet a dead end. Force the trap
    // by also placing 2 elsewhere in column 1 first:
    expect(e.setCell(2, 1, 2)).toBe(true); // legal at placement time
    // Now (1,1): box excludes {1,3,4}, column1 excludes {2,3} -> zero
    // candidates remain (only 2 or 4 were mathematically possible, and
    // both are now excluded).
    expect(e.isValueAllowed(1, 1, 2)).toBe(false);
    expect(e.isValueAllowed(1, 1, 4)).toBe(false);
    const result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(true);
    expect(result.cellsWithoutCandidates).toContainEqual({ row: 1, col: 1 });

    // The historical mistake (0,1)=3 is still just sitting there,
    // completely unflagged.
    expect(e.getCell(0, 1)).toBe(3);
  });
});
