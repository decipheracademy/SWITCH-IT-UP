/** The set of sound cues the eventual game will need. */
export type SoundCue =
  | "hover"
  | "select"
  | "button-click"
  | "placement"
  | "warning"
  | "traceback"
  | "completion"
  | "dead-end"
  | "badge-earned";

/**
 * AudioManager — Build 01 placeholder architecture.
 *
 * No audio assets are sourced or loaded in Build 01 (per Project
 * Foundation §27). This class defines the hook surface — `play(cue)` —
 * that the rest of the app already calls, so wiring in real Howler/
 * WebAudio playback later is a localized change inside this file only.
 */
export class AudioManager {
  private muted = false;
  private registered = new Set<SoundCue>();

  /** No-op in Build 01 — logs to the console in dev mode so the hook
   * points are visible/verifiable without real audio files. */
  play(cue: SoundCue): void {
    if (this.muted) return;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[AudioManager] (placeholder) would play: ${cue}`);
    }
    this.registered.add(cue);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Build-verification helper: which cues have been triggered at least once. */
  getTriggeredCues(): SoundCue[] {
    return Array.from(this.registered);
  }
}
