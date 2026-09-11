import * as THREE from "three";
import type { SceneManager } from "../core/SceneManager";
import type { GameState } from "../core/GameState";
import { computeNextSelection, ARROW_KEY_DELTAS } from "./keyboardNav";

const DRAG_THRESHOLD_PX = 10;

/**
 * Translates raw pointer/touch events on the canvas into normalized
 * board interactions (hover/select) and — when the board needs mobile
 * panning (see three/CameraManager.ts) — horizontal drag-to-pan.
 *
 * This class deliberately contains NO Sudoku rules — it only figures
 * out "which cell is under the pointer" or "how far did the pointer
 * drag" and reports that to GameState/SceneManager, which decide what
 * it means.
 *
 * Tap vs. drag: a pointerdown starts a pending gesture. If the pointer
 * moves past DRAG_THRESHOLD_PX before release, the gesture becomes a
 * pan (only while panning is enabled) and cell selection is cancelled
 * for that gesture. Otherwise, release commits a normal cell selection
 * — this is what keeps a horizontal swipe from also selecting a cell
 * it happened to pass over.
 *
 * Keyboard board navigation (arrow keys, number keys, Backspace/Delete)
 * is implemented here too — see handleKeyDown below — as a mandatory
 * accessibility requirement (Build 06 spec §19), not just a convenience.
 */
export class InputManager {
  private canvas: HTMLCanvasElement;
  private sceneManager: SceneManager;
  private gameState: GameState;
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private isTouch = false;

  private activePointerId: number | null = null;
  private isDragging = false;
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private dragStartPanX = 0;

  constructor(canvas: HTMLCanvasElement, sceneManager: SceneManager, gameState: GameState) {
    this.canvas = canvas;
    this.sceneManager = sceneManager;
    this.gameState = gameState;

    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private updateNdc(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastCell(): { row: number; col: number } | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.sceneManager.cameraManager.camera);
    const meshes = this.sceneManager.boardScene.getPickableMeshes();
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    return this.sceneManager.boardScene.getCellCoordsForMesh(hits[0].object);
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.gameState.screen !== "game") return;

    if (this.activePointerId === event.pointerId) {
      this.handleActiveDrag(event);
      return;
    }

    if (event.pointerType === "touch") {
      this.isTouch = true;
      return; // hover is a desktop-only affordance per spec
    }
    this.updateNdc(event.clientX, event.clientY);
    const cell = this.raycastCell();
    if (cell) {
      this.gameState.hoverCell(cell.row, cell.col);
    } else {
      this.gameState.hoverCell(null, null);
    }
  };

  private handleActiveDrag(event: PointerEvent): void {
    const dx = event.clientX - this.dragStartClientX;
    const dy = event.clientY - this.dragStartClientY;

    if (!this.isDragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
        return; // still within tap tolerance — wait and see
      }
      // Only treat it as a pan gesture if the movement is genuinely
      // horizontal-dominant; a mostly-vertical drag stays a non-event
      // (not a tap, not a pan) rather than fighting the user.
      if (Math.abs(dx) <= Math.abs(dy)) return;
      this.isDragging = true;
      this.gameState.hoverCell(null, null);
    }

    if (!this.sceneManager.cameraManager.isPanEnabled()) return;
    const worldPerPixel = this.sceneManager.getWorldUnitsPerPixel();
    // Dragging right reveals the board's left portion (natural
    // grab-and-drag feel), so pan position decreases as dx increases.
    const targetPanX = this.dragStartPanX - dx * worldPerPixel;
    this.sceneManager.panCameraAbsolute(targetPanX);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.gameState.screen !== "game") return;
    this.activePointerId = event.pointerId;
    this.isDragging = false;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.dragStartPanX = this.sceneManager.cameraManager.getPanX();
    this.canvas.setPointerCapture(event.pointerId);
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    const wasDragging = this.isDragging;
    this.activePointerId = null;
    this.isDragging = false;

    if (wasDragging || this.gameState.screen !== "game") return;

    // A tap (movement stayed within tolerance the whole gesture) —
    // commit a normal cell selection at the release position.
    this.updateNdc(event.clientX, event.clientY);
    const cell = this.raycastCell();
    if (cell) {
      this.gameState.selectCell(cell.row, cell.col);
    }
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    if (this.activePointerId !== event.pointerId) return;
    this.activePointerId = null;
    this.isDragging = false;
  };

  private handlePointerLeave = (): void => {
    if (!this.isTouch && this.activePointerId === null) {
      this.gameState.hoverCell(null, null);
    }
  };

  /**
   * Keyboard board navigation (Build 06 spec §19 — mandatory, not just a
   * convenience). Every action here calls the exact same GameState API
   * mouse/touch use (selectCell/placeValue/clearSelectedCell), so it's
   * impossible for a keyboard action to bypass a rule pointer input
   * couldn't also bypass (given-cell protection, structural legality,
   * the dead-end input lock — all enforced inside GameState/SudokuEngine,
   * never re-checked or duplicated here).
   *
   * Arrow keys move the selection, automatically stepping over given
   * cells (bounded by one full pass of the board, so a fully-given edge
   * case can't loop forever) rather than landing on an unselectable
   * cell and appearing to do nothing. Number keys place the
   * corresponding value; Backspace/Delete clears. Only active on the
   * game screen, and only when focus isn't inside a text field (there
   * isn't one on this screen today, but this stays correct if one is
   * ever added).
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.gameState.screen !== "game") return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

    if (event.key in ARROW_KEY_DELTAS) {
      event.preventDefault();
      const [dr, dc] = ARROW_KEY_DELTAS[event.key];
      const next = computeNextSelection(this.gameState.currentBoard, this.gameState.selectedCell, dr, dc);
      if (next) this.gameState.selectCell(next.row, next.col);
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      this.gameState.clearSelectedCell();
      return;
    }

    const value = Number(event.key);
    const size = this.gameState.currentBoard.size;
    if (Number.isInteger(value) && value >= 1 && value <= size) {
      event.preventDefault();
      this.gameState.placeValue(value);
    }
  };

  dispose(): void {
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
    window.removeEventListener("keydown", this.handleKeyDown);
  }
}
