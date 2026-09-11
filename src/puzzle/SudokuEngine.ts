import type { MoveRecord, PuzzleDefinition } from "./PuzzleTypes";
import {
  getRowValues,
  getColumnValues,
  getBoxValues,
  getDiagonalValues,
  isPlacementValid,
  type BoardShape,
} from "./PuzzleConstraints";

/**
 * The mutable half of a puzzle: the player's current board, built from
 * an immutable PuzzleDefinition. This class is the single authority on
 * "what's on the board right now" and "is this placement legal" — it
 * has no idea Three.js exists, which is what keeps it independently
 * testable (see puzzle/ tests) and reusable if the rendering layer
 * ever changes.
 *
 * Central rule (Build 02 spec §4): isValueAllowed() only ever checks
 * the CURRENT board's row/column/box/diagonal constraints. It never
 * consults the hidden solution. A value that is locally legal but
 * differs from the solution is accepted and stays on the board — that
 * gap between "structurally legal" and "matches the solution" is what
 * Build 03's Dead End mechanic will later surface.
 */
export class SudokuEngine {
  readonly definition: PuzzleDefinition;
  readonly size: number;
  readonly boxRows: number;
  readonly boxCols: number;
  readonly diagonal: boolean;
  readonly values: number[];

  private board: number[][];
  private givensMask: boolean[][];
  private moveOrder = 0;
  /** Move history foundation for Build 04's Trace Back — every
   * successful player mutation (placement or clear) is recorded here,
   * in order. Givens are never recorded (they aren't player moves), and
   * neither are rejected/illegal attempts (setCell/clearCell only push
   * a record on the success path, after the mutation already
   * happened). Not yet consumed by any rollback logic — Build 03 only
   * establishes the record. */
  private moveHistory: MoveRecord[] = [];

  constructor(definition: PuzzleDefinition) {
    this.definition = definition;
    this.size = definition.size;
    this.boxRows = definition.boxRows;
    this.boxCols = definition.boxCols;
    this.diagonal = definition.diagonal;
    this.values = Array.from({ length: this.size }, (_, i) => i + 1);

    this.board = definition.givens.map((row) => row.slice());
    this.givensMask = definition.givens.map((row) => row.map((v) => v !== 0));
  }

  private get shape(): BoardShape {
    return { size: this.size, boxRows: this.boxRows, boxCols: this.boxCols, diagonal: this.diagonal };
  }

  private assertInBounds(row: number, col: number): void {
    if (row < 0 || row >= this.size || col < 0 || col >= this.size) {
      throw new RangeError(`Cell (${row}, ${col}) is out of bounds for a ${this.size}x${this.size} board.`);
    }
  }

  getCell(row: number, col: number): number {
    this.assertInBounds(row, col);
    return this.board[row][col];
  }

  isGiven(row: number, col: number): boolean {
    this.assertInBounds(row, col);
    return this.givensMask[row][col];
  }

  isEditable(row: number, col: number): boolean {
    return !this.isGiven(row, col);
  }

  /** Structural legality against the CURRENT board only — see the
   * class doc. Never compares against the hidden solution. */
  isValueAllowed(row: number, col: number, value: number): boolean {
    this.assertInBounds(row, col);
    if (this.isGiven(row, col)) return false;
    return isPlacementValid(this.board, row, col, value, this.shape);
  }

  /** Commits a value into an editable cell. Returns false (and leaves
   * the board untouched) if the cell is a given, the value is out of
   * range, or the value is not structurally allowed right now. */
  setCell(row: number, col: number, value: number): boolean {
    this.assertInBounds(row, col);
    if (this.isGiven(row, col)) return false;
    if (value < 1 || value > this.size) return false;
    if (!this.isValueAllowed(row, col, value)) return false;
    const previousValue = this.board[row][col];
    this.board[row][col] = value;
    this.moveOrder++;
    this.moveHistory.push({
      moveId: this.moveOrder,
      row,
      col,
      previousValue,
      newValue: value,
      order: this.moveOrder,
      playerEntered: true,
    });
    return true;
  }

  /** Clears an editable cell. Returns false for a given cell or a cell
   * that was already empty. */
  clearCell(row: number, col: number): boolean {
    this.assertInBounds(row, col);
    if (this.isGiven(row, col)) return false;
    const previousValue = this.board[row][col];
    if (previousValue === 0) return false;
    this.board[row][col] = 0;
    this.moveOrder++;
    this.moveHistory.push({
      moveId: this.moveOrder,
      row,
      col,
      previousValue,
      newValue: 0,
      order: this.moveOrder,
      playerEntered: true,
    });
    return true;
  }

  /** A defensive copy of every successful player move so far, in
   * chronological order. Consumed by rollbackLastMove() below (Build 04). */
  getMoveHistory(): MoveRecord[] {
    return this.moveHistory.slice();
  }

  /** How many successful player moves have been made — used as the
   * "detected at move" marker when a Dead End is found (see
   * DeadEndDetector / GameState). */
  getMoveCount(): number {
    return this.moveHistory.length;
  }

  /** True if there is at least one player move that Trace Back could
   * roll back. */
  hasTraceableMove(): boolean {
    return this.moveHistory.length > 0;
  }

  /**
   * Trace Back's core operation (Build 04 spec §3/§9/§15): reverses the
   * single most recent player move by restoring the cell's previousValue
   * and removing that record from history. Returns the record that was
   * rolled back, or null if there was nothing to roll back.
   *
   * Deliberately bypasses setCell()/clearCell() entirely — it writes
   * board[row][col] directly — because going through either of those
   * would push a NEW history entry for what is fundamentally an
   * undo, not a new player mutation (spec §40: "Trace Back must not
   * create history entries"). Works identically for every board
   * size/box shape/diagonal configuration since it only ever touches
   * the coordinates already recorded in the move itself — no
   * band-specific logic, no re-validation against Sudoku rules (the
   * restored value was legal when it was first placed, and removing a
   * value can never introduce a new conflict).
   *
   * Never touches a given: given cells are structurally excluded from
   * ever entering moveHistory in the first place (setCell/clearCell
   * both reject given cells before ever pushing a record), so there is
   * no code path by which this method could roll back a given.
   */
  rollbackLastMove(): MoveRecord | null {
    const record = this.moveHistory.pop();
    if (!record) return null;
    this.board[record.row][record.col] = record.previousValue;
    return record;
  }

  getRowValues(row: number): number[] {
    return getRowValues(this.board, row);
  }

  getColumnValues(col: number): number[] {
    return getColumnValues(this.board, col);
  }

  getBoxValues(row: number, col: number): number[] {
    return getBoxValues(this.board, row, col, this.boxRows, this.boxCols);
  }

  getDiagonalValues(row: number, col: number): number[] {
    return getDiagonalValues(this.board, row, col, this.size, this.diagonal);
  }

  isComplete(): boolean {
    return this.board.every((row) => row.every((v) => v !== 0));
  }

  /** Checks the current board for internal consistency (no duplicate
   * conflicts) — this is a structural sanity check, NOT a check
   * against the hidden solution. A board can be structurally valid and
   * still not match the solution. */
  validateCurrentBoard(): { valid: boolean; conflicts: Array<{ row: number; col: number }> } {
    const conflicts: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const value = this.board[r][c];
        if (value === 0) continue;
        // Temporarily treat the cell as empty to test whether ITS
        // OWN value is legal given everything else — a direct way to
        // surface any conflict without re-deriving row/col/box logic.
        const original = this.board[r][c];
        this.board[r][c] = 0;
        const stillLegal = isPlacementValid(this.board, r, c, value, this.shape);
        this.board[r][c] = original;
        if (!stillLegal) conflicts.push({ row: r, col: c });
      }
    }
    return { valid: conflicts.length === 0, conflicts };
  }

  /** Compares the current board to the hidden solution. This is the
   * ONLY place the solution is consulted at runtime, and the result is
   * a single boolean — never the solution values themselves. Callers
   * (GameState) must not surface anything beyond that boolean to the
   * UI (see Build 02 spec §21/§45). */
  matchesSolution(): boolean {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] !== this.definition.solution[r][c]) return false;
      }
    }
    return true;
  }

  /** Returns a defensive copy of the current board — safe to hand to
   * rendering code, since mutating it can't affect engine state. */
  snapshot(): number[][] {
    return this.board.map((row) => row.slice());
  }
}
