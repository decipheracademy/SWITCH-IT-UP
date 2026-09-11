import { describe, it, expect } from "vitest";
import { getSkinValues, getSkinValue, isSkinAvailable } from "../src/skins/SkinManager";

describe("SkinManager — number skin always available", () => {
  it("returns plain numbers 1..size for every band", () => {
    for (const band of [1, 2, 3, 4, 5, 6] as const) {
      expect(isSkinAvailable(band, "number")).toBe(true);
    }
  });
});

describe("SkinManager — letter skin (verified sets, all six bands)", () => {
  it("Band 1: C A T", () => {
    expect(getSkinValues(1, 3, "letter")).toEqual(["C", "A", "T"]);
  });
  it("Band 2: L O V E", () => {
    expect(getSkinValues(2, 4, "letter")).toEqual(["L", "O", "V", "E"]);
  });
  it("Band 3: P L A N E T", () => {
    expect(getSkinValues(3, 6, "letter")).toEqual(["P", "L", "A", "N", "E", "T"]);
  });
  it("Band 4: G A R D E N", () => {
    expect(getSkinValues(4, 6, "letter")).toEqual(["G", "A", "R", "D", "E", "N"]);
  });
  it("Band 5: C O M P U T E R S", () => {
    expect(getSkinValues(5, 9, "letter")).toEqual(["C", "O", "M", "P", "U", "T", "E", "R", "S"]);
  });
  it("Band 6: D I S C O V E R Y", () => {
    expect(getSkinValues(6, 9, "letter")).toEqual(["D", "I", "S", "C", "O", "V", "E", "R", "Y"]);
  });
});

describe("SkinManager — symbol skin (available bands)", () => {
  it("Band 1, 2, 3, 6 have correctly-sized symbol sets", () => {
    expect(isSkinAvailable(1, "symbol")).toBe(true);
    expect(getSkinValues(1, 3, "symbol")).toEqual(["●", "▲", "■"]);

    expect(isSkinAvailable(2, "symbol")).toBe(true);
    expect(getSkinValues(2, 4, "symbol")).toEqual(["●", "▲", "■", "★"]);

    expect(isSkinAvailable(3, "symbol")).toBe(true);
    expect(getSkinValues(3, 6, "symbol")).toEqual(["●", "▲", "■", "★", "♦", "♥"]);

    expect(isSkinAvailable(6, "symbol")).toBe(true);
    expect(getSkinValues(6, 9, "symbol")).toEqual(["♠", "♣", "♦", "♥", "★", "●", "▲", "■", "✿"]);
  });
});

describe("SkinManager — documented data gaps (Band 4 & 5 symbols)", () => {
  it("Band 4 symbol skin is honestly reported as unavailable (source has only 5 symbols for 6 values)", () => {
    expect(isSkinAvailable(4, "symbol")).toBe(false);
  });

  it("Band 5 symbol skin is honestly reported as unavailable (source has only 8 symbols for 9 values)", () => {
    expect(isSkinAvailable(5, "symbol")).toBe(false);
  });

  it("requesting the unavailable symbol skin falls back to plain numbers rather than an invented/misaligned set", () => {
    expect(getSkinValues(4, 6, "symbol")).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(getSkinValues(5, 9, "symbol")).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });
});

describe("SkinManager — getSkinValue single-value lookup matches getSkinValues", () => {
  it("is consistent with the bulk getter for every band/skin combination", () => {
    const bands = [1, 2, 3, 4, 5, 6] as const;
    const sizes: Record<number, number> = { 1: 3, 2: 4, 3: 6, 4: 6, 5: 9, 6: 9 };
    const skins = ["number", "letter", "symbol"] as const;
    for (const band of bands) {
      for (const skin of skins) {
        const size = sizes[band];
        const bulk = getSkinValues(band, size, skin);
        for (let v = 1; v <= size; v++) {
          expect(getSkinValue(band, size, skin, v)).toBe(bulk[v - 1]);
        }
      }
    }
  });
});

describe("SkinManager — skins never change the underlying puzzle size", () => {
  it("getSkinValues always returns exactly `size` entries", () => {
    const bands = [1, 2, 3, 4, 5, 6] as const;
    const sizes: Record<number, number> = { 1: 3, 2: 4, 3: 6, 4: 6, 5: 9, 6: 9 };
    for (const band of bands) {
      for (const skin of ["number", "letter", "symbol"] as const) {
        expect(getSkinValues(band, sizes[band], skin).length).toBe(sizes[band]);
      }
    }
  });
});
