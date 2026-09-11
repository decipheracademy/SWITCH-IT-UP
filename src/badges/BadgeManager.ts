import { FREE_TRACEBACK_ALLOWANCE, rateScore } from "../scoring/ScoringEngine";

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
}

export const BADGES: BadgeDefinition[] = [
  { id: "first-grid", title: "FIRST GRID", description: "Complete your first official challenge." },
  { id: "clean-logic", title: "CLEAN LOGIC", description: "Complete with zero confirmed mistakes." },
  { id: "trace-master", title: "TRACE MASTER", description: "Complete while staying within the free Trace Back allowance." },
  { id: "precision-player", title: "PRECISION PLAYER", description: "Achieve an excellent efficiency score." },
  { id: "logic-grid-elite", title: "LOGIC GRID ELITE", description: "Achieve an Elite final score." },
];

export interface BadgeEvalInput {
  completed: boolean;
  confirmedMistakes: number;
  traceBackCount: number;
  efficiencyPercent: number;
  finalScore: number;
  /** Whether the player has ever completed an official challenge
   * before this one — BadgeManager has no persistence of its own, so
   * the caller supplies this from whatever store already tracks it
   * (e.g. LeaderboardManager/PersonalBestManager). */
  isFirstOfficialCompletion: boolean;
}

/**
 * Evaluates which badges a completed OFFICIAL session earned. Pure
 * function — no localStorage, no rendering, no UI coupling. Practice
 * sessions should never be passed in here (same gate as scoring and
 * the leaderboard: the caller decides mode eligibility).
 */
export function evaluateBadges(input: BadgeEvalInput): string[] {
  if (!input.completed) return [];

  const earned: string[] = [];
  if (input.isFirstOfficialCompletion) earned.push("first-grid");
  if (input.confirmedMistakes === 0) earned.push("clean-logic");
  if (input.traceBackCount <= FREE_TRACEBACK_ALLOWANCE) earned.push("trace-master");
  if (input.efficiencyPercent >= 90) earned.push("precision-player");
  if (rateScore(input.finalScore) === "ELITE") earned.push("logic-grid-elite");
  return earned;
}

export function getBadgeDefinition(id: string): BadgeDefinition | undefined {
  return BADGES.find((b) => b.id === id);
}
