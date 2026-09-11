/**
 * AssetManager — Build 01 placeholder.
 *
 * Build 01 does not load external textures, models, or fonts; the
 * holographic look is achieved with procedural Three.js materials so
 * the foundation has zero external asset dependencies. This class
 * exists so later builds have a single place to add real loading
 * (GLTFLoader, TextureLoader, FontLoader, etc.) without restructuring
 * call sites.
 */
export class AssetManager {
  private cache = new Map<string, unknown>();

  /** Placeholder — no-op in Build 01. Returns a rejected promise if
   * called, since no loader is wired up yet. */
  async load<T>(_key: string, _url: string): Promise<T> {
    throw new Error(
      "AssetManager.load() is not implemented in Build 01 — no external assets are used yet."
    );
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
