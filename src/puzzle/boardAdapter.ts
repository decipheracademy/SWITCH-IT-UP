import type { BoardConfig, CellData } from "./types";
import type { SudokuEngine } from "./SudokuEngine";

/**
 * Converts the engine's live board into the BoardConfig/CellData shape
 * BoardScene already knows how to render (see Build 01). This is the
 * one, explicit translation layer between "real puzzle state" and "what
 * the 3D board draws" — BoardScene itself doesn't change at all.
 */
export function engineToBoardConfig(engine: SudokuEngine): BoardConfig {
  const size = engine.size;
  const cells: CellData[][] = [];
  for (let row = 0; row < size; row++) {
    const rowCells: CellData[] = [];
    for (let col = 0; col < size; col++) {
      const raw = engine.getCell(row, col);
      rowCells.push({
        row,
        col,
        value: raw === 0 ? null : raw,
        isGiven: engine.isGiven(row, col),
      });
    }
    cells.push(rowCells);
  }

  return {
    band: engine.definition.band,
    size,
    box: renderBoxDimensions(engine),
    constraintBox: { boxWidth: engine.boxCols, boxHeight: engine.boxRows },
    values: engine.values,
    cells,
    constraints: engine.diagonal ? { diagonals: true } : undefined,
  };
}

/**
 * Box dimensions for RENDERING (which internal grid lines draw bold as
 * "box boundaries") are derived from, but not always identical to, the
 * engine's actual constraint box.
 *
 * Band 1 is the one case where they diverge: a real Sudoku box
 * constraint cannot cover the entire grid (a box requires each value
 * exactly once within it, which is only possible if the box has
 * exactly N cells — a "whole 3x3 grid as one box" would need each of 3
 * values to appear exactly once among 9 cells, which no valid Latin
 * square satisfies). So the engine's actual constraint box for Band 1
 * is a degenerate 1×3 row-box (redundant with the row rule, adding no
 * extra restriction — mathematically the correct choice for a 3x3
 * puzzle). Rendering that as 1×3 would make every row boundary line
 * "bold" (since a box-height of 1 divides every row index), which is
 * the exact Build 01 rendering bug already fixed once. So for display
 * purposes only, a degenerate (1-row or 1-column) box renders as if it
 * spanned the whole grid — bold outer border only, no misleading
 * internal bold lines — while the engine still enforces the correct,
 * harmless 1×3 constraint underneath.
 */
function renderBoxDimensions(engine: SudokuEngine): { boxWidth: number; boxHeight: number } {
  if (engine.boxRows === 1 || engine.boxCols === 1) {
    return { boxWidth: engine.size, boxHeight: engine.size };
  }
  return { boxWidth: engine.boxCols, boxHeight: engine.boxRows };
}
