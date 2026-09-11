import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

/** Renders a single glyph (digit, letter, or symbol string) to a
 * canvas and returns a cached THREE.CanvasTexture. Using canvas text
 * avoids needing external font/model assets for Build 01 while still
 * leaving room for a real font/geometry-based approach later if
 * needed. */
export function getGlyphTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `${text}:${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = "700 168px 'Segoe UI', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 28;
  ctx.fillStyle = color;
  ctx.fillText(text, size / 2, size / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}
