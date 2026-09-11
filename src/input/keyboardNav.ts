import type { BoardConfig } from "../puzzle/types";

/**
 * Computes the next cell to select for an arrow-key press, wrapping at
 * the board edges and automatically stepping over given (locked) cells
 * rather than landing on one and appearing to do nothing. Pure and
 * side-effect-free so it's directly testable without a DOM, a canvas,
 * or a GameState instance.
 *
 * Bounded to at most size*size steps, so a (structurally impossible,
 * but defensively handled) fully-given board can never loop forever —
 * it just returns null, meaning "nothing to move to."
 */
export function computeNextSelection(
  board: BoardConfig,
  from: { row: number; col: number } | null,
  dr: number,
  dc: number
): { row: number; col: number } | null {
  const size = board.size;
  const start = from ?? { row: 0, col: 0 };
  let row = start.row;
  let col = start.col;

  for (let step = 0; step < size * size; step++) {
    row = (row + dr + size) % size;
    col = (col + dc + size) % size;
    if (!board.cells[row][col].isGiven) {
      return { row, col };
    }
  }
  return null;
}

/** Maps an arrow key name to its (dRow, dCol) delta, or null for any
 * other key. */
export const ARROW_KEY_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};
