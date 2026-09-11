import { describe, it, expect, beforeEach } from "vitest";
import { submitScore, getLeaderboard, computeRank, hasAnyCompletion } from "../src/competition/LeaderboardManager";
import type { LeaderboardEntry } from "../src/competition/LeaderboardManager";

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    playerName: "Player",
    grade: 5,
    gradeBand: 3,
    score: 1000,
    mistakes: 0,
    traceBacks: 0,
    efficiency: 100,
    badges: [],
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("LeaderboardManager — basic submission", () => {
  it("a new player's score is stored and retrievable", () => {
    submitScore(entry({ playerName: "Alex", score: 900, gradeBand: 4 }));
    const board = getLeaderboard(4);
    expect(board.length).toBe(1);
    expect(board[0].playerName).toBe("Alex");
  });

  it("sorts by score descending", () => {
    submitScore(entry({ playerName: "Low", score: 500, gradeBand: 1 }));
    submitScore(entry({ playerName: "High", score: 1100, gradeBand: 1 }));
    const board = getLeaderboard(1);
    expect(board.map((e) => e.playerName)).toEqual(["High", "Low"]);
  });

  it("tie-breaks by fewer mistakes, then fewer trace backs", () => {
    submitScore(entry({ playerName: "A", score: 1000, mistakes: 2, traceBacks: 1, gradeBand: 2 }));
    submitScore(entry({ playerName: "B", score: 1000, mistakes: 0, traceBacks: 3, gradeBand: 2 }));
    submitScore(entry({ playerName: "C", score: 1000, mistakes: 0, traceBacks: 1, gradeBand: 2 }));
    const board = getLeaderboard(2);
    expect(board.map((e) => e.playerName)).toEqual(["C", "B", "A"]);
  });

  it("never uses completion time as a sort key (the game is untimed)", () => {
    const e = entry({});
    expect(Object.keys(e)).not.toContain("time");
    expect(Object.keys(e)).not.toContain("elapsedSeconds");
  });
});

describe("LeaderboardManager — grade band isolation", () => {
  it("does not mix bands — Band 1 and Band 6 have separate leaderboards", () => {
    submitScore(entry({ playerName: "Young", score: 1000, gradeBand: 1 }));
    submitScore(entry({ playerName: "Old", score: 1000, gradeBand: 6 }));
    expect(getLeaderboard(1).map((e) => e.playerName)).toEqual(["Young"]);
    expect(getLeaderboard(6).map((e) => e.playerName)).toEqual(["Old"]);
  });
});

describe("LeaderboardManager — bounded size", () => {
  it("keeps only the top 10 entries per band", () => {
    for (let i = 0; i < 15; i++) {
      submitScore(entry({ playerName: `P${i}`, score: i * 10, gradeBand: 5 }));
    }
    const board = getLeaderboard(5);
    expect(board.length).toBe(10);
    expect(board[0].score).toBe(140);
  });
});

describe("LeaderboardManager — rank computation", () => {
  it("computes rank 1 for a new best score", () => {
    submitScore(entry({ playerName: "A", score: 800, gradeBand: 3 }));
    const rank = computeRank(3, { score: 1000, mistakes: 0, traceBacks: 0 });
    expect(rank).toBe(1);
  });

  it("computes correct rank when the entry falls in the middle", () => {
    submitScore(entry({ playerName: "A", score: 1000, gradeBand: 3 }));
    submitScore(entry({ playerName: "B", score: 500, gradeBand: 3 }));
    const rank = computeRank(3, { score: 750, mistakes: 0, traceBacks: 0 });
    expect(rank).toBe(2);
  });
});

describe("LeaderboardManager — hasAnyCompletion", () => {
  it("is false for an empty band, true after a submission", () => {
    expect(hasAnyCompletion(4)).toBe(false);
    submitScore(entry({ gradeBand: 4 }));
    expect(hasAnyCompletion(4)).toBe(true);
  });
});

describe("LeaderboardManager — graceful handling of malformed storage", () => {
  it("does not throw and returns an empty board when stored JSON is invalid", () => {
    localStorage.setItem("logicGrid.leaderboards", "{not valid json");
    expect(() => getLeaderboard(1)).not.toThrow();
    expect(getLeaderboard(1)).toEqual([]);
  });

  it("does not throw when the stored value is a JSON array instead of an object", () => {
    localStorage.setItem("logicGrid.leaderboards", "[1,2,3]");
    expect(() => getLeaderboard(1)).not.toThrow();
  });

  it("recovers gracefully (submission still works after malformed data)", () => {
    localStorage.setItem("logicGrid.leaderboards", "garbage");
    submitScore(entry({ playerName: "Recovered", gradeBand: 1 }));
    expect(getLeaderboard(1)[0].playerName).toBe("Recovered");
  });
});
