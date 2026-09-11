import type { Screen } from "../Screen";
import type { GameState } from "../../core/GameState";
import type { AudioManager } from "../../audio/AudioManager";
import { getBadgeDefinition } from "../../badges/BadgeManager";
import { announce } from "../liveRegion";

export class ResultsScreen implements Screen {
  private el: HTMLElement | null = null;
  private gameState: GameState;
  private audio: AudioManager;

  constructor(gameState: GameState, audio: AudioManager) {
    this.gameState = gameState;
    this.audio = audio;
  }

  mount(root: HTMLElement): void {
    const el = document.createElement("div");
    el.className = "screen results-screen";
    const result = this.gameState.lastResult;

    if (!result) {
      // Defensive fallback only — GameState guarantees this is
      // populated before navigating here (see finalizeResult()).
      el.innerHTML = `<div class="panel"><p>No result available.</p>
        <button class="btn btn-secondary" data-action="home">RETURN HOME</button></div>`;
      root.appendChild(el);
      this.el = el;
      el.querySelector('[data-action="home"]')?.addEventListener("click", () => this.gameState.goTo("home"));
      return;
    }

    const modeLabel = result.mode === "official" ? "OFFICIAL CHALLENGE" : "PRACTICE";
    const resultKindLabel = result.mode === "official" ? "COMPETITION RESULT" : "PRACTICE RESULT";
    const isReplay = this.gameState.viewingExistingAttempt;
    const replayNoteHtml = isReplay
      ? `<p class="replay-note">You've already completed this grade's Official Challenge — this is your recorded result. Official challenges can only be played once per grade.</p>`
      : "";
    const badgesHtml = result.badges.length
      ? result.badges
          .map((id, i) => {
            const def = getBadgeDefinition(id);
            return `<span class="badge-chip badge-chip-earned" style="animation-delay:${i * 120}ms" title="${def?.description ?? ""}" role="img" aria-label="Badge earned: ${def?.title ?? id}. ${def?.description ?? ""}">${def?.title ?? id}</span>`;
          })
          .join("")
      : `<span class="badge-chip badge-chip-none">No badges this attempt</span>`;

    const competitionHtml =
      result.mode === "official"
        ? `
          <div class="results-competition">
            <div class="results-competition-row">
              <span class="results-competition-label">PERSONAL BEST</span>
              <span class="results-competition-value">${result.personalBest ?? result.score}${result.isNewPersonalBest ? " — NEW!" : ""}</span>
            </div>
            <div class="results-competition-row">
              <span class="results-competition-label">LOCAL LEADERBOARD RANK</span>
              <span class="results-competition-value">${result.rank ? `#${result.rank}` : "—"}</span>
            </div>
          </div>
        `
        : `<p class="practice-note">PRACTICE RESULT — this result does not affect the leaderboard or personal best.</p>`;

    el.innerHTML = `
      <div class="panel results-panel">
        <p class="eyebrow">${modeLabel} · ${resultKindLabel}</p>
        <p class="results-player">${result.playerName.toUpperCase()} · GRADE ${result.grade}</p>
        ${replayNoteHtml}
        <div class="results-score-hero">
          <span class="results-score-label">FINAL SCORE</span>
          <span class="results-score-value" aria-hidden="true">0</span>
          <span class="sr-only">Final score: ${result.score}.</span>
          <span class="results-rating">${result.rating}</span>
        </div>
        <div class="results-performance">
          <div class="results-perf-item"><span>MISTAKES</span><strong>${result.confirmedMistakes}</strong></div>
          <div class="results-perf-item"><span>TRACE BACKS</span><strong>${result.traceBackCount}</strong></div>
          <div class="results-perf-item"><span>EFFICIENCY</span><strong>${result.efficiencyPercent}%</strong></div>
        </div>
        <div class="results-breakdown">
          <div class="results-breakdown-row"><span>BASE SCORE</span><span>${result.baseScore}</span></div>
          <div class="results-breakdown-row"><span>MISTAKE PENALTY</span><span>-${result.mistakePenalty}</span></div>
          <div class="results-breakdown-row"><span>TRACE BACK PENALTY</span><span>-${result.traceBackPenalty}</span></div>
          <div class="results-breakdown-row"><span>EFFICIENCY BONUS</span><span>+${result.efficiencyBonus}</span></div>
          <div class="results-breakdown-row results-breakdown-final"><span>FINAL SCORE</span><span>${result.score}</span></div>
        </div>
        ${competitionHtml}
        <div class="results-badges">${badgesHtml}</div>
        <div class="results-actions">
          ${result.mode === "official" ? '<button class="btn btn-secondary" data-action="leaderboard">VIEW LEADERBOARD</button>' : ""}
          <button class="btn btn-primary" data-action="play-again">PLAY AGAIN</button>
          <button class="btn btn-ghost" data-action="home">RETURN HOME</button>
        </div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;

    if (isReplay) {
      // Redisplaying an already-recorded result — not a fresh
      // completion, so skip the completion sound, the count-up
      // animation, and the "just earned" announcement/badge sound.
      // Show the final values immediately instead.
      const valueEl = el.querySelector<HTMLElement>(".results-score-value");
      if (valueEl) valueEl.textContent = String(result.score);
      announce(`Your recorded result for grade ${result.grade}. Final score: ${result.score}. Rating: ${result.rating}.`);
    } else {
      this.audio.play("completion");
      this.animateScoreReveal(result.score);

      const resultTypeLabel = result.mode === "official" ? "Competition result" : "Practice result";
      announce(
        `${resultTypeLabel}. Final score: ${result.score}. Rating: ${result.rating}.` +
          (result.isNewPersonalBest ? " New personal best." : "") +
          (result.badges.length ? ` ${result.badges.length} badge${result.badges.length > 1 ? "s" : ""} earned.` : "")
      );
      if (result.badges.length) {
        window.setTimeout(() => this.audio.play("badge-earned"), 600);
      }
    }

    el.querySelector('[data-action="leaderboard"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo("leaderboard");
    });
    el.querySelector('[data-action="play-again"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      // A new attempt is an explicit, fresh session — never a silent
      // overwrite of the just-recorded result (spec §58). Sends the
      // player back to grade selection, which starts a fresh challenge
      // and countdown as soon as a grade is chosen.
      this.gameState.goTo("grade-select");
    });
    el.querySelector('[data-action="home"]')?.addEventListener("click", () => {
      this.audio.play("button-click");
      this.gameState.goTo("home");
    });
  }

  /**
   * Presentation-only count-up (Build 06 spec §30/§31). The actual
   * score is already final and correct — set into the sr-only span
   * immediately, above — this only affects what's briefly shown in the
   * large visible number. Respects prefers-reduced-motion by skipping
   * straight to the final value with no animation.
   */
  private animateScoreReveal(finalScore: number): void {
    const valueEl = this.el?.querySelector<HTMLElement>(".results-score-value");
    if (!valueEl) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || finalScore === 0) {
      valueEl.textContent = String(finalScore);
      return;
    }

    const durationMs = 700;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      valueEl.textContent = String(Math.round(finalScore * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}
