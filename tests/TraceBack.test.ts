import { describe, it, expect } from "vitest";
import { SudokuEngine } from "../src/puzzle/SudokuEngine";
import { DeadEndDetector } from "../src/puzzle/DeadEndDetector";
import { GameState } from "../src/core/GameState";
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
// TEST GROUP 1 — Trace Back with empty history
// ---------------------------------------------------------------------
describe("Test group 1 — Trace Back with empty history", () => {
  it("engine.rollbackLastMove() returns null and does not crash or change the board", () => {
    const e = new SudokuEngine(def4x4([[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    const before = e.snapshot();
    const result = e.rollbackLastMove();
    expect(result).toBeNull();
    expect(e.snapshot()).toEqual(before);
    expect(e.hasTraceableMove()).toBe(false);
  });

  it("GameState.traceBack() on a fresh puzzle does nothing (no crash, no board/status corruption)", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    const boardBefore = JSON.stringify(gs.currentBoard);
    const statusBefore = gs.puzzleStatus;
    gs.traceBack();
    expect(JSON.stringify(gs.currentBoard)).toBe(boardBefore);
    expect(gs.puzzleStatus).toBe(statusBefore);
    expect(gs.canTraceBack()).toBe(false);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 2 — Trace Back with one move
// ---------------------------------------------------------------------
describe("Test group 2 — Trace Back with one move", () => {
  it("rolls back a single placement, restoring the cell and emptying history", () => {
    const e = new SudokuEngine(def4x4([[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    expect(e.setCell(0, 1, 2)).toBe(true);
    expect(e.getMoveHistory().length).toBe(1);

    const record = e.rollbackLastMove();
    expect(record).toMatchObject({ row: 0, col: 1, previousValue: 0, newValue: 2 });
    expect(e.getCell(0, 1)).toBe(0);
    expect(e.getMoveHistory().length).toBe(0);
    expect(e.hasTraceableMove()).toBe(false);
  });

  it("via GameState: history count goes 1 -> 0 and only the target cell changes", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);
    expect(gs.engine.getMoveHistory().length).toBe(1);

    gs.traceBack();

    expect(gs.engine.getMoveHistory().length).toBe(0);
    expect(gs.currentBoard.cells[0][2].value).toBeNull();
    // Givens must be exactly as before.
    expect(gs.currentBoard.cells[0][0].value).toBe(1);
    expect(gs.currentBoard.cells[0][1].value).toBe(2);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 3 — Trace Back with multiple moves
// ---------------------------------------------------------------------
describe("Test group 3 — Trace Back with multiple moves", () => {
  it("[A, B, C] -> Trace Back -> [A, B] -> Trace Back -> [A] -> Trace Back -> []", () => {
    const e = new SudokuEngine(def4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    e.setCell(0, 0, 1); // A
    e.setCell(0, 1, 2); // B
    e.setCell(0, 2, 3); // C
    expect(e.getMoveHistory().map((m) => `${m.row},${m.col}`)).toEqual(["0,0", "0,1", "0,2"]);

    e.rollbackLastMove();
    expect(e.getMoveHistory().map((m) => `${m.row},${m.col}`)).toEqual(["0,0", "0,1"]);
    expect(e.getCell(0, 2)).toBe(0);

    e.rollbackLastMove();
    expect(e.getMoveHistory().map((m) => `${m.row},${m.col}`)).toEqual(["0,0"]);
    expect(e.getCell(0, 1)).toBe(0);

    e.rollbackLastMove();
    expect(e.getMoveHistory()).toEqual([]);
    expect(e.getCell(0, 0)).toBe(0);
  });

  it("never skips a history position, never rolls back the same move twice", () => {
    const e = new SudokuEngine(def4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    e.setCell(0, 0, 1);
    e.setCell(1, 1, 4);
    e.rollbackLastMove();
    e.rollbackLastMove();
    const before = e.snapshot();
    const result = e.rollbackLastMove();
    expect(result).toBeNull();
    expect(e.snapshot()).toEqual(before);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 4 — Correct previous-state restoration
// ---------------------------------------------------------------------
describe("Test group 4 — correct previous-state restoration", () => {
  it("empty -> 5, Trace Back -> empty", () => {
    const e = new SudokuEngine(def4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    e.setCell(2, 2, 4);
    expect(e.getCell(2, 2)).toBe(4);
    e.rollbackLastMove();
    expect(e.getCell(2, 2)).toBe(0);
  });

  it("a successful clear (5 -> empty) rolls back to (empty -> 5)", () => {
    const e = new SudokuEngine(def4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    e.setCell(1, 1, 4);
    expect(e.clearCell(1, 1)).toBe(true);
    expect(e.getCell(1, 1)).toBe(0);
    const record = e.rollbackLastMove();
    expect(record).toMatchObject({ row: 1, col: 1, previousValue: 4, newValue: 0 });
    expect(e.getCell(1, 1)).toBe(4);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 5 — Given-cell protection
// ---------------------------------------------------------------------
describe("Test group 5 — given-cell protection", () => {
  it("a given cell can never enter move history, be removed, or be modified by Trace Back", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    expect(gs.currentBoard.cells[0][0].isGiven).toBe(true);
    const givenValueBefore = gs.currentBoard.cells[0][0].value;

    gs.selectCell(0, 0);
    expect(gs.selectedCell).toBeNull(); // given cells are never selectable

    gs.selectCell(0, 2);
    gs.placeValue(3);
    gs.traceBack();
    expect(gs.currentBoard.cells[0][0].value).toBe(givenValueBefore);
    expect(gs.currentBoard.cells[0][0].isGiven).toBe(true);

    for (const move of gs.engine.getMoveHistory()) {
      expect(gs.engine.isGiven(move.row, move.col)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 6 — Rejected moves not entering history
// ---------------------------------------------------------------------
describe("Test group 6 — rejected moves do not enter history", () => {
  it("a structurally illegal placement attempt leaves history unchanged, and Trace Back cannot roll it back", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(1); // illegal: row0 already has 1
    expect(gs.engine.getMoveHistory().length).toBe(0);
    expect(gs.currentBoard.cells[0][2].value).toBeNull();

    const before = JSON.stringify(gs.currentBoard);
    gs.traceBack();
    expect(JSON.stringify(gs.currentBoard)).toBe(before);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 7 — Trace Back does not create history entries
// ---------------------------------------------------------------------
describe("Test group 7 — Trace Back does not create history entries", () => {
  it("[A, B] -> Trace Back B -> [A]  (not [A, B, rollback-B])", () => {
    const e = new SudokuEngine(def4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    e.setCell(0, 0, 1); // A
    e.setCell(0, 1, 2); // B
    expect(e.getMoveHistory().length).toBe(2);
    e.rollbackLastMove();
    expect(e.getMoveHistory().length).toBe(1);
    expect(e.getMoveHistory()[0].row).toBe(0);
    expect(e.getMoveHistory()[0].col).toBe(0);
  });

  it("via GameState.traceBack(), history shrinks and never grows", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);
    expect(gs.engine.getMoveHistory().length).toBe(1);
    gs.traceBack();
    expect(gs.engine.getMoveHistory().length).toBe(0);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 8 — Dead End allows Trace Back
// ---------------------------------------------------------------------
describe("Test group 8 — Dead End allows Trace Back while locking placement", () => {
  it("placeValue/clearSelectedCell are locked during dead-end, but traceBack still works", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);
    (gs as unknown as { puzzleStatus: string }).puzzleStatus = "dead-end";

    const boardBefore = JSON.stringify(gs.currentBoard);
    gs.selectCell(1, 0);
    gs.placeValue(2);
    expect(JSON.stringify(gs.currentBoard)).toBe(boardBefore);

    expect(gs.canTraceBack()).toBe(true);
    gs.traceBack();
    expect(gs.engine.getMoveHistory().length).toBe(0);
    expect(JSON.stringify(gs.currentBoard)).not.toBe(boardBefore);
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 9 & 10 — Dead End requiring multiple Trace Backs
// ---------------------------------------------------------------------
describe("Test groups 9/10 — Dead End remains until sufficiently traced back", () => {
  it("one Trace Back is not assumed sufficient; the dead end clears only once the real condition clears", () => {
    const givens = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const e = new SudokuEngine(def4x4(givens, STANDARD_4X4_SOLUTION));

    e.setCell(0, 0, 1); // A
    e.setCell(0, 1, 3); // B
    e.setCell(1, 0, 4); // C
    e.setCell(2, 1, 2); // D -> traps (1,1)
    let result = DeadEndDetector.detect(e);
    expect(result.isDeadEnd).toBe(true);
    expect(result.cellsWithoutCandidates).toContainEqual({ row: 1, col: 1 });

    e.rollbackLastMove(); // undo D
    result = DeadEndDetector.detect(e);
    if (result.isDeadEnd) {
      e.rollbackLastMove(); // undo C
      result = DeadEndDetector.detect(e);
      if (result.isDeadEnd) {
        e.rollbackLastMove(); // undo B
        result = DeadEndDetector.detect(e);
      }
    }
    expect(result.isDeadEnd).toBe(false); // must eventually clear
  });

  it("via GameState: repeated traceBack() calls correctly re-evaluate dead-end status each time", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);
    gs.selectCell(1, 0);
    gs.placeValue(2);
    (gs as unknown as { puzzleStatus: string }).puzzleStatus = "dead-end";
    expect(gs.puzzleStatus).toBe("dead-end");

    gs.traceBack(); // pops (1,0)=2
    expect(gs.puzzleStatus).not.toBe("dead-end");

    const gs2 = new GameState();
    gs2.selectGrade(1);
    gs2.traceBack();
    gs2.traceBack();
    expect(gs2.puzzleStatus).toBe("in-progress");
  });
});

// ---------------------------------------------------------------------
// TEST GROUP 11 — Placement remains locked during Dead End
// ---------------------------------------------------------------------
describe("Test group 11 — placement remains locked during Dead End", () => {
  it("placeValue and clearSelectedCell both no-op while puzzleStatus is dead-end", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);
    (gs as unknown as { puzzleStatus: string }).puzzleStatus = "dead-end";

    const before = JSON.stringify(gs.currentBoard);
    gs.selectCell(1, 0);
    gs.placeValue(2);
    expect(JSON.stringify(gs.currentBoard)).toBe(before);
    gs.clearSelectedCell();
    expect(JSON.stringify(gs.currentBoard)).toBe(before);
  });
});

// ---------------------------------------------------------------------
// History/board consistency after multiple Trace Backs
// ---------------------------------------------------------------------
describe("History/board consistency after multiple Trace Backs", () => {
  it("after 3 rollbacks from 5 moves, the board exactly matches the state after move 2", () => {
    const e = new SudokuEngine(def4x4([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    e.setCell(0, 0, 1);
    e.setCell(0, 1, 2);
    const snapshotAfterMove2 = e.snapshot();
    e.setCell(0, 2, 3);
    e.setCell(0, 3, 4);
    e.setCell(1, 0, 3);

    e.rollbackLastMove();
    e.rollbackLastMove();
    e.rollbackLastMove();

    expect(e.snapshot()).toEqual(snapshotAfterMove2);
    expect(e.getMoveHistory().length).toBe(2);

    const withGivens = new SudokuEngine(
      def4x4([[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION)
    );
    withGivens.setCell(0, 1, 2);
    withGivens.rollbackLastMove();
    expect(withGivens.getCell(0, 0)).toBe(1); // given, untouched
  });
});

// ---------------------------------------------------------------------
// Solution protection through Trace Back
// ---------------------------------------------------------------------
describe("Trace Back never reveals the solution", () => {
  it("the move:rolledback event carries only coordinates, never values or solution data", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);

    let eventPayload: unknown = null;
    gs.bus.on("move:rolledback", (payload) => {
      eventPayload = payload;
    });
    gs.traceBack();

    expect(eventPayload).not.toBeNull();
    expect(Object.keys(eventPayload as object).sort()).toEqual(["col", "row"]);
  });

  it("the engine's rollback record never exposes the solution", () => {
    const e = new SudokuEngine(def4x4([[1, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], STANDARD_4X4_SOLUTION));
    e.setCell(0, 1, 2);
    const record = e.rollbackLastMove();
    expect(record).not.toBeNull();
    expect(Object.keys(record!).sort()).toEqual(
      ["col", "moveId", "newValue", "order", "playerEntered", "previousValue", "row"].sort()
    );
  });
});

// ---------------------------------------------------------------------
// PRIMARY BUILD 04 ACCEPTANCE TEST (spec §37)
// ---------------------------------------------------------------------
describe("PRIMARY: Dead End recovery via Trace Back", () => {
  it("a locally-legal-but-wrong move leads to a dead end; tracing back (possibly repeatedly) resolves it; the solution is never exposed", () => {
    const givens = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const e = new SudokuEngine(def4x4(givens, STANDARD_4X4_SOLUTION));

    expect(e.isValueAllowed(0, 1, 3)).toBe(true);
    expect(STANDARD_4X4_SOLUTION[0][1]).not.toBe(3);
    expect(e.setCell(0, 1, 3)).toBe(true);

    e.setCell(0, 2, 4);
    e.setCell(1, 0, 4);
    e.setCell(2, 1, 2);
    e.setCell(3, 1, 1); // closes off (1,1)'s last remaining candidate

    let deadEnd = DeadEndDetector.detect(e);
    expect(deadEnd.isDeadEnd).toBe(true);
    expect(e.hasTraceableMove()).toBe(true);

    let attempts = 0;
    while (deadEnd.isDeadEnd && e.hasTraceableMove() && attempts < 10) {
      e.rollbackLastMove();
      deadEnd = DeadEndDetector.detect(e);
      attempts++;
    }

    expect(deadEnd.isDeadEnd).toBe(false);
  });
});
