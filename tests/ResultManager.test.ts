import { describe, it, expect, beforeEach } from "vitest";
import { buildResult } from "../src/results/ResultManager";
import { getPersonalBest } from "../src/competition/PersonalBestManager";
import { getLeaderboard } from "../src/competition/LeaderboardManager";

beforeEach(() => {
  localStorage.clear();
});

function baseInput(overrides: Partial<Parameters<typeof buildResult>[0]> = {}) {
  return {
    playerName: "Alex",
    grade: 5 as const,
    gradeBand: 3 as const,
    mode: "official" as const,
    skin: "number" as const,
    confirmedMistakes: 0,
    traceBackCount: 0,
    completed: true,
    ...overrides,
  };
}

describe("ResultManager — practice mode never persists", () => {
  it("computes a score but does not touch the leaderboard or personal best", () => {
    const result = buildResult(baseInput({ mode: "practice" }));
    expect(result.score).toBe(1200);
    expect(getPersonalBest(3)).toBeNull();
    expect(getLeaderboard(3)).toEqual([]);
    expect(result.isNewPersonalBest).toBe(false);
    expect(result.rank).toBeNull();
    expect(result.badges).toEqual([]); // badges are official-only too
  });
});

describe("ResultManager — incomplete official session never persists", () => {
  it("does not save to leaderboard/personal best when completed is false", () => {
    const result = buildResult(baseInput({ mode: "official", completed: false }));
    expect(getPersonalBest(3)).toBeNull();
    expect(getLeaderboard(3)).toEqual([]);
    expect(result.isNewPersonalBest).toBe(false);
  });
});

describe("ResultManager — completed official session persists correctly", () => {
  it("saves to the leaderboard and sets a new personal best", () => {
    const result = buildResult(baseInput());
    expect(result.isNewPersonalBest).toBe(true);
    expect(getPersonalBest(3)).toBe(1200);
    const board = getLeaderboard(3);
    expect(board.length).toBe(1);
    expect(board[0].playerName).toBe("Alex");
    expect(result.rank).toBe(1);
  });

  it("evaluates badges for a clean official completion", () => {
    const result = buildResult(baseInput());
    expect(result.badges).toContain("first-grid");
    expect(result.badges).toContain("clean-logic");
    expect(result.badges).toContain("trace-master");
    expect(result.badges).toContain("logic-grid-elite");
  });

  it("a second, lower-scoring official completion does not overwrite personal best", () => {
    buildResult(baseInput({ confirmedMistakes: 0, traceBackCount: 0 })); // 1200
    const second = buildResult(baseInput({ confirmedMistakes: 2, traceBackCount: 2 })); // lower
    expect(second.isNewPersonalBest).toBe(false);
    expect(getPersonalBest(3)).toBe(1200);
  });

  it("does not award first-grid on a second official completion", () => {
    buildResult(baseInput());
    const second = buildResult(baseInput({ confirmedMistakes: 1 }));
    expect(second.badges).not.toContain("first-grid");
  });
});

describe("ResultManager — never requires or exposes the hidden solution", () => {
  it("the result object contains no solution-shaped field", () => {
    const result = buildResult(baseInput());
    expect(Object.keys(result)).not.toContain("solution");
    expect(Object.keys(result)).not.toContain("correctValue");
  });
});
