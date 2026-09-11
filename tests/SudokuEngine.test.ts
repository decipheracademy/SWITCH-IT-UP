import { describe, it, expect } from "vitest";
import { SudokuEngine } from "../src/puzzle/SudokuEngine";
import { CandidateManager } from "../src/puzzle/CandidateManager";
import type { PuzzleDefinition } from "../src/puzzle/PuzzleTypes";

function def(overrides: Partial<PuzzleDefinition>): PuzzleDefinition {
  return {
    id: "test",
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// TEST GROUP 1 — BASIC BOARD
// ---------------------------------------------------------------------
describe("Test group 1 — basic board creation", () => {
  it("creates a 3x3 board", () => {
    const e = new SudokuEngine(def({}));
    expect(e.size).toBe(3);
  });

  it("creates a 4x4 board", () => {
    const e = new SudokuEngine(
      def({
        size: 4,
        boxRows: 2,
        boxCols: 2,
        givens: [
          [1, 2, 0, 4],
          [0, 1, 4, 0],
          [3, 0, 1, 0],
          [0, 3, 2, 0],
        ],
        solution: [
          [1, 2, 3, 4],
          [2, 1, 4, 3],
          [3, 4, 1, 2],
          [4, 3, 2, 1],
        ],
      })
    );
    expect(e.size).toBe(4);
    expect(e.boxRows).toBe(2);
    expect(e.boxCols).toBe(2);
  });

  it("creates a 6x6 board with 2x3 boxes", () => {
    const givens = Array.from({ length: 6 }, () => [0, 0, 0, 0, 0, 0]);
    const e = new SudokuEngine(
      def({ size: 6, boxRows: 2, boxCols: 3, givens, solution: givens })
    );
    expect(e.size).toBe(6);
    expect(e.boxRows).toBe(2);
    expect(e.boxCols).toBe(3);
  });

  it("creates a 9x9 board", () => {
    const givens = Array.from({ length: 9 }, () => Array(9).fill(0));
    const e = new SudokuEngine(
      def({ size: 9, boxRows: 3, boxCols: 3, givens, solution: givens })
    );
    expect(e.size).toBe(9);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 2 — GIVENS
// ---------------------------------------------------------------------
describe("Test group 2 — givens", () => {
  it("detects a given cell", () => {
    const e = new SudokuEngine(def({}));
    expect(e.isGiven(0, 0)).toBe(true);
    expect(e.isGiven(0, 2)).toBe(false);
  });

  it("rejects modifying a given cell", () => {
    const e = new SudokuEngine(def({}));
    const success = e.setCell(0, 0, 3);
    expect(success).toBe(false);
    expect(e.getCell(0, 0)).toBe(1); // unchanged
  });

  it("allows an empty cell to be edited", () => {
    const e = new SudokuEngine(def({}));
    expect(e.isEditable(0, 2)).toBe(true);
    const success = e.setCell(0, 2, 3);
    expect(success).toBe(true);
    expect(e.getCell(0, 2)).toBe(3);
  });

  it("clears an editable cell", () => {
    const e = new SudokuEngine(def({}));
    e.setCell(0, 2, 3);
    expect(e.clearCell(0, 2)).toBe(true);
    expect(e.getCell(0, 2)).toBe(0);
  });

  it("refuses to clear a given cell", () => {
    const e = new SudokuEngine(def({}));
    expect(e.clearCell(0, 0)).toBe(false);
    expect(e.getCell(0, 0)).toBe(1);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 3 — ROW
// ---------------------------------------------------------------------
describe("Test group 3 — row constraint", () => {
  it("rejects a duplicate value in the same row", () => {
    const e = new SudokuEngine(def({}));
    // Row 0 already has 1 and 2 at (0,0)/(0,1); placing 1 at (0,2) is a dup.
    expect(e.isValueAllowed(0, 2, 1)).toBe(false);
  });

  it("accepts a value that doesn't duplicate the row", () => {
    const e = new SudokuEngine(def({}));
    expect(e.isValueAllowed(0, 2, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 4 — COLUMN
// ---------------------------------------------------------------------
describe("Test group 4 — column constraint", () => {
  it("rejects a duplicate value in the same column", () => {
    const e = new SudokuEngine(def({}));
    // Column 0 has 1 (row0) and 3 (row2); placing 3 at (1,0) duplicates col 0.
    expect(e.isValueAllowed(1, 0, 3)).toBe(false);
  });

  it("accepts a value that doesn't duplicate the column", () => {
    const e = new SudokuEngine(def({}));
    expect(e.isValueAllowed(1, 0, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 5 — BOX
// ---------------------------------------------------------------------
describe("Test group 5 — box constraint", () => {
  it("respects 2x2 box boundaries and rejects duplicates within a box", () => {
    const e = new SudokuEngine(
      def({
        size: 4,
        boxRows: 2,
        boxCols: 2,
        givens: [
          [1, 2, 0, 4],
          [0, 1, 4, 0],
          [3, 0, 1, 0],
          [0, 3, 2, 0],
        ],
        solution: [
          [1, 2, 3, 4],
          [2, 1, 4, 3],
          [3, 4, 1, 2],
          [4, 3, 2, 1],
        ],
      })
    );
    // Top-left 2x2 box already has 1,2,1 — placing 2 at (1,0) dupes the box.
    expect(e.isValueAllowed(1, 0, 2)).toBe(false);
  });

  it("respects 2x3 box boundaries", () => {
    const givens = [
      [1, 0, 3, 0, 5, 0],
      [0, 5, 0, 1, 0, 3],
      [2, 0, 1, 0, 6, 0],
      [0, 6, 0, 2, 0, 1],
      [3, 0, 2, 0, 4, 0],
      [0, 4, 0, 3, 0, 2],
    ];
    const solution = [
      [1, 2, 3, 4, 5, 6],
      [4, 5, 6, 1, 2, 3],
      [2, 3, 1, 5, 6, 4],
      [5, 6, 4, 2, 3, 1],
      [3, 1, 2, 6, 4, 5],
      [6, 4, 5, 3, 1, 2],
    ];
    const e = new SudokuEngine(def({ size: 6, boxRows: 2, boxCols: 3, givens, solution }));
    // Box spanning rows 0-1, cols 0-2 has 1, 5(r1c1), 2(r0? no)... check directly:
    // givens box(0,0): row0 cols0-2 = [1,0,3], row1 cols0-2=[0,5,0] => box values {1,3,5}
    expect(e.getBoxValues(0, 0)).toEqual(expect.arrayContaining([1, 3, 5]));
    expect(e.isValueAllowed(0, 1, 5)).toBe(false); // 5 already in that box
  });

  it("respects 3x3 box boundaries", () => {
    const givens = [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ];
    const e = new SudokuEngine(def({ size: 9, boxRows: 3, boxCols: 3, givens, solution: givens }));
    // Top-left box has 5,3,6,9,8 — placing 5 at (0,2) dupes the box.
    expect(e.isValueAllowed(0, 2, 5)).toBe(false);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 6 — DIAGONALS (Band 6)
// ---------------------------------------------------------------------
describe("Test group 6 — diagonal constraint", () => {
  const size = 9;
  const emptyGrid = Array.from({ length: size }, () => Array(size).fill(0));

  it("detects a main-diagonal duplicate", () => {
    const givens = emptyGrid.map((r) => r.slice());
    givens[0][0] = 5; // main diagonal
    const e = new SudokuEngine(
      def({ size, boxRows: 3, boxCols: 3, givens, solution: givens, diagonal: true })
    );
    // (4,4) is also on the main diagonal.
    expect(e.isValueAllowed(4, 4, 5)).toBe(false);
  });

  it("detects a secondary-diagonal duplicate", () => {
    const givens = emptyGrid.map((r) => r.slice());
    givens[0][8] = 7; // anti-diagonal (row+col === size-1)
    const e = new SudokuEngine(
      def({ size, boxRows: 3, boxCols: 3, givens, solution: givens, diagonal: true })
    );
    expect(e.isValueAllowed(8, 0, 7)).toBe(false); // also on anti-diagonal
  });

  it("accepts a valid diagonal placement", () => {
    const givens = emptyGrid.map((r) => r.slice());
    givens[0][0] = 5;
    const e = new SudokuEngine(
      def({ size, boxRows: 3, boxCols: 3, givens, solution: givens, diagonal: true })
    );
    expect(e.isValueAllowed(4, 4, 6)).toBe(true);
  });

  it("does NOT apply diagonal constraint when diagonal=false", () => {
    const givens = emptyGrid.map((r) => r.slice());
    givens[0][0] = 5;
    const e = new SudokuEngine(
      def({ size, boxRows: 3, boxCols: 3, givens, solution: givens, diagonal: false })
    );
    // Without the diagonal rule, placing 5 at (4,4) is fine (different row/col/box).
    expect(e.isValueAllowed(4, 4, 5)).toBe(true);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 7 — CANDIDATES
// ---------------------------------------------------------------------
describe("Test group 7 — candidates", () => {
  it("excludes row, column, and box values from candidates", () => {
    const e = new SudokuEngine(def({}));
    // Cell (1,0) is empty. Row1 has {3,1}. Col0 has {1,3}. Box (whole grid)
    // has {1,2,3}. So candidates for a 1..3 range should be empty (all excluded)
    // except any value not in the union — here the union is {1,2,3} = full range.
    const candidates = CandidateManager.getCandidates(e, 1, 0);
    expect(candidates).toEqual([2]);
  });

  it("excludes diagonal values where applicable", () => {
    const size = 9;
    const emptyGrid = Array.from({ length: size }, () => Array(size).fill(0));
    const givens = emptyGrid.map((r) => r.slice());
    givens[0][0] = 9; // main diagonal
    const e = new SudokuEngine(
      def({ size, boxRows: 3, boxCols: 3, givens, solution: givens, diagonal: true })
    );
    const candidates = CandidateManager.getCandidates(e, 4, 4); // also main diagonal
    expect(candidates).not.toContain(9);
  });

  it("returns no candidates for a given cell", () => {
    const e = new SudokuEngine(def({}));
    expect(CandidateManager.getCandidates(e, 0, 0)).toEqual([]);
  });
});
