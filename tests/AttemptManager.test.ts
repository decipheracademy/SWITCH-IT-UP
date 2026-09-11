import { describe, it, expect, beforeEach } from "vitest";
import { getRecordedAttempt, recordAttempt } from "../src/competition/AttemptManager";
import { GameState } from "../src/core/GameState";
import type { GameResult } from "../src/results/ResultManager";

beforeEach(() => {
  localStorage.clear();
});

function fakeResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    playerName: "Alex",
    grade: 5,
    gradeBand: 3,
    mode: "official",
    skin: "number",
    score: 1200,
    baseScore: 1000,
    mistakePenalty: 0,
    traceBackPenalty: 0,
    efficiencyBonus: 200,
    efficiencyPercent: 100,
    confirmedMistakes: 0,
    traceBackCount: 0,
    badges: [],
    completed: true,
    rating: "ELITE",
    createdAt: new Date().toISOString(),
    isNewPersonalBest: true,
    personalBest: 1200,
    rank: 1,
    ...overrides,
  };
}

describe("AttemptManager — basic recording and lookup", () => {
  it("returns null when no attempt has been recorded", () => {
    expect(getRecordedAttempt("Alex", 3)).toBeNull();
  });

  it("records and retrieves a result for a player+band", () => {
    const result = fakeResult();
    recordAttempt("Alex", 3, result);
    expect(getRecordedAttempt("Alex", 3)).toEqual(result);
  });

  it("normalizes identity — case and whitespace don't create separate slots", () => {
    recordAttempt("Alex", 3, fakeResult());
    expect(getRecordedAttempt("alex", 3)).not.toBeNull();
    expect(getRecordedAttempt("  ALEX  ", 3)).not.toBeNull();
  });

  it("isolates attempts by grade band — same player, different bands", () => {
    recordAttempt("Alex", 1, fakeResult({ gradeBand: 1, score: 900 }));
    recordAttempt("Alex", 3, fakeResult({ gradeBand: 3, score: 1200 }));
    expect(getRecordedAttempt("Alex", 1)?.score).toBe(900);
    expect(getRecordedAttempt("Alex", 3)?.score).toBe(1200);
  });

  it("isolates attempts by player — different players, same band", () => {
    recordAttempt("Alex", 3, fakeResult({ playerName: "Alex", score: 1200 }));
    recordAttempt("Sam", 3, fakeResult({ playerName: "Sam", score: 700 }));
    expect(getRecordedAttempt("Alex", 3)?.score).toBe(1200);
    expect(getRecordedAttempt("Sam", 3)?.score).toBe(700);
  });

  it("does not record or look up an attempt for an empty name", () => {
    recordAttempt("", 3, fakeResult());
    expect(getRecordedAttempt("", 3)).toBeNull();
    expect(getRecordedAttempt("   ", 3)).toBeNull();
  });

  it("the FIRST recorded attempt stands — a second call does not overwrite it", () => {
    recordAttempt("Alex", 3, fakeResult({ score: 1200 }));
    recordAttempt("Alex", 3, fakeResult({ score: 500 })); // attempted overwrite
    expect(getRecordedAttempt("Alex", 3)?.score).toBe(1200);
  });

  it("fails gracefully on malformed stored data", () => {
    localStorage.setItem("logicGrid.officialAttempts", "not json");
    expect(() => getRecordedAttempt("Alex", 3)).not.toThrow();
    expect(getRecordedAttempt("Alex", 3)).toBeNull();
    expect(() => recordAttempt("Alex", 3, fakeResult())).not.toThrow();
    expect(getRecordedAttempt("Alex", 3)).not.toBeNull();
  });
});

describe("GameState — official completion is recorded exactly once", () => {
  it("finalizing an official completion records the attempt", () => {
    const gs = new GameState();
    gs.setPlayerName("Jordan");
    gs.selectGrade(1);
    gs.startChallenge("official");
    gs.selectCell(0, 2);
    gs.placeValue(3);
    gs.selectCell(1, 0);
    gs.placeValue(2);
    gs.selectCell(2, 1);
    gs.placeValue(1);

    expect(gs.puzzleStatus).toBe("complete-valid");
    const recorded = getRecordedAttempt("Jordan", 1);
    expect(recorded).not.toBeNull();
    expect(recorded?.score).toBe(gs.lastResult?.score);
  });

  it("practice completion is never recorded as an official attempt", () => {
    const gs = new GameState();
    gs.setPlayerName("Riley");
    gs.selectGrade(1);
    gs.startChallenge("practice");
    gs.selectCell(0, 2);
    gs.placeValue(3);
    gs.selectCell(1, 0);
    gs.placeValue(2);
    gs.selectCell(2, 1);
    gs.placeValue(1);

    expect(gs.puzzleStatus).toBe("complete-valid");
    expect(getRecordedAttempt("Riley", 1)).toBeNull();
  });

  it("loadExistingResult redisplays a prior result without touching the engine or re-scoring", () => {
    const gs = new GameState();
    gs.setPlayerName("Morgan");
    const priorResult = fakeResult({ playerName: "Morgan", gradeBand: 1, score: 950 });

    gs.selectGrade(1);
    expect(gs.lastResult).toBeNull();

    gs.loadExistingResult(priorResult);
    expect(gs.lastResult).toEqual(priorResult);
    expect(gs.viewingExistingAttempt).toBe(true);
    expect(gs.engine.getMoveHistory().length).toBe(0);
  });

  it("viewingExistingAttempt resets to false when a fresh session starts", () => {
    const gs = new GameState();
    gs.setPlayerName("Morgan");
    gs.loadExistingResult(fakeResult());
    expect(gs.viewingExistingAttempt).toBe(true);
    gs.selectGrade(2);
    expect(gs.viewingExistingAttempt).toBe(false);
    expect(gs.lastResult).toBeNull();
  });
});
