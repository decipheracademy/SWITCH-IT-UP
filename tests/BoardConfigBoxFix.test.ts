import { describe, it, expect } from "vitest";
import { getPuzzleForBand } from "../src/puzzle/PuzzleRepository";
import { SudokuEngine } from "../src/puzzle/SudokuEngine";
import { engineToBoardConfig } from "../src/puzzle/boardAdapter";

describe("BoardConfig — render box vs. constraint box are correctly separate (regression)", () => {
  it("Band 1: render box is the whole grid (correct display), but constraintBox is the true degenerate 1x3 row-box", () => {
    // This is the exact bug a real screenshot surfaced: BoardScene's
    // "related cell" highlighting was reading the RENDER-only box
    // override (whole grid, used purely to avoid every grid line
    // looking bold), so selecting any cell in a Band 1 puzzle
    // highlighted the ENTIRE board as "related" — visually pointing at
    // every other empty cell, which is misleading on a tiny 3x3 board
    // with only 1-2 empty cells. The fix: BoardConfig now carries both
    // `box` (render-only) and `constraintBox` (the real Sudoku rule),
    // and BoardScene's related-cell logic must use constraintBox.
    const def = getPuzzleForBand(1);
    const engine = new SudokuEngine(def);
    const board = engineToBoardConfig(engine);

    expect(board.box).toEqual({ boxWidth: 3, boxHeight: 3 }); // render override, unchanged
    expect(board.constraintBox).toEqual({ boxWidth: 3, boxHeight: 1 }); // the TRUE constraint
  });

  it("Band 3 (2x3 boxes): render box and constraint box are identical (no degenerate case here)", () => {
    const def = getPuzzleForBand(3);
    const engine = new SudokuEngine(def);
    const board = engineToBoardConfig(engine);

    expect(board.box).toEqual({ boxWidth: 3, boxHeight: 2 });
    expect(board.constraintBox).toEqual({ boxWidth: 3, boxHeight: 2 });
    expect(board.box).toEqual(board.constraintBox);
  });

  it("Band 5 (3x3 boxes, standard Sudoku): render box and constraint box are identical", () => {
    const def = getPuzzleForBand(5);
    const engine = new SudokuEngine(def);
    const board = engineToBoardConfig(engine);
    expect(board.box).toEqual(board.constraintBox);
    expect(board.constraintBox).toEqual({ boxWidth: 3, boxHeight: 3 });
  });

  it("replicates BoardScene's exact 'related' computation using constraintBox and confirms Band 1 no longer marks the whole grid as related", () => {
    const def = getPuzzleForBand(1);
    const engine = new SudokuEngine(def);
    const board = engineToBoardConfig(engine);

    // Band 1 givens: [[1,2,0],[0,3,1],[3,0,2]] — empty cells are
    // (0,2) and (1,0) and (2,1). Select (2,1) (as in the reported
    // screenshot) and compute which cells would be marked "related"
    // using the FIXED logic (constraintBox, a 1-row-tall box).
    const selected = { row: 2, col: 1 };
    const relatedCells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < board.size; row++) {
      for (let col = 0; col < board.size; col++) {
        if (row === selected.row && col === selected.col) continue;
        const sameRow = row === selected.row;
        const sameCol = col === selected.col;
        const sameBox =
          Math.floor(row / board.constraintBox.boxHeight) === Math.floor(selected.row / board.constraintBox.boxHeight) &&
          Math.floor(col / board.constraintBox.boxWidth) === Math.floor(selected.col / board.constraintBox.boxWidth);
        if (sameRow || sameCol || sameBox) relatedCells.push({ row, col });
      }
    }

    // With constraintBox = 1x3 (a "box" is just one row), sameBox is
    // identical to sameRow here, so "related" should be exactly: the
    // rest of row 2, plus the rest of column 1 — NOT the entire grid.
    const relatedKeys = relatedCells.map((c) => `${c.row},${c.col}`).sort();
    expect(relatedKeys).toEqual(["0,1", "1,1", "2,0", "2,2"].sort());
    // Specifically confirm the OTHER empty cell (0,2) is NOT falsely
    // marked related just because of an overly-broad "whole grid" box.
    expect(relatedKeys).not.toContain("0,2");
  });

  it("using the OLD (buggy) render-box for the same computation WOULD have marked the whole grid related — documenting exactly what was wrong", () => {
    const def = getPuzzleForBand(1);
    const engine = new SudokuEngine(def);
    const board = engineToBoardConfig(engine);
    const selected = { row: 2, col: 1 };

    const relatedCellsUsingRenderBoxBug: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < board.size; row++) {
      for (let col = 0; col < board.size; col++) {
        if (row === selected.row && col === selected.col) continue;
        const sameBoxUsingRenderBoxBug =
          Math.floor(row / board.box.boxHeight) === Math.floor(selected.row / board.box.boxHeight) &&
          Math.floor(col / board.box.boxWidth) === Math.floor(selected.col / board.box.boxWidth);
        if (sameBoxUsingRenderBoxBug) relatedCellsUsingRenderBoxBug.push({ row, col });
      }
    }
    // board.box for Band 1 is 3x3 (whole grid) -> every other cell
    // would have been marked "same box", confirming this was a real,
    // reproducible bug, not a misreading of the screenshot.
    expect(relatedCellsUsingRenderBoxBug.length).toBe(board.size * board.size - 1);
  });
});
