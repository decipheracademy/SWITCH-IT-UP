import { describe, it, expect, beforeEach } from "vitest";
import { getPersonalBest, submitScore } from "../src/competition/PersonalBestManager";

beforeEach(() => {
  localStorage.clear();
});

describe("PersonalBestManager", () => {
  it("returns null when there is no record yet", () => {
    expect(getPersonalBest(1)).toBeNull();
  });

  it("first submission always sets a new personal best", () => {
    const isNew = submitScore(2, 800);
    expect(isNew).toBe(true);
    expect(getPersonalBest(2)).toBe(800);
  });

  it("a higher score updates the record and reports true", () => {
    submitScore(3, 700);
    const isNew = submitScore(3, 900);
    expect(isNew).toBe(true);
    expect(getPersonalBest(3)).toBe(900);
  });

  it("a lower or equal score does not update the record and reports false", () => {
    submitScore(4, 900);
    expect(submitScore(4, 850)).toBe(false);
    expect(submitScore(4, 900)).toBe(false);
    expect(getPersonalBest(4)).toBe(900);
  });

  it("grade bands are isolated from each other", () => {
    submitScore(1, 1000);
    submitScore(6, 200);
    expect(getPersonalBest(1)).toBe(1000);
    expect(getPersonalBest(6)).toBe(200);
  });

  it("fails gracefully on malformed stored data", () => {
    localStorage.setItem("logicGrid.personalBest", "not json");
    expect(() => getPersonalBest(1)).not.toThrow();
    expect(getPersonalBest(1)).toBeNull();
    expect(() => submitScore(1, 500)).not.toThrow();
    expect(getPersonalBest(1)).toBe(500);
  });
});
