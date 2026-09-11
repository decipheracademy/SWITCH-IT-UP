/**
 * A single, persistent ARIA live region for announcing meaningful game
 * state changes (Build 06 spec §22/§24) — Dead End reached, Trace Back
 * performed, puzzle completed, result ready. Deliberately NOT used for
 * every animation detail (hover, camera pan, particle motion) — only
 * state changes a player actually needs to know about.
 *
 * `politeness: "assertive"` is used only for Dead End (a genuinely
 * important interruption); everything else uses the default "polite"
 * region so it doesn't talk over whatever the player is doing.
 */
let politeRegion: HTMLElement | null = null;
let assertiveRegion: HTMLElement | null = null;

function ensureRegions(): void {
  if (politeRegion && assertiveRegion) return;

  politeRegion = document.createElement("div");
  politeRegion.className = "sr-only";
  politeRegion.setAttribute("role", "status");
  politeRegion.setAttribute("aria-live", "polite");
  document.body.appendChild(politeRegion);

  assertiveRegion = document.createElement("div");
  assertiveRegion.className = "sr-only";
  assertiveRegion.setAttribute("role", "alert");
  assertiveRegion.setAttribute("aria-live", "assertive");
  document.body.appendChild(assertiveRegion);
}

export function announce(message: string, urgent = false): void {
  ensureRegions();
  const region = urgent ? assertiveRegion! : politeRegion!;
  // Clearing first forces screen readers to re-announce even if the
  // same message is sent twice in a row (e.g. two dead ends with
  // identical wording).
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 30);
}
