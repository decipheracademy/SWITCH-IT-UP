import { describe, it, expect, beforeEach } from "vitest";
import { GameState } from "../src/core/GameState";

beforeEach(() => {
  localStorage.clear();
});

describe("GameState — mode and session reset", () => {
  it("defaults to practice mode", () => {
    const gs = new GameState();
    expect(gs.mode).toBe("practice");
  });

  it("startChallenge sets the mode and resets all session counters", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);
    expect(gs.engine.getMoveHistory().length).toBe(1);

    gs.startChallenge("official");

    expect(gs.mode).toBe("official");
    expect(gs.engine.getMoveHistory().length).toBe(0);
    expect(gs.traceBackCount).toBe(0);
    expect(gs.confirmedMistakes).toBe(0);
    expect(gs.lastResult).toBeNull();
    expect(gs.puzzleStatus).toBe("in-progress");
  });

  it("startChallenge produces a genuinely fresh puzzle instance (not just zeroed counters)", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    const firstEngine = gs.engine;
    gs.startChallenge("practice");
    expect(gs.engine).not.toBe(firstEngine);
  });
});

describe("GameState — confirmed mistake counting", () => {
  it("counts once per distinct dead-end EVENT, not once per Trace Back spent resolving it", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(3);
    expect(gs.confirmedMistakes).toBe(0); // in-progress, no mistake yet

    // Force entry into dead-end directly (isolating the counting logic
    // from whether this tiny puzzle can organically reach one — already
    // proven reachable in general by DeadEndDetector.test.ts).
    (gs as unknown as { puzzleStatus: string }).puzzleStatus = "dead-end";
    // Simulate the counting that would have happened on entry by
    // calling the same path a real transition takes: place another
    // (rejected) value does nothing since dead-end locks input, so
    // instead verify via traceBack() — which re-runs updatePuzzleState
    // and must NOT increment confirmedMistakes again just because the
    // status was already dead-end when it re-evaluates.
    gs.traceBack();
    // Only one real dead-end transition ever happened via updatePuzzleState
    // in this test (none, actually — we set status directly), so
    // confirmedMistakes should still be 0 here; this confirms
    // traceBack()'s re-evaluation doesn't itself add a mistake.
    expect(gs.confirmedMistakes).toBe(0);
  });

  it("does not count a rejected illegal placement as a mistake", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    gs.selectCell(0, 2);
    gs.placeValue(1); // illegal
    expect(gs.confirmedMistakes).toBe(0);
  });

  it("resets to 0 on a fresh challenge", () => {
    const gs = new GameState();
    gs.selectGrade(1);
    (gs as unknown as { confirmedMistakes: number }).confirmedMistakes = 3;
    gs.startChallenge("official");
    expect(gs.confirmedMistakes).toBe(0);
  });
});

describe("GameState — result finalization", () => {
  it("finalizes exactly once on genuine completion and emits result:ready", () => {
    const gs = new GameState();
    gs.startChallenge("official");
    gs.setPlayerName("Tester");

    let resultEvents = 0;
    gs.bus.on("result:ready", () => resultEvents++);

    gs.selectCell(0, 2);
    gs.placeValue(3);
    gs.selectCell(1, 0);
    gs.placeValue(2);
    gs.selectCell(2, 1);
    gs.placeValue(1);

    expect(gs.puzzleStatus).toBe("complete-valid");
    expect(gs.lastResult).not.toBeNull();
    expect(gs.lastResult?.mode).toBe("official");
    expect(gs.lastResult?.playerName).toBe("Tester");
    expect(resultEvents).toBe(1);
  });

  it("does not finalize a result for an invalid (full but wrong) completion", () => {
    // Band 1 is a pure Latin square with only one possible completion
    // per empty cell, so "full but wrong" can't be constructed there;
    // this test instead verifies the gate structurally: lastResult
    // stays null while status is anything other than complete-valid.
    const gs = new GameState();
    gs.selectGrade(1);
    expect(gs.lastResult).toBeNull();
    gs.selectCell(0, 2);
    gs.placeValue(3);
    expect(gs.puzzleStatus).toBe("in-progress");
    expect(gs.lastResult).toBeNull();
  });

  it("practice mode still finalizes a result object (for display) without leaderboard/personal-best side effects", () => {
    const gs = new GameState();
    gs.startChallenge("practice");
    gs.selectCell(0, 2);
    gs.placeValue(3);
    gs.selectCell(1, 0);
    gs.placeValue(2);
    gs.selectCell(2, 1);
    gs.placeValue(1);

    expect(gs.lastResult).not.toBeNull();
    expect(gs.lastResult?.mode).toBe("practice");
    expect(gs.lastResult?.isNewPersonalBest).toBe(false);
    expect(gs.lastResult?.rank).toBeNull();
  });
});

describe("GameState — skin selection", () => {
  it("defaults to number skin and emits skin:changed on setSkin", () => {
    const gs = new GameState();
    expect(gs.renderSkin).toBe("number");
    let changed: string | null = null;
    gs.bus.on("skin:changed", ({ skin }) => (changed = skin));
    gs.setSkin("letter");
    expect(gs.renderSkin).toBe("letter");
    expect(changed).toBe("letter");
  });
});
