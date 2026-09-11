/**
 * Pure scoring calculation, per Build 05 spec §19-21. No rendering, no
 * DOM, no audio, no Three.js — just numbers in, numbers out, so it's
 * trivially unit-testable and never a source of truth for puzzle
 * correctness (that remains SudokuEngine's job entirely).
 */

export const BASE_SCORE = 1000;
export const MISTAKE_PENALTY_PER = 100;
export const FREE_TRACEBACK_ALLOWANCE = 2;
export const TRACEBACK_PENALTY_PER_EXTRA = 25;
export const MAX_EFFICIENCY_BONUS = 200;

export interface ScoreInput {
  confirmedMistakes: number;
  traceBackCount: number;
  completed: boolean;
}

export interface ScoreBreakdown {
  baseScore: number;
  mistakePenalty: number;
  traceBackPenalty: number;
  efficiencyBonus: number;
  finalScore: number;
  /** 0-100, for display (Build 05 spec §25 "Efficiency 75%"). Same
   * ratio the efficiency bonus is derived from, just scaled for
   * presentation rather than points. */
  efficiencyPercent: number;
}

/**
 * calculateScore({ confirmedMistakes, traceBackCount, completed }).
 *
 * Formula (Build 05 spec §19-21):
 *   baseScore        = 1000
 *   mistakePenalty   = confirmedMistakes * 100
 *   traceBackPenalty = max(0, traceBackCount - 2) * 25
 *   efficiencyRatio  = freeAllowance / max(traceBackCount, freeAllowance)
 *   efficiencyBonus  = round(200 * efficiencyRatio)
 *   finalScore       = max(0, baseScore - mistakePenalty - traceBackPenalty + efficiencyBonus)
 *
 * Deliberately makes no attempt to interpret `completed` beyond being
 * part of the input shape the spec's conceptual API asks for — scoring
 * a session that isn't complete is the caller's decision (e.g. an
 * abandoned official attempt, per spec §10), not this function's.
 */
export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const confirmedMistakes = Math.max(0, Math.floor(input.confirmedMistakes));
  const traceBackCount = Math.max(0, Math.floor(input.traceBackCount));

  const baseScore = BASE_SCORE;
  const mistakePenalty = confirmedMistakes * MISTAKE_PENALTY_PER;
  const traceBackPenalty = Math.max(0, traceBackCount - FREE_TRACEBACK_ALLOWANCE) * TRACEBACK_PENALTY_PER_EXTRA;

  const efficiencyRatio =
    FREE_TRACEBACK_ALLOWANCE / Math.max(traceBackCount, FREE_TRACEBACK_ALLOWANCE);
  const efficiencyBonus = Math.min(
    MAX_EFFICIENCY_BONUS,
    Math.max(0, Math.round(MAX_EFFICIENCY_BONUS * efficiencyRatio))
  );

  const rawFinal = baseScore - mistakePenalty - traceBackPenalty + efficiencyBonus;
  const finalScore = Math.max(0, rawFinal);

  return {
    baseScore,
    mistakePenalty,
    traceBackPenalty,
    efficiencyBonus,
    finalScore,
    efficiencyPercent: Math.round(efficiencyRatio * 100),
  };
}

export type ResultRating = "ELITE" | "EXCELLENT" | "STRONG" | "DEVELOPING" | "KEEP PRACTICING";

/** Presentation-only classification (Build 05 spec §26) — never feeds
 * back into the score itself. */
export function rateScore(finalScore: number): ResultRating {
  if (finalScore >= 1000) return "ELITE";
  if (finalScore >= 850) return "EXCELLENT";
  if (finalScore >= 700) return "STRONG";
  if (finalScore >= 500) return "DEVELOPING";
  return "KEEP PRACTICING";
}
