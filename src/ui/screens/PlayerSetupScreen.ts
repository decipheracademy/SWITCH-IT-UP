import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";

export class PlayerSetupScreen implements Screen {
  private el: HTMLElement | null = null;
  private gameState: GameState;
  private audio: AudioManager;

  constructor(gameState: GameState, audio: AudioManager) {
    this.gameState = gameState;
    this.audio = audio;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen player-setup-screen";
    el.innerHTML = `
      <div class="panel">
        <p class="eyebrow">SESSION SETUP</p>
        <h2 class="section-title">Who's Playing?</h2>
        <p class="concept-note">Optional — used only for this session's display.</p>
        <input class="text-input" type="text" maxlength="24" placeholder="Enter your name" value="${this.gameState.playerName}" />
        <div class="home-actions">
          <button class="btn btn-secondary" data-action="back">BACK</button>
          <button class="btn btn-primary" data-action="continue">CONTINUE</button>
        </div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    const input = el.querySelector<HTMLInputElement>(".text-input")!;
    input.addEventListener("input", () => {
      this.gameState.setPlayerName(input.value);
    });

    el.querySelector('[data-action="back"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo("home");
    });
    el.querySelector('[data-action="continue"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.setPlayerName(input.value);
      this.gameState.goTo("grade-select");
    });
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
