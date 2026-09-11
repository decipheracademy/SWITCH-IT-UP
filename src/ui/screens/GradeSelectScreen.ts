import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";
import { ALL_GRADES, BAND_LABELS, GRADE_TO_BAND } from "../../puzzle/mockData";
import type { PlayerGrade } from "../../puzzle/types";
import { getRecordedAttempt } from "../../competition/AttemptManager";

export class GradeSelectScreen implements Screen {
  private el: HTMLElement | null = null;
  private gameState: GameState;
  private audio: AudioManager;

  constructor(gameState: GameState, audio: AudioManager) {
    this.gameState = gameState;
    this.audio = audio;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen grade-select-screen";

    const cards = ALL_GRADES.map((grade) => {
      const band = GRADE_TO_BAND[grade];
      const size = BAND_LABELS[band].size;
      return `
        <button class="grade-card" data-grade="${grade}">
          <span class="grade-title">GRADE ${grade}</span>
          <span class="grade-size">${size}</span>
        </button>
      `;
    }).join("");

    el.innerHTML = `
      <div class="panel grade-panel">
        <p class="eyebrow">SELECT YOUR GRADE</p>
        <h2 class="section-title">Choose Your Challenge</h2>
        <div class="grade-grid">${cards}</div>
        <p class="grade-name-error" id="grade-name-error" role="alert" hidden>Please enter your name before starting a challenge.</p>
        <button class="btn btn-secondary" data-action="back">BACK</button>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    el.querySelectorAll<HTMLButtonElement>(".grade-card").forEach((card) => {
      card.addEventListener("click", () => {
        const grade = Number(card.dataset.grade) as PlayerGrade;
        const errorEl = el.querySelector<HTMLElement>("#grade-name-error");

        // Every attempt is an official, scored, one-off challenge now
        // (Mode Select was removed) — a real name is required so the
        // one-attempt-per-player lock and the leaderboard/personal best
        // have an actual identity to key off (Build 05 spec §6/§10).
        if (!this.gameState.playerName.trim()) {
          if (errorEl) errorEl.hidden = false;
          this.audio.play("warning");
          return;
        }
        if (errorEl) errorEl.hidden = true;

        this.audio.play("select");
        const band = GRADE_TO_BAND[grade];

        // One official attempt per player per grade band (Build 05 spec
        // §10, Build 06 spec §49): if this player already has a
        // recorded result for this band, show it instead of letting
        // them play again. This is a client-side, name-based check —
        // not real authentication (see AttemptManager.ts) — but it
        // matches the documented intent of preventing accidental or
        // deliberate repeat submissions.
        const existing = getRecordedAttempt(this.gameState.playerName, band);
        if (existing) {
          this.gameState.selectGrade(grade); // still loads the right board/grade context
          this.gameState.loadExistingResult(existing);
          this.gameState.goTo("results");
          return;
        }

        this.gameState.selectGrade(grade);
        this.gameState.startChallenge("official");
        this.gameState.goTo("countdown");
      });
    });

    el.querySelector('[data-action="back"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo("player-setup");
    });
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
