import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";

const STEPS = ["3", "2", "1", "GO!"];
const STEP_DURATION_MS = 700;

export class CountdownScreen implements Screen {
  private el: HTMLElement | null = null;
  private gameState: GameState;
  private audio: AudioManager;
  private timeoutIds: number[] = [];

  constructor(gameState: GameState, audio: AudioManager) {
    this.gameState = gameState;
    this.audio = audio;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen countdown-screen";
    el.innerHTML = `
      <div class="countdown-content">
        <p class="eyebrow">GRADE ${this.gameState.playerGrade}</p>
        <div class="countdown-number" role="status" aria-live="assertive">${STEPS[0]}</div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    const numberEl = el.querySelector<HTMLElement>(".countdown-number")!;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    STEPS.forEach((label, i) => {
      const id = window.setTimeout(
        () => {
          numberEl.textContent = label;
          if (!reduceMotion) {
            numberEl.classList.remove("countdown-pulse");
            void numberEl.offsetWidth;
            numberEl.classList.add("countdown-pulse");
          }
          this.audio.play(label === "GO!" ? "completion" : "select");
        },
        i * STEP_DURATION_MS
      );
      this.timeoutIds.push(id);
    });

    const finishId = window.setTimeout(() => {
      this.gameState.goTo("game");
    }, STEPS.length * STEP_DURATION_MS);
    this.timeoutIds.push(finishId);
  }

  unmount(): void {
    this.timeoutIds.forEach((id) => window.clearTimeout(id));
    this.timeoutIds = [];
    this.el?.remove();
    this.el = null;
  }
}
