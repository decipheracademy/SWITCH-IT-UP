import type { Screen } from "../Screen";
import type { GameState, PanState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";
import type { SceneManager } from "../../core/SceneManager";
import { BAND_LABELS } from "../../puzzle/mockData";
import { getSkinValues, isSkinAvailable } from "../../skins/SkinManager";
import { announce } from "../liveRegion";

/**
 * In-game HUD overlay: title/grade info, value palette, Trace Back
 * placeholder, exit control, and — only when the active board is wider
 * than the viewport can show at a readable size — a mobile pan
 * controller (see three/CameraManager.ts for why panning exists instead
 * of shrinking cells).
 */
export class GameHUD implements Screen {
  private el: HTMLElement | null = null;
  private unsubscribers: Array<() => void> = [];
  private gameState: GameState;
  private audio: AudioManager;
  private sceneManager: SceneManager;

  private trackPointerId: number | null = null;

  constructor(gameState: GameState, audio: AudioManager, sceneManager: SceneManager) {
    this.gameState = gameState;
    this.audio = audio;
    this.sceneManager = sceneManager;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen game-hud";
    el.innerHTML = `
      <div class="hud-top">
        <div class="hud-brand">LOGIC GRID</div>
        <div class="hud-band"></div>
        <div class="hud-mode"></div>
        <div class="skin-selector">
          <button class="skin-btn" data-skin="number">123</button>
          <button class="skin-btn" data-skin="letter">ABC</button>
          <button class="skin-btn" data-skin="symbol">●▲■</button>
        </div>
        <div class="hud-stats">
          <span class="hud-stat">MISTAKES: <strong class="hud-stat-mistakes">0</strong></span>
          <span class="hud-stat">TRACE BACKS: <strong class="hud-stat-tracebacks">0</strong></span>
        </div>
        <div class="hud-player"></div>
        <button class="btn btn-ghost hud-exit" data-action="exit" aria-label="Exit to grade selection">EXIT</button>
      </div>
      <div class="dead-end-banner" hidden role="status">
        <span class="dead-end-title">DEAD END</span>
        <span class="dead-end-message">No legal value remains for this cell. Review your recent decisions.</span>
      </div>
      <div class="complete-invalid-banner" hidden role="status">
        <span class="dead-end-title">GRID FULL</span>
        <span class="dead-end-message">Some placements may need review. Use Trace Back or Clear to continue.</span>
      </div>
      <div class="hud-bottom">
        <div class="pan-controller" hidden>
          <button class="pan-btn" data-action="pan-left" aria-label="Pan board left">‹</button>
          <div class="pan-track">
            <div class="pan-thumb"></div>
          </div>
          <button class="pan-btn" data-action="pan-right" aria-label="Pan board right">›</button>
        </div>
        <div class="hud-bottom-row">
          <div class="palette" role="group" aria-label="Value palette"></div>
          <button class="btn btn-ghost" data-action="clear" aria-label="Clear selected cell">CLEAR</button>
          <button class="btn btn-traceback" data-action="traceback" aria-label="Trace back one move">
            <span class="traceback-icon">↺</span> TRACE BACK
          </button>
        </div>
      </div>
      <div class="confirm-modal-overlay" hidden>
        <div class="confirm-modal" role="alertdialog" aria-labelledby="leave-modal-title" aria-describedby="leave-modal-message">
          <p class="confirm-modal-title" id="leave-modal-title">LEAVE CHALLENGE?</p>
          <p class="confirm-modal-message" id="leave-modal-message">Your current official attempt will not be completed.</p>
          <div class="confirm-modal-actions">
            <button class="btn btn-secondary" data-action="stay">STAY</button>
            <button class="btn btn-ghost" data-action="leave">LEAVE</button>
          </div>
        </div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    this.renderDynamic();
    this.renderPanState(this.sceneManager.cameraManager.getPanState());

    el.querySelector('[data-action="exit"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      const sessionActive =
        this.gameState.mode === "official" &&
        this.gameState.puzzleStatus !== "complete-valid" &&
        this.gameState.puzzleStatus !== "complete-invalid";
      if (sessionActive) {
        this.setLeaveModalVisible(true);
      } else {
        this.gameState.goTo("grade-select");
      }
    });

    el.querySelector('[data-action="stay"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.setLeaveModalVisible(false);
    });
    el.querySelector('[data-action="leave"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.setLeaveModalVisible(false);
      this.gameState.goTo("grade-select");
    });

    el.querySelector('[data-action="traceback"]')?.addEventListener("click", (e) => {
      if (!this.gameState.canTraceBack()) return;
      this.audio.play("traceback");
      this.gameState.traceBack();
      const btn = e.currentTarget as HTMLButtonElement;
      btn.classList.add("pulse");
      window.setTimeout(() => btn.classList.remove("pulse"), 400);
    });

    el.querySelector('[data-action="clear"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.clearSelectedCell();
    });

    el.querySelectorAll<HTMLButtonElement>(".skin-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        this.audio.play("button-click");
        this.gameState.setSkin(btn.dataset.skin as "number" | "letter" | "symbol");
        this.renderDynamic();
      });
    });

    this.setupPanControls(el);

    this.unsubscribers.push(
      this.gameState.bus.on("grade:selected", () => this.renderDynamic()),
      this.gameState.bus.on("cell:select", (cell) => {
        this.renderDynamic();
        if (cell) {
          const cellData = this.gameState.currentBoard.cells[cell.row][cell.col];
          const displayValues = getSkinValues(
            this.gameState.currentBoard.band,
            this.gameState.currentBoard.size,
            this.gameState.renderSkin
          );
          const desc =
            cellData.value !== null
              ? `Player value ${displayValues[cellData.value - 1]}.`
              : "Empty. Select a value.";
          announce(`Row ${cell.row + 1} column ${cell.col + 1}. ${desc}`);
        }
      }),
      this.gameState.bus.on("value:pick", () => this.renderDynamic()),
      this.gameState.bus.on("move:rolledback", () => {
        this.renderDynamic();
        announce("Previous move restored.");
      }),
      this.gameState.bus.on("puzzle:status", ({ status }) => {
        if (status === "dead-end") {
          this.audio.play("dead-end");
          announce("Dead End reached. No legal value remains for a cell. Use Trace Back to review your recent moves.", true);
        } else if (status === "in-progress" && this.lastAnnouncedStatus === "dead-end") {
          announce("Path restored. You may continue.");
        } else if (status === "complete-valid") {
          announce("Puzzle completed. Your result is ready.");
        }
        this.lastAnnouncedStatus = status;
        this.renderDynamic();
      }),
      this.gameState.bus.on("result:ready", () => {
        this.gameState.goTo("results");
      }),
      this.gameState.bus.on("camera:pan", (state) => this.renderPanState(state))
    );

    document.addEventListener("keydown", this.handleModalEscape);
  }

  private lastAnnouncedStatus: string = "in-progress";

  private handleModalEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    const overlay = this.el?.querySelector<HTMLElement>(".confirm-modal-overlay");
    if (overlay && !overlay.hidden) this.setLeaveModalVisible(false);
  };

  private setLeaveModalVisible(visible: boolean): void {
    const overlay = this.el?.querySelector<HTMLElement>(".confirm-modal-overlay");
    if (!overlay) return;
    overlay.hidden = !visible;
    if (visible) {
      overlay.querySelector<HTMLButtonElement>('[data-action="stay"]')?.focus();
    }
  }

  private setupPanControls(el: HTMLElement): void {
    const step = () => Math.max(this.sceneManager.cameraManager.getPanRange() * 0.6, 0.3);

    el.querySelector('[data-action="pan-left"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.sceneManager.panCameraTo(this.sceneManager.cameraManager.getPanX() - step());
    });
    el.querySelector('[data-action="pan-right"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.sceneManager.panCameraTo(this.sceneManager.cameraManager.getPanX() + step());
    });

    const track = el.querySelector<HTMLElement>(".pan-track");
    if (!track) return;

    const setPanFromClientX = (clientX: number) => {
      const range = this.sceneManager.cameraManager.getPanRange();
      if (range <= 0) return;
      const rect = track.getBoundingClientRect();
      const frac = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const target = -range + frac * 2 * range;
      this.sceneManager.panCameraAbsolute(target);
    };

    track.addEventListener("pointerdown", (event) => {
      this.trackPointerId = event.pointerId;
      track.setPointerCapture(event.pointerId);
      setPanFromClientX(event.clientX);
    });
    track.addEventListener("pointermove", (event) => {
      if (this.trackPointerId !== event.pointerId) return;
      setPanFromClientX(event.clientX);
    });
    const releaseTrack = (event: PointerEvent) => {
      if (this.trackPointerId !== event.pointerId) return;
      if (track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
      this.trackPointerId = null;
    };
    track.addEventListener("pointerup", releaseTrack);
    track.addEventListener("pointercancel", releaseTrack);
  }

  private renderPanState(state: PanState): void {
    if (!this.el) return;
    const controller = this.el.querySelector<HTMLElement>(".pan-controller");
    if (!controller) return;
    controller.hidden = !state.enabled;
    if (!state.enabled) return;

    const thumb = controller.querySelector<HTMLElement>(".pan-thumb");
    const leftBtn = controller.querySelector<HTMLButtonElement>('[data-action="pan-left"]');
    const rightBtn = controller.querySelector<HTMLButtonElement>('[data-action="pan-right"]');
    const frac = state.range > 0 ? (state.x + state.range) / (2 * state.range) : 0.5;
    if (thumb) thumb.style.left = `${frac * 100}%`;
    if (leftBtn) leftBtn.disabled = state.x <= -state.range + 0.01;
    if (rightBtn) rightBtn.disabled = state.x >= state.range - 0.01;
  }

  private renderDynamic(): void {
    if (!this.el) return;
    const info = BAND_LABELS[this.gameState.gradeBand];
    const bandEl = this.el.querySelector(".hud-band");
    if (bandEl) bandEl.textContent = `GRADE ${this.gameState.playerGrade} · ${info.size}`;

    const modeEl = this.el.querySelector(".hud-mode");
    if (modeEl) modeEl.textContent = this.gameState.mode === "official" ? "OFFICIAL" : "PRACTICE";

    const board = this.gameState.currentBoard;
    const skinNames: Record<string, string> = { number: "Number", letter: "Letter", symbol: "Symbol" };
    this.el.querySelectorAll<HTMLButtonElement>(".skin-btn").forEach((btn) => {
      const skin = btn.dataset.skin as "number" | "letter" | "symbol";
      const available = isSkinAvailable(board.band, skin);
      btn.disabled = !available;
      btn.classList.toggle("skin-btn-active", this.gameState.renderSkin === skin);
      btn.setAttribute(
        "aria-label",
        available
          ? `${skinNames[skin]} display${this.gameState.renderSkin === skin ? " (selected)" : ""}`
          : `${skinNames[skin]} display — not available for this grade`
      );
      btn.title = available ? "" : "Not available for this grade";
    });

    const mistakesEl = this.el.querySelector(".hud-stat-mistakes");
    if (mistakesEl) mistakesEl.textContent = String(this.gameState.confirmedMistakes);
    const tracebacksEl = this.el.querySelector(".hud-stat-tracebacks");
    if (tracebacksEl) tracebacksEl.textContent = String(this.gameState.traceBackCount);

    const playerEl = this.el.querySelector(".hud-player");
    if (playerEl) {
      playerEl.textContent = this.gameState.playerName
        ? this.gameState.playerName.toUpperCase()
        : "GUEST";
    }

    const isDeadEnd = this.gameState.puzzleStatus === "dead-end";
    const isCompleteInvalid = this.gameState.puzzleStatus === "complete-invalid";
    const banner = this.el.querySelector<HTMLElement>(".dead-end-banner");
    if (banner) banner.hidden = !isDeadEnd;
    const invalidBanner = this.el.querySelector<HTMLElement>(".complete-invalid-banner");
    if (invalidBanner) invalidBanner.hidden = !isCompleteInvalid;

    const clearBtn = this.el.querySelector<HTMLButtonElement>('[data-action="clear"]');
    if (clearBtn) clearBtn.disabled = isDeadEnd;

    // Trace Back stays enabled during a dead end (it's the one action
    // still allowed — Build 04 spec §10/§18/§23) and is only ever
    // disabled when there's genuinely nothing to roll back.
    const tracebackBtn = this.el.querySelector<HTMLButtonElement>('[data-action="traceback"]');
    if (tracebackBtn) tracebackBtn.disabled = !this.gameState.canTraceBack();

    const paletteEl = this.el.querySelector(".palette");
    if (paletteEl) {
      const hasSelection = !!this.gameState.selectedCell;
      const board = this.gameState.currentBoard;
      const displayValues = getSkinValues(board.band, board.size, this.gameState.renderSkin);
      paletteEl.innerHTML = board.values
        .map((v, i) => {
          // Disabling here reflects STRUCTURAL legality only (row/
          // column/box/diagonal against the current board) — never
          // whether v matches the hidden solution, and never a hint
          // toward the correct one. See Build 02 spec §18/§4 and Build
          // 05 spec §4: a locally legal value must always remain
          // offered, styled identically to every other legal value —
          // no glow, no highlight distinguishes it from the rest. Once
          // a Dead End is active, every value is disabled — normal
          // input is locked until Trace Back (Build 03 spec §17).
          const disabled = isDeadEnd || !hasSelection || !this.gameState.isValueAllowedForSelection(v);
          return `<button class="value-btn" data-value="${v}" aria-label="Place value ${displayValues[i]}" ${disabled ? "disabled" : ""}>${displayValues[i]}</button>`;
        })
        .join("");
      paletteEl.querySelectorAll<HTMLButtonElement>(".value-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const value = Number(btn.dataset.value);
          this.audio.play("placement");
          this.gameState.placeValue(value);
        });
      });
    }
  }

  unmount(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];
    document.removeEventListener("keydown", this.handleModalEscape);
    this.el?.remove();
    this.el = null;
  }
}
