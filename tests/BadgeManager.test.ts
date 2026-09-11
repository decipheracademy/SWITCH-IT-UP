import { describe, it, expect } from "vitest";
import { evaluateBadges, BADGES, getBadgeDefinition } from "../src/badges/BadgeManager";

describe("BadgeManager", () => {
  it("awards no badges for an incomplete session", () => {
    const badges = evaluateBadges({
      completed: false,
      confirmedMistakes: 0,
      traceBackCount: 0,
      efficiencyPercent: 100,
      finalScore: 1200,
      isFirstOfficialCompletion: true,
    });
    expect(badges).toEqual([]);
  });

  it("awards CLEAN_LOGIC only with zero confirmed mistakes", () => {
    const withMistake = evaluateBadges({
      completed: true,
      confirmedMistakes: 1,
      traceBackCount: 0,
      efficiencyPercent: 100,
      finalScore: 1100,
      isFirstOfficialCompletion: false,
    });
    expect(withMistake).not.toContain("clean-logic");

    const clean = evaluateBadges({
      completed: true,
      confirmedMistakes: 0,
      traceBackCount: 0,
      efficiencyPercent: 100,
      finalScore: 1200,
      isFirstOfficialCompletion: false,
    });
    expect(clean).toContain("clean-logic");
  });

  it("awards TRACE_MASTER only within the free allowance (<=2 trace backs)", () => {
    const withinAllowance = evaluateBadges({
      completed: true,
      confirmedMistakes: 0,
      traceBackCount: 2,
      efficiencyPercent: 100,
      finalScore: 1200,
      isFirstOfficialCompletion: false,
    });
    expect(withinAllowance).toContain("trace-master");

    const overAllowance = evaluateBadges({
      completed: true,
      confirmedMistakes: 0,
      traceBackCount: 3,
      efficiencyPercent: 67,
      finalScore: 1133,
      isFirstOfficialCompletion: false,
    });
    expect(overAllowance).not.toContain("trace-master");
  });

  it("awards PRECISION_PLAYER at high efficiency", () => {
    const high = evaluateBadges({
      completed: true,
      confirmedMistakes: 0,
      traceBackCount: 0,
      efficiencyPercent: 95,
      finalScore: 1200,
      isFirstOfficialCompletion: false,
    });
    expect(high).toContain("precision-player");

    const low = evaluateBadges({
      completed: true,
      confirmedMistakes: 0,
      traceBackCount: 5,
      efficiencyPercent: 40,
      finalScore: 1000,
      isFirstOfficialCompletion: false,
    });
    expect(low).not.toContain("precision-player");
  });

  it("awards LOGIC_GRID_ELITE only at an Elite final score", () => {
    const elite = evaluateBadges({
      completed: true,
      confirmedMistakes: 0,
      traceBackCount: 0,
      efficiencyPercent: 100,
      finalScore: 1050,
      isFirstOfficialCompletion: false,
    });
    expect(elite).toContain("logic-grid-elite");

    const notElite = evaluateBadges({
      completed: true,
      confirmedMistakes: 2,
      traceBackCount: 2,
      efficiencyPercent: 100,
      finalScore: 800,
      isFirstOfficialCompletion: false,
    });
    expect(notElite).not.toContain("logic-grid-elite");
  });

  it("awards FIRST_GRID only when the caller says it's the first completion", () => {
    const first = evaluateBadges({
      completed: true,
      confirmedMistakes: 1,
      traceBackCount: 1,
      efficiencyPercent: 90,
      finalScore: 900,
      isFirstOfficialCompletion: true,
    });
    expect(first).toContain("first-grid");

    const notFirst = evaluateBadges({
      completed: true,
      confirmedMistakes: 1,
      traceBackCount: 1,
      efficiencyPercent: 90,
      finalScore: 900,
      isFirstOfficialCompletion: false,
    });
    expect(notFirst).not.toContain("first-grid");
  });

  it("every badge id referenced by evaluateBadges has a definition", () => {
    const ids = BADGES.map((b) => b.id);
    for (const id of ids) {
      expect(getBadgeDefinition(id)).toBeDefined();
    }
  });
});
