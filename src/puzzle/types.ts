/**
 * Puzzle data types.
 *
 * IMPORTANT ARCHITECTURAL NOTE (Build 01):
 * These types describe a board configuration that the 3D renderer can draw.
 * They do NOT contain any Sudoku generation, solving, or validation logic.
 * Build 02 will introduce a real puzzle engine that produces data shaped
 * like this (or extends it) without requiring changes to the rendering
 * layer in src/three/.
 */

/** The six documented grade bands. */
export type GradeBand = 1 | 2 | 3 | 4 | 5 | 6;

/** An individual student grade, 1 through 12. The final game UI selects
 * by exact grade; grade bands remain the internal difficulty-scaling
 * unit and are derived from the grade (see GRADE_TO_BAND in
 * puzzle/mockData.ts). Both values are retained — see GameState. */
export type PlayerGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** How a cell's value should currently be rendered. Numbers are internal;
 * letters/symbols are a display-only mapping applied at render time
 * (see RenderSkin below). Build 01 only wires the concept through — the
 * full skin system arrives in Build 05. */
export type RenderSkin = "number" | "letter" | "symbol";

/** Why a cell looks the way it does. Purely visual/state information —
 * this is NOT a legality or correctness judgement. "dead-end" (Build
 * 03) marks an empty cell with zero legal candidates left — a warning
 * that the current path is impossible, never a claim that this cell
 * itself was the mistake. */
export type CellState =
  | "default"
  | "hover"
  | "selected"
  | "related"
  | "given"
  | "player-filled"
  | "empty"
  | "disabled"
  | "dead-end";

/** A single cell in the grid. `value` is the internal numeric value
 * (1..N) or null if empty. `isGiven` marks a pre-filled clue cell that
 * the player cannot edit. */
export interface CellData {
  row: number;
  col: number;
  value: number | null;
  isGiven: boolean;
}

/** Describes how the board is divided into sub-regions ("boxes").
 * Board sizes in this spec are not always square boxes (Band 3/4 use
 * 2x3 boxes on a 6x6 grid), so box width/height are stored explicitly
 * rather than assumed. */
export interface BoxDimensions {
  boxWidth: number;
  boxHeight: number;
}

/** Optional metadata for constraints beyond standard row/column/box
 * rules. Band 6 eventually adds a diagonal constraint on top of
 * standard 9x9 rules. Build 01 only carries this as data — it is not
 * enforced yet. */
export interface ConstraintMetadata {
  diagonals?: boolean;
}

/** A full board configuration, sized for a given grade band. */
export interface BoardConfig {
  band: GradeBand;
  size: number; // N — board is size x size
  /** Box dimensions for RENDERING (grid-line thickness) only. For a
   * degenerate constraint box (Band 1's 1×3), this is overridden to
   * span the whole grid so the outer border reads as bold without every
   * internal line falsely reading as a box boundary too — see
   * boardAdapter.ts's renderBoxDimensions(). Do NOT use this for
   * anything gameplay-relevant (e.g. "related cell" highlighting) —
   * use constraintBox for that. */
  box: BoxDimensions;
  /** The board's ACTUAL Sudoku box constraint — always the true
   * boxRows/boxCols from the puzzle definition, never overridden for
   * display purposes. This is what "related cell" highlighting and any
   * other gameplay-meaningful box logic must use. */
  constraintBox: BoxDimensions;
  values: number[]; // the legal internal values, e.g. [1,2,3]
  cells: CellData[][]; // [row][col]
  constraints?: ConstraintMetadata;
}

/** A renderable representation of a value — the numeric internal value
 * plus how it should currently be displayed under the active skin.
 * Build 01 always uses "number" skin; the mapping tables for letter/
 * symbol skins arrive in Build 05. */
export interface RenderableValue {
  internal: number;
  display: string;
}
