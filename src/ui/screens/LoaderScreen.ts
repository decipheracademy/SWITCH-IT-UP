import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";

export class LoaderScreen implements Screen {
  private el: HTMLElement | null = null;
  private timeoutId: number | null = null;
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen loader-screen";
    el.innerHTML = `
      <div class="loader-scan"></div>
      <div class="loader-content">
        <div class="loader-ring"></div>
        <h1 class="brand-title">LOGIC GRID</h1>
        <p class="brand-subtitle">THE DELAYED-CONSEQUENCE SUDOKU PUZZLE</p>
        <div class="loader-bar"><div class="loader-bar-fill"></div></div>
        <p class="loader-status">Initializing reasoning engine…</p>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    this.timeoutId = window.setTimeout(() => {
      this.gameState.goTo("home");
    }, 2200);
  }

  unmount(): void {
    if (this.timeoutId !== null) window.clearTimeout(this.timeoutId);
    this.el?.remove();
    this.el = null;
  }
}
