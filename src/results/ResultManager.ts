import type { GradeBand, PlayerGrade } from "../puzzle/types";
import type { GameMode } from "../core/GameState";
import type { Skin } from "../skins/SkinManager";
import { calculateScore, rateScore, type ResultRating } from "../scoring/ScoringEngine";
import { evaluateBadges } from "../badges/BadgeManager";
import * as LeaderboardManager from "../competition/LeaderboardManager";
import * as PersonalBestManager from "../competition/PersonalBestManager";

export type { GameMode };

/** The complete record of one session's outcome (Build 05 spec §55).
 * The results screen consumes this object as-is — it never
 * recalculates the score itself. */
export interface GameResult {
  playerName: string;
  grade: PlayerGrade;
  gradeBand: GradeBand;
  mode: GameMode;
  skin: Skin;
  score: number;
  baseScore: number;
  mistakePenalty: number;
  traceBackPenalty: number;
  efficiencyBonus: number;
  efficiencyPercent: number;
  confirmedMistakes: number;
  traceBackCount: number;
  badges: string[];
  completed: boolean;
  rating: ResultRating;
  createdAt: string;
  /** Only meaningful for mode === "official" and completed === true. */
  isNewPersonalBest: boolean;
  personalBest: number | null;
  rank: number | null;
}

export interface BuildResultInput {
  playerName: string;
  grade: PlayerGrade;
  gradeBand: GradeBand;
  mode: GameMode;
  skin: Skin;
  confirmedMistakes: number;
  traceBackCount: number;
  completed: boolean; // board full AND matches the hidden solution
}

/**
 * Builds a GameResult from a finished session and — ONLY for a
 * completed OFFICIAL session — records it to the leaderboard and
 * personal best. Practice sessions and incomplete official attempts
 * never touch either store (Build 05 spec §8/§10/§54): the score is
 * still computed and returned (so a practice player can see how they
 * would have done), but `isNewPersonalBest`/`rank` stay
 * false/null and nothing is persisted.
 *
 * Never reads or requires the hidden solution — `completed` is passed
 * in already determined by SudokuEngine.matchesSolution(), the one
 * place in the whole codebase that's allowed to consult it.
 */
export function buildResult(input: BuildResultInput): GameResult {
  const breakdown = calculateScore({
    confirmedMistakes: input.confirmedMistakes,
    traceBackCount: input.traceBackCount,
    completed: input.completed,
  });
  const rating = rateScore(breakdown.finalScore);

  const isOfficialCompletion = input.mode === "official" && input.completed;

  let isNewPersonalBest = false;
  let personalBest: number | null = PersonalBestManager.getPersonalBest(input.gradeBand);
  let rank: number | null = null;
  let badges: string[] = [];

  if (isOfficialCompletion) {
    const hadPriorCompletion = LeaderboardManager.hasAnyCompletion(input.gradeBand);

    badges = evaluateBadges({
      completed: true,
      confirmedMistakes: input.confirmedMistakes,
      traceBackCount: input.traceBackCount,
      efficiencyPercent: breakdown.efficiencyPercent,
      finalScore: breakdown.finalScore,
      isFirstOfficialCompletion: !hadPriorCompletion,
    });

    isNewPersonalBest = PersonalBestManager.submitScore(input.gradeBand, breakdown.finalScore);
    personalBest = PersonalBestManager.getPersonalBest(input.gradeBand);

    LeaderboardManager.submitScore({
      playerName: input.playerName,
      grade: input.grade,
      gradeBand: input.gradeBand,
      score: breakdown.finalScore,
      mistakes: input.confirmedMistakes,
      traceBacks: input.traceBackCount,
      efficiency: breakdown.efficiencyPercent,
      badges,
      completedAt: new Date().toISOString(),
    });
    rank = LeaderboardManager.computeRank(input.gradeBand, {
      score: breakdown.finalScore,
      mistakes: input.confirmedMistakes,
      traceBacks: input.traceBackCount,
    });
  }

  return {
    playerName: input.playerName,
    grade: input.grade,
    gradeBand: input.gradeBand,
    mode: input.mode,
    skin: input.skin,
    score: breakdown.finalScore,
    baseScore: breakdown.baseScore,
    mistakePenalty: breakdown.mistakePenalty,
    traceBackPenalty: breakdown.traceBackPenalty,
    efficiencyBonus: breakdown.efficiencyBonus,
    efficiencyPercent: breakdown.efficiencyPercent,
    confirmedMistakes: input.confirmedMistakes,
    traceBackCount: input.traceBackCount,
    badges,
    completed: input.completed,
    rating,
    createdAt: new Date().toISOString(),
    isNewPersonalBest,
    personalBest,
    rank,
  };
}
