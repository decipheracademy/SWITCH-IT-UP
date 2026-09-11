/** The project's established color system (see Project Foundation §11/§14). */
export const PALETTE = {
  background: 0x07101f,
  cyan: 0x18d9ff,
  blue: 0x287bff,
  magenta: 0xd946ef,
  purple: 0x7c3aed,
  orange: 0xff9d2e,
  white: 0xf5fbff,
} as const;

/** CSS hex strings for use outside Three.js (HUD, DOM UI). */
export const PALETTE_CSS = {
  background: "#07101F",
  cyan: "#18D9FF",
  blue: "#287BFF",
  magenta: "#D946EF",
  purple: "#7C3AED",
  orange: "#FF9D2E",
  white: "#F5FBFF",
} as const;
