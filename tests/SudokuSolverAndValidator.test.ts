import { describe, it, expect } from "vitest";
import { solve, countSolutions } from "../src/puzzle/SudokuSolver";
import { validatePuzzle } from "../src/puzzle/PuzzleValidator";
import { SudokuEngine } from "../src/puzzle/SudokuEngine";
import { CandidateManager } from "../src/puzzle/CandidateManager";
import { PUZZLES, getPuzzleForBand, BAND_6_SOLVE_RESULT } from "../src/puzzle/PuzzleRepository";
import type { PuzzleDefinition } from "../src/puzzle/PuzzleTypes";

const BAND1_DEF: PuzzleDefinition = {
  id: "t",
  band: 1,
  size: 3,
  boxRows: 1,
  boxCols: 3,
  givens: [
    [1, 2, 0],
    [0, 3, 1],
    [3, 0, 2],
  ],
  solution: [
    [1, 2, 3],
    [2, 3, 1],
    [3, 1, 2],
  ],
  diagonal: false,
};

// ---------------------------------------------------------------------
// TEST GROUP 8 — SOLVER
// ---------------------------------------------------------------------
describe("Test group 8 — solver", () => {
  const shape = { size: 3, boxRows: 1, boxCols: 3, diagonal: false };

  it("solves a solvable puzzle", () => {
    const result = solve(BAND1_DEF.givens, shape);
    expect(result).not.toBeNull();
    expect(result).toEqual(BAND1_DEF.solution);
  });

  it("returns null for an unsolvable puzzle", () => {
    // Two 1s forced into the same row with no other options possible.
    const impossible = [
      [1, 1, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    expect(solve(impossible, shape)).toBeNull();
  });

  it("finds the known solution for a puzzle with one clue removed", () => {
    const sparse = [
      [0, 2, 0],
      [0, 3, 1],
      [3, 0, 2],
    ];
    const result = solve(sparse, shape);
    expect(result).toEqual(BAND1_DEF.solution);
  });

  it("detects a unique solution", () => {
    expect(countSolutions(BAND1_DEF.givens, shape, 2)).toBe(1);
  });

  it("detects multiple solutions for an under-constrained grid", () => {
    const empty = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    expect(countSolutions(empty, shape, 2)).toBe(2); // capped at limit
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 9 — COMPLETION
// ---------------------------------------------------------------------
describe("Test group 9 — completion", () => {
  it("reports incomplete for a partially filled board", () => {
    const e = new SudokuEngine(BAND1_DEF);
    expect(e.isComplete()).toBe(false);
  });

  it("reports complete + matches solution for a full valid board", () => {
    const e = new SudokuEngine(BAND1_DEF);
    e.setCell(0, 2, 3);
    e.setCell(1, 0, 2);
    e.setCell(2, 1, 1);
    expect(e.isComplete()).toBe(true);
    expect(e.matchesSolution()).toBe(true);
  });

  it("reports complete but NOT matching the solution for a full, structurally-valid-but-different board (FULL + INVALID)", () => {
    // A genuinely valid 2x2-box 4x4 Sudoku grid, used as the "declared
    // solution" — verified by hand: every row/col/box is {1,2,3,4}.
    const declaredSolution = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ];
    // A DIFFERENT, independently valid 2x2-box completion of the same
    // empty grid (also every row/col/box is {1,2,3,4}) — the point is
    // that a board can be fully and legally filled while still not
    // being the declared solution (Build 02 spec §34).
    const alternateValidCompletion = [
      [2, 1, 4, 3],
      [4, 3, 2, 1],
      [1, 2, 3, 4],
      [3, 4, 1, 2],
    ];

    const def: PuzzleDefinition = {
      id: "full-invalid-demo",
      band: 1,
      size: 4,
      boxRows: 2,
      boxCols: 2,
      givens: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      solution: declaredSolution,
      diagonal: false,
    };
    const e = new SudokuEngine(def);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        // Every placement must itself be accepted as structurally
        // legal at the moment it's made (a genuine engine placement,
        // not a direct grid overwrite).
        expect(e.setCell(r, c, alternateValidCompletion[r][c])).toBe(true);
      }
    }

    expect(e.isComplete()).toBe(true);
    expect(e.matchesSolution()).toBe(false);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 10 — DELAYED-CONSEQUENCE FOUNDATION (critical)
// ---------------------------------------------------------------------
describe("Test group 10 — delayed-consequence foundation", () => {
  it("accepts a locally-legal value that differs from the hidden solution, with no correctness feedback path", () => {
    // Band 2 (4x4) has enough slack for a genuine locally-legal-but-wrong move.
    const band2: PuzzleDefinition = {
      id: "t2",
      band: 2,
      size: 4,
      boxRows: 2,
      boxCols: 2,
      givens: [
        [1, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
      diagonal: false,
    };
    const e = new SudokuEngine(band2);

    // Solution says (0,2) should be 3. Confirm 4 is ALSO currently
    // legal at (0,2) (row has 1,2; col has nothing; box has 1,2 — 4
    // conflicts with nothing yet).
    expect(e.isValueAllowed(0, 2, 4)).toBe(true); // locally legal
    expect(band2.solution[0][2]).toBe(3); // but solution wants 3 — different value

    // 1. Player enters 4 (locally legal, globally wrong).
    const accepted = e.setCell(0, 2, 4);

    // 2/3/4. The engine must ACCEPT it.
    expect(accepted).toBe(true);
    expect(e.getCell(0, 2)).toBe(4);

    // 5. No correctness feedback exists to trigger — setCell's only
    // return is a boolean success flag (placed or not), never a
    // correctness verdict. Confirm the API surface has nothing else
    // to consult here.
    expect(e.matchesSolution()).toBe(false); // board no longer matches, as expected...
    // ...but the engine does NOT revert, flag, or remove the value:
    expect(e.getCell(0, 2)).toBe(4); // 6. remains on the board, unmodified by the mismatch
  });

  it("candidates at a later cell still include the locally-legal-but-wrong value, not just the solution's value", () => {
    const band2: PuzzleDefinition = {
      id: "t2",
      band: 2,
      size: 4,
      boxRows: 2,
      boxCols: 2,
      givens: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
      diagonal: false,
    };
    const e = new SudokuEngine(band2);
    // Candidates must be computed from current board only — with an
    // all-empty board, every value 1..4 is a legal candidate for any
    // cell, regardless of what the hidden solution says that cell
    // should be.
    const candidates = new Set(CandidateManager.getCandidates(e, 0, 0));
    expect(candidates).toEqual(new Set([1, 2, 3, 4]));
  });
});

// ---------------------------------------------------------------------
// AUTHORITATIVE PUZZLE DATA — validated with the real solver
// (Build 02A: Bands 2, 3, 4, and 6 were corrected — see the extensive
// notes in src/puzzle/PuzzleRepository.ts for exactly what changed and
// why. All six bands are now valid, solvable, and unique.)
// ---------------------------------------------------------------------
describe("Authoritative puzzle repository — all six bands valid/solvable/unique", () => {
  it("Band 1: valid, solvable, unique, matches declared solution (3x3)", () => {
    const def = getPuzzleForBand(1);
    expect(def.size).toBe(3);
    const result = validatePuzzle(def);
    expect(result.valid).toBe(true);
    expect(result.solvable).toBe(true);
    expect(result.uniqueSolution).toBe(true);
    expect(result.solutionMatchesDeclared).toBe(true);
  });

  it("Band 2: valid, solvable, unique, uses 2x2 boxes (corrected in Build 02A)", () => {
    const def = getPuzzleForBand(2);
    expect(def.boxRows).toBe(2);
    expect(def.boxCols).toBe(2);
    const result = validatePuzzle(def);
    expect(result.valid).toBe(true);
    expect(result.solvable).toBe(true);
    expect(result.uniqueSolution).toBe(true);
    expect(result.solutionMatchesDeclared).toBe(true);
  });

  it("Band 3: valid, solvable, unique, uses 2x3 boxes (corrected in Build 02A)", () => {
    const def = getPuzzleForBand(3);
    expect(def.boxRows).toBe(2);
    expect(def.boxCols).toBe(3);
    const result = validatePuzzle(def);
    expect(result.valid).toBe(true);
    expect(result.solvable).toBe(true);
    expect(result.uniqueSolution).toBe(true);
    expect(result.solutionMatchesDeclared).toBe(true);
  });

  it("Band 4: valid, solvable, unique, uses 2x3 boxes, fewer givens than Band 3 (corrected in Build 02A)", () => {
    const band3 = getPuzzleForBand(3);
    const band4 = getPuzzleForBand(4);
    expect(band4.boxRows).toBe(2);
    expect(band4.boxCols).toBe(3);
    const result = validatePuzzle(band4);
    expect(result.valid).toBe(true);
    expect(result.solvable).toBe(true);
    expect(result.uniqueSolution).toBe(true);
    expect(result.solutionMatchesDeclared).toBe(true);
    // The intended Band 3 -> Band 4 difficulty progression: fewer givens.
    const countGivens = (g: number[][]) => g.flat().filter((v) => v !== 0).length;
    expect(countGivens(band4.givens)).toBeLessThan(countGivens(band3.givens));
    // Every Band 4 given is a genuine subset of Band 3's corrected grid
    // (no invented values — see PuzzleRepository.ts note).
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (band4.givens[r][c] !== 0) {
          expect(band4.givens[r][c]).toBe(band3.givens[r][c]);
        }
      }
    }
  });

  it("Band 5: valid, solvable, unique, uses 3x3 boxes, matches declared solution (unchanged)", () => {
    const def = getPuzzleForBand(5);
    expect(def.boxRows).toBe(3);
    expect(def.boxCols).toBe(3);
    const result = validatePuzzle(def);
    expect(result.valid).toBe(true);
    expect(result.solvable).toBe(true);
    expect(result.uniqueSolution).toBe(true);
    expect(result.solutionMatchesDeclared).toBe(true);
  });

  it("Band 6: valid, solvable, unique, uses 3x3 boxes AND both diagonal constraints (corrected in Build 02A)", () => {
    const def = getPuzzleForBand(6);
    expect(def.boxRows).toBe(3);
    expect(def.boxCols).toBe(3);
    expect(def.diagonal).toBe(true);
    const result = validatePuzzle(def);
    expect(result.valid).toBe(true);
    expect(result.solvable).toBe(true);
    expect(result.uniqueSolution).toBe(true);
    expect(result.solutionMatchesDeclared).toBe(true);

    // Confirm both diagonals actually contain all 9 values exactly once
    // in the solution — the diagonal rule is genuinely satisfied, not
    // just nominally enabled.
    const solution = def.solution;
    const mainDiag = new Set(solution.map((row, i) => row[i]));
    const antiDiag = new Set(solution.map((row, i) => row[8 - i]));
    expect(mainDiag.size).toBe(9);
    expect(antiDiag.size).toBe(9);
  });

  it("Band 6: PUZZLES[6] is registered (no longer blocked)", () => {
    expect(PUZZLES[6]).toBeDefined();
    expect(BAND_6_SOLVE_RESULT).not.toBeNull();
  });

  it("Band 6: the diagonal constraint is genuinely load-bearing — the same givens have MULTIPLE solutions without it", () => {
    const def = getPuzzleForBand(6);
    const standardShape = { size: 9, boxRows: 3, boxCols: 3, diagonal: false };
    expect(countSolutions(def.givens, standardShape, 2)).toBeGreaterThan(1);
  });

  it("Band 6: candidates at a cell exclude values from row, column, box, AND both diagonals", () => {
    const def = getPuzzleForBand(6);
    const e = new SudokuEngine(def);
    // (0,8) sits on the anti-diagonal ((row+col) === size-1), which has
    // populated cells in this puzzle's givens (unlike the main diagonal,
    // which starts entirely empty) — a cell actually exercising the
    // diagonal exclusion, not just nominally on a diagonal.
    expect(e.isGiven(0, 8)).toBe(false);
    const candidates = CandidateManager.getCandidates(e, 0, 8);
    const rowVals = e.getRowValues(0);
    const colVals = e.getColumnValues(8);
    const boxVals = e.getBoxValues(0, 8);
    const diagVals = e.getDiagonalValues(0, 8);
    for (const v of candidates) {
      expect(rowVals).not.toContain(v);
      expect(colVals).not.toContain(v);
      expect(boxVals).not.toContain(v);
      expect(diagVals).not.toContain(v);
    }
    // And the diagonal exclusion must be doing real work: at least one
    // value excluded from candidates is excluded ONLY because of the
    // diagonal (not row/col/box) — otherwise this test wouldn't actually
    // prove the diagonal participates.
    const excludedOnlyByDiagonal = diagVals.some(
      (v) => !rowVals.includes(v) && !colVals.includes(v) && !boxVals.includes(v)
    );
    expect(excludedOnlyByDiagonal).toBe(true);
  });
});
