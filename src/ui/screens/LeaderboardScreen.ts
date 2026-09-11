import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";
import { getLeaderboard } from "../../competition/LeaderboardManager";
import { BAND_LABELS } from "../../puzzle/mockData";

export class LeaderboardScreen implements Screen {
  private el: HTMLElement | null = null;
  private gameState: GameState;
  private audio: AudioManager;

  constructor(gameState: GameState, audio: AudioManager) {
    this.gameState = gameState;
    this.audio = audio;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen leaderboard-screen";
    const band = this.gameState.gradeBand;
    const entries = getLeaderboard(band);
    const bandLabel = BAND_LABELS[band].title;

    const currentResult = this.gameState.lastResult;
    const rows = entries.length
      ? entries
          .map((e, i) => {
            const isYou =
              !!currentResult &&
              currentResult.mode === "official" &&
              e.playerName === currentResult.playerName &&
              e.score === currentResult.score;
            const rowLabel = `Rank ${i + 1}. ${e.playerName}. Score ${e.score}. ${e.mistakes} mistakes. ${e.traceBacks} trace backs.`;
            return `
        <div class="leaderboard-row${isYou ? " leaderboard-row-you" : ""}" aria-label="${rowLabel}">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name">${e.playerName.toUpperCase()}${isYou ? '<span class="leaderboard-you-tag">YOU</span>' : ""}</span>
          <span class="lb-score">${e.score}</span>
          <span class="lb-mistakes">${e.mistakes}</span>
          <span class="lb-traceback">${e.traceBacks}</span>
        </div>`;
          })
          .join("")
      : `<p class="leaderboard-empty">No official results yet for this band.</p>`;

    el.innerHTML = `
      <div class="panel leaderboard-panel">
        <p class="eyebrow">LOGIC GRID · LOCAL LEADERBOARD</p>
        <h2 class="section-title">${bandLabel}</h2>
        <div class="leaderboard-header" role="row">
          <span>RANK</span><span>PLAYER</span><span>SCORE</span><span>MISTAKES</span><span>TRACE BACKS</span>
        </div>
        <div class="leaderboard-list" role="table" aria-label="${bandLabel} leaderboard">${rows}</div>
        <button class="btn btn-secondary" data-action="back">BACK</button>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    el.querySelector('[data-action="back"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo(this.gameState.lastResult ? "results" : "home");
    });
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
