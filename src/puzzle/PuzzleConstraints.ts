/**
 * Pure, generic Sudoku constraint helpers. Neither SudokuEngine nor
 * SudokuSolver re-implements row/column/box/diagonal logic — both call
 * these functions, so there is exactly one place that defines what a
 * "legal placement" means for any board size/box shape.
 *
 * Grid convention: number[][] row-major, 0 = empty.
 */

export function getBoxStart(index: number, boxSpan: number): number {
  return Math.floor(index / boxSpan) * boxSpan;
}

/** True if (row, col) sits on the main diagonal (top-left to
 * bottom-right). */
export function isOnMainDiagonal(row: number, col: number): boolean {
  return row === col;
}

/** True if (row, col) sits on the anti-diagonal (top-right to
 * bottom-left) for a board of the given size. */
export function isOnAntiDiagonal(row: number, col: number, size: number): boolean {
  return row + col === size - 1;
}

export function getRowValues(grid: number[][], row: number): number[] {
  return grid[row].filter((v) => v !== 0);
}

export function getColumnValues(grid: number[][], col: number): number[] {
  const values: number[] = [];
  for (let r = 0; r < grid.length; r++) {
    if (grid[r][col] !== 0) values.push(grid[r][col]);
  }
  return values;
}

export function getBoxValues(
  grid: number[][],
  row: number,
  col: number,
  boxRows: number,
  boxCols: number
): number[] {
  const startRow = getBoxStart(row, boxRows);
  const startCol = getBoxStart(col, boxCols);
  const values: number[] = [];
  for (let r = startRow; r < startRow + boxRows; r++) {
    for (let c = startCol; c < startCol + boxCols; c++) {
      if (grid[r][c] !== 0) values.push(grid[r][c]);
    }
  }
  return values;
}

/** Returns values on whichever of the two main diagonals (row, col)
 * belongs to — a cell can be on one, both (the center of an odd-sized
 * board), or neither. Returns an empty array when diagonal rules are
 * off or the cell is on neither diagonal. */
export function getDiagonalValues(
  grid: number[][],
  row: number,
  col: number,
  size: number,
  diagonalEnabled: boolean
): number[] {
  if (!diagonalEnabled) return [];
  const values = new Set<number>();
  if (isOnMainDiagonal(row, col)) {
    for (let i = 0; i < size; i++) {
      if (grid[i][i] !== 0) values.add(grid[i][i]);
    }
  }
  if (isOnAntiDiagonal(row, col, size)) {
    for (let i = 0; i < size; i++) {
      const c = size - 1 - i;
      if (grid[i][c] !== 0) values.add(grid[i][c]);
    }
  }
  return Array.from(values);
}

export interface BoardShape {
  size: number;
  boxRows: number;
  boxCols: number;
  diagonal: boolean;
}

/**
 * The single authoritative "is this placement legal right now" check —
 * row + column + box + (when enabled) both diagonals. Excludes the
 * target cell's own current value from the conflict check (so
 * re-checking a cell that already holds `value` doesn't flag itself).
 *
 * This checks STRUCTURAL legality against the current board only. It
 * has no knowledge of any solution — that separation is what makes the
 * delayed-consequence mechanic possible (see Build 02 spec §4/§17).
 */
export function isPlacementValid(
  grid: number[][],
  row: number,
  col: number,
  value: number,
  shape: BoardShape
): boolean {
  if (value < 1 || value > shape.size) return false;

  const conflicts = (values: number[]) => values.includes(value);

  const rowValues = grid[row].filter((v, c) => v !== 0 && c !== col);
  if (conflicts(rowValues)) return false;

  const colValues: number[] = [];
  for (let r = 0; r < shape.size; r++) {
    if (r !== row && grid[r][col] !== 0) colValues.push(grid[r][col]);
  }
  if (conflicts(colValues)) return false;

  const startRow = getBoxStart(row, shape.boxRows);
  const startCol = getBoxStart(col, shape.boxCols);
  for (let r = startRow; r < startRow + shape.boxRows; r++) {
    for (let c = startCol; c < startCol + shape.boxCols; c++) {
      if ((r !== row || c !== col) && grid[r][c] === value) return false;
    }
  }

  if (shape.diagonal) {
    if (isOnMainDiagonal(row, col)) {
      for (let i = 0; i < shape.size; i++) {
        if (i !== row && grid[i][i] === value) return false;
      }
    }
    if (isOnAntiDiagonal(row, col, shape.size)) {
      for (let i = 0; i < shape.size; i++) {
        const c = shape.size - 1 - i;
        if (i !== row && grid[i][c] === value) return false;
      }
    }
  }

  return true;
}
