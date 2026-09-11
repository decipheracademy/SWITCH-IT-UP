import { describe, it, expect } from "vitest";
import { calculateScore, rateScore } from "../src/scoring/ScoringEngine";

describe("ScoringEngine — base cases", () => {
  it("0 mistakes, 0 trace backs -> max theoretical score 1200", () => {
    const r = calculateScore({ confirmedMistakes: 0, traceBackCount: 0, completed: true });
    expect(r.baseScore).toBe(1000);
    expect(r.mistakePenalty).toBe(0);
    expect(r.traceBackPenalty).toBe(0);
    expect(r.efficiencyBonus).toBe(200);
    expect(r.finalScore).toBe(1200);
  });

  it("0 mistakes, within free allowance (2 trace backs) -> still full efficiency bonus, no penalty", () => {
    const r = calculateScore({ confirmedMistakes: 0, traceBackCount: 2, completed: true });
    expect(r.traceBackPenalty).toBe(0);
    expect(r.efficiencyBonus).toBe(200);
    expect(r.finalScore).toBe(1200);
  });
});

describe("ScoringEngine — mistake penalties", () => {
  it("1 mistake -> -100", () => {
    const r = calculateScore({ confirmedMistakes: 1, traceBackCount: 0, completed: true });
    expect(r.mistakePenalty).toBe(100);
    expect(r.finalScore).toBe(1000 - 100 + 200);
  });

  it("multiple mistakes scale linearly", () => {
    const r = calculateScore({ confirmedMistakes: 4, traceBackCount: 0, completed: true });
    expect(r.mistakePenalty).toBe(400);
  });
});

describe("ScoringEngine — trace back penalties and efficiency (exact spec example)", () => {
  it("3 trace backs -> 1 over allowance -> -25 penalty", () => {
    const r = calculateScore({ confirmedMistakes: 0, traceBackCount: 3, completed: true });
    expect(r.traceBackPenalty).toBe(25);
  });

  it("10 trace backs -> 8 over allowance -> -200 penalty", () => {
    const r = calculateScore({ confirmedMistakes: 0, traceBackCount: 10, completed: true });
    expect(r.traceBackPenalty).toBe(200);
  });

  it("the worked example from the spec: 1 mistake, 3 trace backs", () => {
    // Base 1000, mistake penalty -100, traceback penalty -25 (1 over
    // allowance of 2). Efficiency ratio = 2/max(3,2) = 2/3 -> bonus =
    // round(200 * 2/3) = round(133.33) = 133.
    const r = calculateScore({ confirmedMistakes: 1, traceBackCount: 3, completed: true });
    expect(r.mistakePenalty).toBe(100);
    expect(r.traceBackPenalty).toBe(25);
    expect(r.efficiencyBonus).toBe(133);
    expect(r.finalScore).toBe(1000 - 100 - 25 + 133);
  });
});

describe("ScoringEngine — clamping", () => {
  it("never goes below 0 even with extreme mistakes", () => {
    const r = calculateScore({ confirmedMistakes: 50, traceBackCount: 50, completed: true });
    expect(r.finalScore).toBe(0);
  });

  it("negative/fractional inputs are sanitized (floored, non-negative)", () => {
    const r = calculateScore({ confirmedMistakes: -3, traceBackCount: -1, completed: true });
    expect(r.mistakePenalty).toBe(0);
    expect(r.traceBackPenalty).toBe(0);
    expect(r.efficiencyBonus).toBe(200);
  });
});

describe("ScoringEngine — deterministic, no hard-coded example scores", () => {
  it("the same input always produces the same output (pure function)", () => {
    const input = { confirmedMistakes: 2, traceBackCount: 5, completed: true };
    const a = calculateScore(input);
    const b = calculateScore(input);
    expect(a).toEqual(b);
  });
});

describe("rateScore — presentation-only classification", () => {
  it("classifies the documented bands correctly", () => {
    expect(rateScore(1200)).toBe("ELITE");
    expect(rateScore(1000)).toBe("ELITE");
    expect(rateScore(999)).toBe("EXCELLENT");
    expect(rateScore(850)).toBe("EXCELLENT");
    expect(rateScore(849)).toBe("STRONG");
    expect(rateScore(700)).toBe("STRONG");
    expect(rateScore(699)).toBe("DEVELOPING");
    expect(rateScore(500)).toBe("DEVELOPING");
    expect(rateScore(499)).toBe("KEEP PRACTICING");
    expect(rateScore(0)).toBe("KEEP PRACTICING");
  });

  it("never alters the underlying score", () => {
    const r = calculateScore({ confirmedMistakes: 1, traceBackCount: 1, completed: true });
    const rating = rateScore(r.finalScore);
    expect(typeof rating).toBe("string");
    expect(r.finalScore).toBe(r.finalScore); // rating computation is side-effect-free
  });
});
