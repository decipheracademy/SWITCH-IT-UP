import type { BoardConfig, GradeBand, PlayerGrade, RenderSkin } from "../puzzle/types";
import type { CellCoord, PuzzleDefinition, PuzzleStatus } from "../puzzle/PuzzleTypes";
import { GRADE_TO_BAND } from "../puzzle/mockData";
import { getPuzzleForBand } from "../puzzle/PuzzleRepository";
import { SudokuEngine } from "../puzzle/SudokuEngine";
import { DeadEndDetector } from "../puzzle/DeadEndDetector";
import { engineToBoardConfig } from "../puzzle/boardAdapter";
import { buildResult, type GameResult } from "../results/ResultManager";
import { recordAttempt } from "../competition/AttemptManager";
import { EventBus } from "./EventBus";

/** Top-level application screens (navigation, not gameplay rules). */
export type AppScreen =
  | "loader"
  | "home"
  | "how-to-play"
  | "player-setup"
  | "grade-select"
  | "countdown"
  | "game"
  | "results"
  | "leaderboard";

/** Practice never scores, never touches the leaderboard or personal
 * best (Build 05 spec §8/§54). Official does all three, and only for a
 * genuinely completed (board full AND matches solution) session. */
export type GameMode = "practice" | "official";

/** Mobile pan state, as reported by CameraManager (three/CameraManager.ts).
 * Defined here (not in three/) so core stays the single source of truth
 * for cross-cutting app types and three/ can depend on core without
 * creating a reverse dependency. */
export interface PanState {
  enabled: boolean;
  range: number;
  x: number;
}

/** All events that flow through the app-wide EventBus. Keeping this in
 * one place makes it easy to see the full set of cross-system signals. */
export interface AppEvents extends Record<string, unknown> {
  "screen:change": { screen: AppScreen };
  "grade:selected": { grade: PlayerGrade; band: GradeBand };
  "cell:hover": { row: number; col: number } | null;
  "cell:select": { row: number; col: number } | null;
  "value:pick": { value: number };
  /** Fired after Trace Back successfully rolls back a move — separate
   * from "value:pick" (which is a player's own placement/clear) so
   * listeners can tell the two apart if they ever need to (e.g. not
   * playing the "placement" sound for a rollback). Carries only the
   * restored coordinates — never the value, per Build 04 spec §16's
   * "the player should only see that the board has been rolled
   * backward", not a description of what changed. */
  "move:rolledback": { row: number; col: number };
  /** Internal only — see Build 02 spec §34/§35 and Build 03 spec §11.
   * Never rendered as correct/incorrect feedback; the presentation
   * layer only ever sees the status label and (for dead-end) the
   * affected cells — never the reason, the historical move, or the
   * solution. */
  "puzzle:status": { status: PuzzleStatus };
  "board:rebuilt": { board: BoardConfig };
  "camera:pan": PanState;
  /** Fired exactly once per session, the moment a genuinely valid
   * completion (board full AND matches the hidden solution) is
   * reached and GameState has finalized a GameResult (scored, and for
   * an official completion, already saved to the leaderboard/personal
   * best — see GameState.finalizeResult()). The presentation layer
   * uses this purely as a navigation cue; it never recalculates the
   * score itself (Build 05 spec §25). */
  "result:ready": { result: GameResult };
  "skin:changed": { skin: RenderSkin };
}

/**
 * Central, framework-agnostic application state.
 *
 * This class holds session/UI state and now (Build 02) a reference to
 * the real SudokuEngine for the active puzzle. It still does NOT know
 * how to render anything — three/BoardScene.ts reads currentBoard
 * (kept in sync with the engine via engineToBoardConfig) exactly as it
 * did with Build 01's mock data, so the rendering layer required zero
 * changes.
 */
export class GameState {
  readonly bus = new EventBus<AppEvents>();

  screen: AppScreen = "loader";
  playerName: string = "";
  /** Exact grade the student picked (1–12) — retained separately from
   * gradeBand per correction pass #1. Never replace one with the other. */
  playerGrade: PlayerGrade = 1;
  /** Internal six-band difficulty unit, derived from playerGrade via
   * GRADE_TO_BAND. Puzzle sizing/scaling keys off this, not the raw grade. */
  gradeBand: GradeBand = 1;
  renderSkin: RenderSkin = "number";
  mode: GameMode = "practice";

  puzzleDef: PuzzleDefinition;
  engine: SudokuEngine;
  currentBoard: BoardConfig;
  puzzleStatus: PuzzleStatus = "in-progress";
  /** The empty cells with zero legal candidates, when puzzleStatus is
   * "dead-end" — the current contradiction, NOT necessarily where the
   * original mistake happened (see DeadEndDetector). Empty otherwise. */
  deadEndCells: CellCoord[] = [];
  /** The move count at which the dead end was detected (i.e. how many
   * successful player moves existed at that point) — kept for Build
   * 04's Trace Back, not used or displayed in Build 03. Null when not
   * in a dead-end state. */
  deadEndDetectedAtMove: number | null = null;
  /** Non-scoring telemetry (Build 04 spec §42) — how many times Trace
   * Back has been used this puzzle. Not displayed anywhere in Build 04;
   * exposed only so a later scoring build doesn't need another wiring
   * pass to get at it. */
  traceBackCount = 0;
  /** A "confirmed mistake" (Build 05 spec §18) is NOT every illegal
   * attempt (those are simply rejected, per Build 02) and NOT every
   * Trace Back — it's counted once per DISTINCT dead-end EVENT (i.e.
   * each time the puzzle transitions from non-dead-end into dead-end).
   * This is the interpretation this build uses for the spec's
   * intentionally loose definition ("a player decision that ultimately
   * contributed to a Dead End and required Trace Back") — documented
   * explicitly here and in the README rather than left ambiguous. It
   * does NOT increment again for every subsequent Trace Back spent
   * resolving that same dead end (see updatePuzzleState below). */
  confirmedMistakes = 0;
  /** Populated exactly once, by finalizeResult(), the moment the
   * puzzle is genuinely completed. Null before that. The results
   * screen reads this rather than recomputing — recomputing would
   * risk double-submitting to the leaderboard/personal best, which
   * both have real side effects. */
  lastResult: GameResult | null = null;
  /** True only when the currently-shown lastResult is a PREVIOUSLY
   * recorded official attempt being redisplayed (via
   * loadExistingResult()) rather than one just earned this session —
   * lets the results screen show "this is your recorded result" instead
   * of the normal completion reveal. Reset whenever a fresh session
   * starts. */
  viewingExistingAttempt = false;

  selectedCell: { row: number; col: number } | null = null;
  hoveredCell: { row: number; col: number } | null = null;

  constructor() {
    // Band 1 is always available (see PuzzleRepository), so this never
    // needs the try/catch that selectGrade() uses for later bands.
    this.puzzleDef = getPuzzleForBand(this.gradeBand);
    this.engine = new SudokuEngine(this.puzzleDef);
    this.currentBoard = engineToBoardConfig(this.engine);
  }

  goTo(screen: AppScreen): void {
    this.screen = screen;
    this.bus.emit("screen:change", { screen });
  }

  setPlayerName(name: string): void {
    this.playerName = name.trim();
  }

  setSkin(skin: RenderSkin): void {
    this.renderSkin = skin;
    this.bus.emit("skin:changed", { skin });
  }

  /** Loads the puzzle for a grade's band and resets play state. All six
   * bands are now genuinely valid/solvable/unique (see
   * PuzzleRepository.ts's Build 02A correction notes), so this always
   * succeeds — getPuzzleForBand() is trusted rather than defensively
   * caught here. */
  selectGrade(grade: PlayerGrade): void {
    const band = GRADE_TO_BAND[grade];
    const def = getPuzzleForBand(band);

    this.playerGrade = grade;
    this.gradeBand = band;
    this.puzzleDef = def;
    this.engine = new SudokuEngine(def);
    this.currentBoard = engineToBoardConfig(this.engine);
    this.puzzleStatus = "in-progress";
    this.deadEndCells = [];
    this.deadEndDetectedAtMove = null;
    this.traceBackCount = 0;
    this.confirmedMistakes = 0;
    this.lastResult = null;
    this.viewingExistingAttempt = false;
    this.selectedCell = null;
    this.hoveredCell = null;
    this.bus.emit("grade:selected", { grade, band });
    this.bus.emit("board:rebuilt", { board: this.currentBoard });
  }

  /**
   * Starts a fresh challenge session in the given mode (Build 05 spec
   * §8/§9): a brand-new SudokuEngine instance for the currently
   * selected grade (so move history, Trace Back count, confirmed
   * mistakes, Dead End state, and completion status are all
   * genuinely reset, not just zeroed on top of stale engine state),
   * with `mode` locked for the duration of the session. Re-selecting
   * the same grade is exactly how a fresh puzzle instance is obtained
   * — SudokuEngine has no "reset" of its own by design (a fresh
   * definition load is simpler and harder to get subtly wrong than an
   * in-place clear).
   */
  startChallenge(mode: GameMode): void {
    this.mode = mode;
    this.selectGrade(this.playerGrade);
  }

  /**
   * Shows a previously-recorded official result instead of starting a
   * fresh session — used when a player who already completed this
   * grade band's official challenge selects that grade again (Build 05
   * spec §10 / Build 06 spec §49: one official attempt per player per
   * band, no accidental duplicate). Does NOT touch the engine, move
   * history, or scoring in any way; it's purely a "here's what you
   * already earned" redisplay. Navigation to the results screen is the
   * caller's responsibility (GradeSelectScreen), same as every other
   * screen transition.
   */
  loadExistingResult(result: GameResult): void {
    this.lastResult = result;
    this.viewingExistingAttempt = true;
  }

  selectCell(row: number, col: number): void {
    const cell = this.currentBoard.cells[row]?.[col];
    if (!cell || cell.isGiven) return; // given cells are not selectable
    this.selectedCell = { row, col };
    this.bus.emit("cell:select", this.selectedCell);
  }

  clearSelection(): void {
    this.selectedCell = null;
    this.bus.emit("cell:select", null);
  }

  hoverCell(row: number | null, col: number | null): void {
    this.hoveredCell = row !== null && col !== null ? { row, col } : null;
    this.bus.emit("cell:hover", this.hoveredCell);
  }

  /** True only if the value is structurally legal against the CURRENT
   * board (row/column/box/diagonal) for the selected cell — never
   * checked against the hidden solution. Used by the HUD to decide
   * which palette buttons to disable (Build 02 spec §18). */
  isValueAllowedForSelection(value: number): boolean {
    if (!this.selectedCell) return false;
    const { row, col } = this.selectedCell;
    return this.engine.isValueAllowed(row, col, value);
  }

  /** Commits a value into the selected cell via the real engine. Silently
   * does nothing if there's no selection, the cell is a given, the value
   * isn't structurally legal right now, or the puzzle is already in a
   * dead-end state (Build 03 spec §17 — normal input is locked once a
   * dead end is detected; recovery is Build 04's Trace Back, not this
   * build). There is deliberately no "wrong move" feedback path (Build
   * 02 spec §19) — a locally legal value that differs from the hidden
   * solution is accepted and stays on the board. */
  placeValue(value: number): void {
    if (this.puzzleStatus === "dead-end") return;
    if (!this.selectedCell) return;
    const { row, col } = this.selectedCell;
    if (!this.engine.setCell(row, col, value)) return;
    this.currentBoard = engineToBoardConfig(this.engine);
    this.bus.emit("value:pick", { value });
    this.updatePuzzleState();
  }

  /** Clears the selected cell if it's editable and non-empty. Given
   * cells can never be cleared, and (per §17) input is locked entirely
   * once a dead end is active. */
  clearSelectedCell(): void {
    if (this.puzzleStatus === "dead-end") return;
    if (!this.selectedCell) return;
    const { row, col } = this.selectedCell;
    if (!this.engine.clearCell(row, col)) return;
    this.currentBoard = engineToBoardConfig(this.engine);
    this.bus.emit("value:pick", { value: 0 });
    this.updatePuzzleState();
  }

  /** True if there's a player move Trace Back could roll back right
   * now. Used by the HUD to enable/disable the Trace Back control —
   * unlike the palette/Clear, this stays enabled during a dead end
   * (Build 04 spec §10/§18: Trace Back is the one action still allowed
   * while normal placement is locked). */
  canTraceBack(): boolean {
    return this.engine.hasTraceableMove();
  }

  /**
   * Rolls back the single most recent player move (Build 04's core
   * mechanic). Does nothing if there's no traceable move — no crash, no
   * state change (spec §31). Never touches a given (structurally
   * impossible — givens never enter move history in the first place).
   * Never creates a new history entry for the rollback itself (spec
   * §40) — SudokuEngine.rollbackLastMove() mutates the board directly
   * rather than going through setCell/clearCell.
   *
   * Re-runs the exact same completion-then-dead-end evaluation as every
   * other mutation (updatePuzzleState) — no separate recovery algorithm
   * (spec §11). This is what correctly handles both "one Trace Back was
   * enough" and "the dead end remains, keep going" (spec §13): each
   * call is a fresh scan of current board state, not a decrement of
   * some assumed-fixed number of required rollbacks.
   */
  traceBack(): void {
    const record = this.engine.rollbackLastMove();
    if (!record) return;
    this.traceBackCount++;
    this.currentBoard = engineToBoardConfig(this.engine);
    this.bus.emit("move:rolledback", { row: record.row, col: record.col });
    this.updatePuzzleState();
  }

  /** Run after every successful placement/clear/rollback (never on
   * rejected attempts, and never inside a render loop — see Build 03
   * spec §10). Order matters (Build 03 spec §21): completion is checked
   * FIRST, so a valid full solution is never misclassified as a dead
   * end. Only when the board is incomplete does this run the Dead End
   * detector, which itself only ever asks the existing CandidateManager
   * about the CURRENT board — never the hidden solution (Build 03 spec
   * §6). Always emits "puzzle:status" (even for the in-progress branch)
   * so a Trace Back that resolves a dead end is reliably reflected by
   * every subscriber — Build 03 only needed the event on entering
   * complete/dead-end, but Build 04 also needs to know when LEAVING
   * dead-end via rollback. */
  private updatePuzzleState(): void {
    if (this.engine.isComplete()) {
      this.puzzleStatus = this.engine.matchesSolution() ? "complete-valid" : "complete-invalid";
      this.deadEndCells = [];
      this.deadEndDetectedAtMove = null;
      if (this.puzzleStatus === "complete-valid") this.finalizeResult();
      this.bus.emit("puzzle:status", { status: this.puzzleStatus });
      return;
    }

    const wasDeadEnd = this.puzzleStatus === "dead-end";
    const deadEnd = DeadEndDetector.detect(this.engine);
    if (deadEnd.isDeadEnd) {
      this.puzzleStatus = "dead-end";
      this.deadEndCells = deadEnd.cellsWithoutCandidates;
      this.deadEndDetectedAtMove = this.engine.getMoveCount();
      // Count once per distinct dead-end EVENT, not once per Trace Back
      // spent resolving it — see the confirmedMistakes field doc above.
      if (!wasDeadEnd) this.confirmedMistakes++;
    } else {
      this.puzzleStatus = "in-progress";
      this.deadEndCells = [];
      this.deadEndDetectedAtMove = null;
    }
    this.bus.emit("puzzle:status", { status: this.puzzleStatus });
  }

  /** Builds and stores the one-time GameResult for this session, and —
   * only for mode === "official" — saves it to the leaderboard and
   * personal best (ResultManager's own gate, not re-checked here).
   * Guarded to run at most once per session (selectGrade/startChallenge
   * reset lastResult to null for the next attempt). Emits "result:ready"
   * so the presentation layer can navigate to the results screen. */
  private finalizeResult(): void {
    if (this.lastResult) return;
    this.lastResult = buildResult({
      playerName: this.playerName || "Player",
      grade: this.playerGrade,
      gradeBand: this.gradeBand,
      mode: this.mode,
      skin: this.renderSkin,
      confirmedMistakes: this.confirmedMistakes,
      traceBackCount: this.traceBackCount,
      completed: true,
    });
    // Record the one-official-attempt lock for this player+band —
    // never for practice (matches every other persistence gate in this
    // codebase: LeaderboardManager/PersonalBestManager are official-only
    // too). recordAttempt() itself no-ops for an empty name.
    if (this.mode === "official") {
      recordAttempt(this.playerName, this.gradeBand, this.lastResult);
    }
    this.bus.emit("result:ready", { result: this.lastResult });
  }
}