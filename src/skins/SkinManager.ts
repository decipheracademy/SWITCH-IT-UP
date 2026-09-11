import type { GradeBand, RenderSkin } from "../puzzle/types";

/** Alias kept for readability within this module — same type as
 * puzzle/types.ts's RenderSkin (Build 01 already defined it; this
 * module doesn't duplicate it, just uses the shorter local name). */
export type Skin = RenderSkin;

interface BandSkinData {
  letters?: string[];
  symbols?: string[];
}

/**
 * Letter/symbol sets transcribed from the authoritative "SWITCH IT UP"
 * source specification. Two genuine gaps were found and are NOT
 * papered over (per Build 05 spec §36's own instruction: "Do NOT invent
 * an unverified symbol mapping if the source data is inconsistent"):
 *
 * - Band 4's symbol set in the source has only 5 symbols (☾ ✿ ● ▲ ■)
 *   for a 6-value puzzle.
 * - Band 5's symbol set in the source has only 8 symbols
 *   (● ▲ ■ ★ ♦ ♥ ☾ ✿) for a 9-value puzzle.
 *
 * Both are left undefined here rather than padded with an invented
 * 6th/9th symbol — getSkinValues() falls back to the Number skin for
 * those two specific (band, "symbol") combinations, and
 * isSkinAvailable() reports that honestly so the UI can grey out the
 * option instead of silently mis-rendering. Every other band/skin
 * combination has a verified, correctly-sized set.
 */
const BAND_SKINS: Record<GradeBand, BandSkinData> = {
  1: { letters: ["C", "A", "T"], symbols: ["●", "▲", "■"] },
  2: { letters: ["L", "O", "V", "E"], symbols: ["●", "▲", "■", "★"] },
  3: { letters: ["P", "L", "A", "N", "E", "T"], symbols: ["●", "▲", "■", "★", "♦", "♥"] },
  4: { letters: ["G", "A", "R", "D", "E", "N"] /* symbols: gap, see note above */ },
  5: { letters: ["C", "O", "M", "P", "U", "T", "E", "R", "S"] /* symbols: gap, see note above */ },
  6: {
    letters: ["D", "I", "S", "C", "O", "V", "E", "R", "Y"],
    symbols: ["♠", "♣", "♦", "♥", "★", "●", "▲", "■", "✿"],
  },
};

/** True if `skin` has a verified, correctly-sized mapping for `band`.
 * "number" is always available (it's the underlying representation).
 * "letter" is available for all six bands. "symbol" is unavailable for
 * Bands 4 and 5 specifically (see the gap note above). */
export function isSkinAvailable(band: GradeBand, skin: Skin): boolean {
  if (skin === "number") return true;
  const data = BAND_SKINS[band];
  const set = skin === "letter" ? data.letters : data.symbols;
  return !!set;
}

/**
 * Returns the display strings for internal values 1..size, for the
 * given band and skin. Falls back to plain numbers if the requested
 * skin isn't available for that band (see the gap note above) — this
 * is a rendering fallback only; it never changes the puzzle, the
 * solution, the constraints, or the score (Build 05 spec §37).
 */
export function getSkinValues(band: GradeBand, size: number, skin: Skin): string[] {
  if (skin !== "number" && isSkinAvailable(band, skin)) {
    const data = BAND_SKINS[band];
    const set = skin === "letter" ? data.letters : data.symbols;
    if (set && set.length === size) return set.slice(0, size);
  }
  return Array.from({ length: size }, (_, i) => String(i + 1));
}

/** Maps a single internal value (1..size) to its display string under
 * the given band/skin, with the same safe fallback as getSkinValues(). */
export function getSkinValue(band: GradeBand, size: number, skin: Skin, value: number): string {
  const values = getSkinValues(band, size, skin);
  return values[value - 1] ?? String(value);
}
