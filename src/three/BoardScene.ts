import * as THREE from "three";
import type { BoardConfig, CellState } from "../puzzle/types";
import { GameState } from "../core/GameState";
import { PALETTE } from "./palette";
import { getGlyphTexture } from "./glyphTexture";
import { getSkinValue } from "../skins/SkinManager";

// Cells are a FIXED physical size regardless of board size (per the
// mobile responsiveness correction: readability takes priority over
// forcing the whole board to fit — a 9x9 board is simply wider, and
// the camera pans to reveal it on narrow viewports rather than
// shrinking cells/digits). Board footprint = boardSize * FIXED_CELL_SIZE.
const FIXED_CELL_SIZE = 1.0;
const CELL_THICKNESS = 0.12;
const GIVEN_TEXT_COLOR = "#F5FBFF";
const PLAYER_TEXT_COLOR = "#18D9FF";

// Vertical layering above the cell top surface (CELL_TOP), smallest to
// largest, chosen so nothing intersects or occludes anything above it:
// cell surface < grid lines < glyph (value) < selection ring.
const CELL_TOP = CELL_THICKNESS / 2;
const GRID_LINE_Y = CELL_TOP + 0.006;
const GLYPH_Y = CELL_TOP + 0.014;
const SELECTION_RING_Y = CELL_TOP + 0.022;

interface CellVisual {
  row: number;
  col: number;
  mesh: THREE.Mesh;
  glyph: THREE.Mesh | null;
  material: THREE.MeshStandardMaterial;
}

/**
 * Renders the puzzle board as real Three.js geometry (per Project
 * Foundation §12/§15 — not an HTML table over a background).
 *
 * BoardScene only knows about BoardConfig/CellData (see src/puzzle/types.ts)
 * and GameState's selection/hover fields. It has no idea whether that
 * data came from mock data (Build 01) or a real Sudoku engine (Build 02+),
 * which is the separation the Project Foundation requires.
 */
export class BoardScene {
  private scene: THREE.Scene;
  private gameState: GameState;
  private group: THREE.Group;
  private cellVisuals: CellVisual[] = [];
  private selectionRing: THREE.Mesh;
  private deadEndVisuals: CellVisual[] = [];
  private cellSize = FIXED_CELL_SIZE;
  private boardWidth = FIXED_CELL_SIZE * 3;
  private unsubscribers: Array<() => void> = [];
  private clock = { elapsed: 0 };

  constructor(scene: THREE.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.selectionRing = this.buildSelectionRing();
    this.group.add(this.selectionRing);
    this.selectionRing.visible = false;

    this.buildBoard(gameState.currentBoard);

    this.unsubscribers.push(
      gameState.bus.on("board:rebuilt", ({ board }) => this.buildBoard(board)),
      gameState.bus.on("cell:select", () => this.refreshStates()),
      gameState.bus.on("cell:hover", () => this.refreshStates()),
      // Only the single mutated cell needs its glyph touched — not a
      // full board rebuild (Build 06 spec §55: "Palette interaction
      // should not rebuild the board"). placeValue/clearSelectedCell
      // both always act on the currently selected cell.
      gameState.bus.on("value:pick", () => {
        const sel = this.gameState.selectedCell;
        if (sel) this.updateCellGlyph(sel.row, sel.col);
        this.refreshStates();
      }),
      gameState.bus.on("move:rolledback", ({ row, col }) => {
        this.updateCellGlyph(row, col);
        this.refreshStates();
      }),
      gameState.bus.on("puzzle:status", () => this.refreshStates()),
      // A skin change redraws every existing glyph's TEXTURE in place
      // (same geometry/material objects, new canvas texture) rather
      // than rebuilding the board — the puzzle state hasn't changed at
      // all, only how values are displayed.
      gameState.bus.on("skin:changed", () => this.refreshAllGlyphTextures())
    );
  }

  /** Shows/hides the entire board group. Used so the board (and its
   * ambient environment) can stay mounted while DOM menu screens are
   * shown on top, without tearing down and rebuilding Three.js state
   * on every navigation. */
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** The board's actual world-space width/depth (boardSize * fixed cell
   * size). CameraManager uses this to decide whether the board fits the
   * viewport or needs mobile panning — read after "board:rebuilt" has
   * fired so it reflects the just-built board. */
  getBoardWidth(): number {
    return this.boardWidth;
  }

  /** Exposes cell meshes for raycasting from InputManager without
   * leaking internal visual state. */
  getPickableMeshes(): THREE.Mesh[] {
    return this.cellVisuals.map((c) => c.mesh);
  }

  getCellCoordsForMesh(mesh: THREE.Object3D): { row: number; col: number } | null {
    const found = this.cellVisuals.find((c) => c.mesh === mesh);
    return found ? { row: found.row, col: found.col } : null;
  }

  private buildSelectionRing(): THREE.Mesh {
    const geo = new THREE.RingGeometry(0.42, 0.5, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: PALETTE.cyan,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = SELECTION_RING_Y;
    return ring;
  }

  private clearBoard(): void {
    for (const cell of this.cellVisuals) {
      cell.mesh.geometry.dispose();
      cell.material.dispose();
      if (cell.glyph) {
        (cell.glyph.material as THREE.MeshBasicMaterial).dispose();
        this.group.remove(cell.glyph);
      }
      this.group.remove(cell.mesh);
    }
    this.cellVisuals = [];
    this.deadEndVisuals = [];
    if (this.glyphGeometry) {
      this.glyphGeometry.dispose();
      this.glyphGeometry = null;
    }
  }

  private glyphGeometry: THREE.PlaneGeometry | null = null;

  private buildBoard(board: BoardConfig): void {
    this.clearBoard();
    const n = board.size;
    this.cellSize = FIXED_CELL_SIZE;
    this.boardWidth = n * this.cellSize;
    const offset = (this.boardWidth - this.cellSize) / 2;

    const geometry = new THREE.BoxGeometry(
      this.cellSize * 0.92,
      CELL_THICKNESS,
      this.cellSize * 0.92
    );

    // Shared glyph plane — fixed size (cells are now a fixed physical
    // size regardless of board), deliberately smaller than the cell
    // footprint so a value never reaches the cell edge or grid lines.
    const glyphSize = this.cellSize * 0.52;
    this.glyphGeometry = new THREE.PlaneGeometry(glyphSize, glyphSize);

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const cellData = board.cells[row][col];
        const material = new THREE.MeshStandardMaterial({
          color: PALETTE.background,
          emissive: PALETTE.blue,
          emissiveIntensity: 0.08,
          roughness: 0.35,
          metalness: 0.4,
          transparent: true,
          opacity: 0.92,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(col * this.cellSize - offset, 0, row * this.cellSize - offset);
        mesh.userData = { row, col };
        this.group.add(mesh);

        let glyph: THREE.Mesh | null = null;
        if (cellData.value !== null) {
          const display = getSkinValue(board.band, board.size, this.gameState.renderSkin, cellData.value);
          glyph = this.buildGlyph(display, cellData.isGiven, this.glyphGeometry);
          glyph.position.set(mesh.position.x, GLYPH_Y, mesh.position.z);
          this.group.add(glyph);
        }

        this.cellVisuals.push({ row, col, mesh, glyph, material });
      }
    }

    this.buildGridLines(board);
    this.refreshStates();
  }

  private buildGlyph(
    display: string,
    isGiven: boolean,
    geometry: THREE.PlaneGeometry
  ): THREE.Mesh {
    const texture = getGlyphTexture(
      display,
      isGiven ? GIVEN_TEXT_COLOR : PLAYER_TEXT_COLOR
    );
    // MeshBasicMaterial (unlit) keeps the glyph crisp and legible
    // regardless of the scene's holographic lighting. depthWrite is off
    // so the transparent plane never fights the cell surface beneath it
    // for the depth buffer, while depthTest keeps it correctly ordered
    // relative to other real geometry.
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    // Flat mesh (not a Sprite) so rotation actually orients it flush
    // with the board surface instead of billboarding toward the camera
    // and sinking into the cell geometry — this was the source of the
    // clipped/obscured digits.
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  private gridLineGroup: THREE.LineSegments | null = null;

  private buildGridLines(board: BoardConfig): void {
    if (this.gridLineGroup) {
      this.gridLineGroup.geometry.dispose();
      (this.gridLineGroup.material as THREE.Material).dispose();
      this.group.remove(this.gridLineGroup);
    }

    const n = board.size;
    const offset = (this.boardWidth - this.cellSize) / 2;
    const half = this.boardWidth / 2;
    const y = GRID_LINE_Y;
    const points: number[] = [];
    const colors: number[] = [];

    const thin = new THREE.Color(PALETTE.blue);
    const thick = new THREE.Color(PALETTE.cyan);

    const pushLine = (
      x1: number,
      z1: number,
      x2: number,
      z2: number,
      color: THREE.Color
    ) => {
      points.push(x1, y, z1, x2, y, z2);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    };

    for (let i = 0; i <= n; i++) {
      const pos = i * this.cellSize - offset - this.cellSize / 2;
      const isColBoundary = i % board.box.boxWidth === 0;
      const isRowBoundary = i % board.box.boxHeight === 0;
      // Vertical line (runs along z, marks a column boundary at x = pos)
      pushLine(pos, -half, pos, half, isColBoundary ? thick : thin);
      // Horizontal line (runs along x, marks a row boundary at z = pos)
      pushLine(-half, pos, half, pos, isRowBoundary ? thick : thin);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
    });
    this.gridLineGroup = new THREE.LineSegments(geo, mat);
    this.group.add(this.gridLineGroup);
  }

  /** Rebuilds just one cell's glyph (added/removed/changed value) in
   * place — the cell's box mesh, material, and position are untouched.
   * Used after a single placement/clear/rollback instead of rebuilding
   * the whole board (Build 06 spec §55). */
  private updateCellGlyph(row: number, col: number): void {
    const cellVisual = this.cellVisuals.find((c) => c.row === row && c.col === col);
    if (!cellVisual || !this.glyphGeometry) return;
    const board = this.gameState.currentBoard;
    const cellData = board.cells[row]?.[col];
    if (!cellData) return;

    if (cellVisual.glyph) {
      (cellVisual.glyph.material as THREE.MeshBasicMaterial).dispose();
      this.group.remove(cellVisual.glyph);
      cellVisual.glyph = null;
    }

    if (cellData.value !== null) {
      const display = getSkinValue(board.band, board.size, this.gameState.renderSkin, cellData.value);
      const glyph = this.buildGlyph(display, cellData.isGiven, this.glyphGeometry);
      glyph.position.set(cellVisual.mesh.position.x, GLYPH_Y, cellVisual.mesh.position.z);
      this.group.add(glyph);
      cellVisual.glyph = glyph;
    }
  }

  /** Swaps every existing glyph's texture in place for a skin change —
   * same meshes/materials, just a different canvas texture drawn with
   * the new display string. No geometry is created or destroyed. */
  private refreshAllGlyphTextures(): void {
    const board = this.gameState.currentBoard;
    for (const cell of this.cellVisuals) {
      if (!cell.glyph) continue;
      const cellData = board.cells[cell.row][cell.col];
      if (cellData.value === null) continue;
      const display = getSkinValue(board.band, board.size, this.gameState.renderSkin, cellData.value);
      const texture = getGlyphTexture(display, cellData.isGiven ? GIVEN_TEXT_COLOR : PLAYER_TEXT_COLOR);
      const material = cell.glyph.material as THREE.MeshBasicMaterial;
      material.map = texture;
      material.needsUpdate = true;
    }
  }

  private computeState(row: number, col: number, board: BoardConfig): CellState {
    const selected = this.gameState.selectedCell;
    const hovered = this.gameState.hoveredCell;
    const cellData = board.cells[row][col];

    if (selected && selected.row === row && selected.col === col) return "selected";

    // Dead End cells (Build 03): a warning that the current path is
    // impossible, checked before "given"/"related" so it's never
    // silently absorbed by another state — but still subordinate to
    // "selected" above, per the established hierarchy (selected must
    // always read as the strongest signal). Dead-end cells are always
    // empty/editable (only empty cells can have zero candidates), so
    // this never actually collides with "given".
    if (
      this.gameState.puzzleStatus === "dead-end" &&
      this.gameState.deadEndCells.some((c) => c.row === row && c.col === col)
    ) {
      return "dead-end";
    }

    if (cellData.isGiven) return "given";

    if (selected) {
      const sameRow = selected.row === row;
      const sameCol = selected.col === col;
      const sameBox =
        Math.floor(row / board.constraintBox.boxHeight) === Math.floor(selected.row / board.constraintBox.boxHeight) &&
        Math.floor(col / board.constraintBox.boxWidth) === Math.floor(selected.col / board.constraintBox.boxWidth);
      if (sameRow || sameCol || sameBox) return "related";
    }

    if (hovered && hovered.row === row && hovered.col === col) return "hover";

    return cellData.value !== null ? "player-filled" : "empty";
  }

  private refreshStates(): void {
    const board = this.gameState.currentBoard;
    let selectedVisual: CellVisual | null = null;
    const deadEndVisuals: CellVisual[] = [];

    for (const cell of this.cellVisuals) {
      const state = this.computeState(cell.row, cell.col, board);
      this.applyStateStyle(cell, state);
      if (state === "selected") selectedVisual = cell;
      if (state === "dead-end") deadEndVisuals.push(cell);
    }
    this.deadEndVisuals = deadEndVisuals;

    if (selectedVisual) {
      this.selectionRing.visible = true;
      this.selectionRing.position.x = selectedVisual.mesh.position.x;
      this.selectionRing.position.z = selectedVisual.mesh.position.z;
      this.selectionRing.scale.set(1, 1, 1);
    } else {
      this.selectionRing.visible = false;
    }
  }

  private applyStateStyle(cell: CellVisual, state: CellState): void {
    const mat = cell.material;
    switch (state) {
      case "selected":
        mat.emissive.setHex(PALETTE.cyan);
        mat.emissiveIntensity = 0.55;
        mat.color.setHex(PALETTE.background);
        break;
      case "related":
        mat.emissive.setHex(PALETTE.blue);
        mat.emissiveIntensity = 0.28;
        mat.color.setHex(PALETTE.background);
        break;
      case "hover":
        mat.emissive.setHex(PALETTE.cyan);
        mat.emissiveIntensity = 0.35;
        mat.color.setHex(PALETTE.background);
        break;
      case "given":
        mat.emissive.setHex(PALETTE.purple);
        mat.emissiveIntensity = 0.16;
        mat.color.setHex(PALETTE.background);
        break;
      case "player-filled":
        mat.emissive.setHex(PALETTE.blue);
        mat.emissiveIntensity = 0.12;
        mat.color.setHex(PALETTE.background);
        break;
      case "dead-end":
        // Restrained orange warning per Build 03 spec §15 — never red,
        // never a full-screen effect, just this cell reading as
        // "something is impossible here" (not "this is your mistake").
        mat.emissive.setHex(PALETTE.orange);
        mat.emissiveIntensity = 0.3;
        mat.color.setHex(PALETTE.background);
        break;
      case "disabled":
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.color.setHex(0x0a0a0a);
        break;
      case "empty":
      case "default":
      default:
        mat.emissive.setHex(PALETTE.blue);
        mat.emissiveIntensity = 0.08;
        mat.color.setHex(PALETTE.background);
        break;
    }
  }

  update(_delta: number, elapsed: number): void {
    this.clock.elapsed = elapsed;
    // Gentle float + selection pulse — restrained per visual direction.
    this.group.position.y = Math.sin(elapsed * 0.6) * 0.03;
    if (this.selectionRing.visible) {
      const pulse = 1 + Math.sin(elapsed * 4) * 0.06;
      this.selectionRing.scale.set(pulse, pulse, 1);
    }
    // Subtle Dead End warning pulse (Build 03 spec §15/§16) — restrained
    // intensity oscillation, no color change, no flashing.
    if (this.deadEndVisuals.length > 0) {
      const intensity = 0.3 + Math.sin(elapsed * 3) * 0.1;
      for (const cell of this.deadEndVisuals) {
        cell.material.emissiveIntensity = intensity;
      }
    }
  }

  dispose(): void {
    this.unsubscribers.forEach((u) => u());
    this.clearBoard();
    if (this.gridLineGroup) {
      this.gridLineGroup.geometry.dispose();
      (this.gridLineGroup.material as THREE.Material).dispose();
    }
    this.selectionRing.geometry.dispose();
    (this.selectionRing.material as THREE.Material).dispose();
    this.scene.remove(this.group);
  }
}
