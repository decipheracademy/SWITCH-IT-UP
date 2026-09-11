import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";

export class HomeScreen implements Screen {
  private el: HTMLElement | null = null;
  private gameState: GameState;
  private audio: AudioManager;

  constructor(gameState: GameState, audio: AudioManager) {
    this.gameState = gameState;
    this.audio = audio;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen home-screen";
    el.innerHTML = `
      <div class="panel home-panel">
        <p class="eyebrow">SKILL CHALLENGE FRIDAY · SWITCH IT UP</p>
        <h1 class="brand-title large">LOGIC GRID</h1>
        <p class="brand-subtitle">THE DELAYED-CONSEQUENCE SUDOKU PUZZLE</p>
        <p class="home-tagline">Place with confidence. Consequences arrive later.</p>
        <div class="home-actions">
          <button class="btn btn-primary" data-action="start">START</button>
          <button class="btn btn-secondary" data-action="how-to-play">HOW TO PLAY</button>
        </div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    el.querySelector('[data-action="start"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo("player-setup");
    });
    el.querySelector('[data-action="how-to-play"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo("how-to-play");
    });
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
