import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";

export class HowToPlayScreen implements Screen {
  private el: HTMLElement | null = null;
  private gameState: GameState;
  private audio: AudioManager;

  constructor(gameState: GameState, audio: AudioManager) {
    this.gameState = gameState;
    this.audio = audio;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen how-to-play-screen";
    el.innerHTML = `
      <div class="panel">
        <p class="eyebrow">CONCEPT OVERVIEW</p>
        <h2 class="section-title">How Logic Grid Works</h2>
        <ol class="concept-steps">
          <li><span class="step-index">01</span> Select a cell on the grid.</li>
          <li><span class="step-index">02</span> Choose a value from the palette to place it.</li>
          <li><span class="step-index">03</span> There is no immediate right-or-wrong signal — keep reasoning forward.</li>
          <li><span class="step-index">04</span> If a later cell runs out of legal values, that's a Dead End.</li>
          <li><span class="step-index">05</span> Use Trace Back to step through recent moves and find the earlier mistake.</li>
        </ol>
        <p class="concept-note">
          This screen introduces the concept only. The full reasoning engine —
          legality checking, Dead End detection, and real Trace Back — arrives
          in later builds.
        </p>
        <button class="btn btn-secondary" data-action="back">BACK</button>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    el.querySelector('[data-action="back"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo("home");
    });
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
