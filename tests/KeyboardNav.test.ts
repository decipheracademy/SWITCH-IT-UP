import { describe, it, expect } from "vitest";
import { computeNextSelection, ARROW_KEY_DELTAS } from "../src/input/keyboardNav";
import { getPuzzleForBand } from "../src/puzzle/PuzzleRepository";
import { SudokuEngine } from "../src/puzzle/SudokuEngine";
import { engineToBoardConfig } from "../src/puzzle/boardAdapter";

function board(band: 1 | 2 | 3 | 4 | 5 | 6) {
  const def = getPuzzleForBand(band);
  const engine = new SudokuEngine(def);
  return engineToBoardConfig(engine);
}

describe("keyboardNav — ARROW_KEY_DELTAS", () => {
  it("maps all four arrow keys to the correct deltas", () => {
    expect(ARROW_KEY_DELTAS.ArrowUp).toEqual([-1, 0]);
    expect(ARROW_KEY_DELTAS.ArrowDown).toEqual([1, 0]);
    expect(ARROW_KEY_DELTAS.ArrowLeft).toEqual([0, -1]);
    expect(ARROW_KEY_DELTAS.ArrowRight).toEqual([0, 1]);
  });

  it("does not map non-arrow keys", () => {
    expect(ARROW_KEY_DELTAS["Enter"]).toBeUndefined();
    expect(ARROW_KEY_DELTAS["a"]).toBeUndefined();
  });
});

describe("computeNextSelection — basic movement", () => {
  it("moves from a starting cell in the requested direction", () => {
    const b = board(1);
    const next = computeNextSelection(b, { row: 0, col: 2 }, 1, 0);
    expect(next).not.toBeNull();
    expect(b.cells[next!.row][next!.col].isGiven).toBe(false);
  });

  it("starts from (0,0)-adjacent when nothing is selected yet", () => {
    const b = board(1);
    const next = computeNextSelection(b, null, 0, 1);
    expect(next).not.toBeNull();
  });
});

describe("computeNextSelection — steps over given cells", () => {
  it("never returns a given cell", () => {
    const b = board(5);
    let current: { row: number; col: number } | null = { row: 0, col: 0 };
    for (let i = 0; i < 20; i++) {
      current = computeNextSelection(b, current, 0, 1);
      if (current) {
        expect(b.cells[current.row][current.col].isGiven).toBe(false);
      }
    }
  });
});

describe("computeNextSelection — wraps at board edges", () => {
  it("wraps column index around when moving left from column 0", () => {
    const b = board(2);
    const syntheticBoard = {
      ...b,
      cells: b.cells.map((row) => row.map((c) => ({ ...c, isGiven: false, value: null }))),
    };
    const next = computeNextSelection(syntheticBoard, { row: 0, col: 0 }, 0, -1);
    expect(next).toEqual({ row: 0, col: syntheticBoard.size - 1 });
  });

  it("wraps row index around when moving up from row 0", () => {
    const b = board(2);
    const syntheticBoard = {
      ...b,
      cells: b.cells.map((row) => row.map((c) => ({ ...c, isGiven: false, value: null }))),
    };
    const next = computeNextSelection(syntheticBoard, { row: 0, col: 0 }, -1, 0);
    expect(next).toEqual({ row: syntheticBoard.size - 1, col: 0 });
  });
});

describe("computeNextSelection — bounded, never infinite-loops", () => {
  it("returns null rather than looping forever if every cell is given", () => {
    const b = board(1);
    const allGiven = {
      ...b,
      cells: b.cells.map((row) => row.map((c) => ({ ...c, isGiven: true, value: c.value ?? 1 }))),
    };
    const next = computeNextSelection(allGiven, { row: 0, col: 0 }, 1, 0);
    expect(next).toBeNull();
  });
});

describe("computeNextSelection — works across all six bands", () => {
  it("finds a valid next cell for every band", () => {
    for (const b of [1, 2, 3, 4, 5, 6] as const) {
      const cfg = board(b);
      const next = computeNextSelection(cfg, null, 1, 0);
      expect(next).not.toBeNull();
      expect(cfg.cells[next!.row][next!.col].isGiven).toBe(false);
    }
  });
});
