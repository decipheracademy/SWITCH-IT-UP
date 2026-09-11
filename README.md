# Logic Grid — The Delayed-Consequence Sudoku Puzzle

**BUILD 06 — Final Competition Polish, UX, Accessibility & QA**
**(+ post-Build-06 flow simplification: streamlined Grade → Countdown → Play)**
**(+ post-Build-06 bugfix: related-cell highlighting no longer over-reveals on Band 1)**

Part of Decipher Academy's Skill Challenge Friday "Switch It Up" theme week
(Option B). Builds 01-05 established the visual foundation, the real
Sudoku engine, fully corrected puzzle data, the Dead End/Trace Back
mechanic, and a complete competition layer (Practice/Official modes,
scoring, results, badges, leaderboard, personal best, skins) — all
functionally complete and stable. Build 06 is the final production
polish pass: mandatory keyboard navigation, visible focus states,
screen-reader support via an ARIA live region, reduced-motion support,
a genuine 3D-rendering performance fix, a custom accessible
leave-challenge confirmation (no browser `confirm()`), an accessible
score-reveal animation, badge-reveal polish, and honest Official-mode
name validation — with zero changes to puzzle data, scoring formula, or
any gameplay rule.

**Flow simplification (requested after Build 06).** The Mode Select
("Choose Your Challenge Type") and Challenge Briefing screens were
removed from the flow. Selecting a grade now immediately starts an
**Official Challenge** session and plays a short 3-2-1-GO countdown
(`CountdownScreen.ts`) before gameplay begins — a purely presentational
transition, not a gameplay timer or scoring mechanic (the puzzle itself
remains completely untimed). Practice mode's underlying code
(`GameState.mode`, `ResultManager`'s gating) is untouched and still
fully functional; it's simply no longer reachable from the UI, so it can
be re-exposed later without any logic changes if wanted.

**Bugfix (found from a real screenshot after Build 06).** The "related
cell" highlighting (which lights up cells sharing a row/column/box with
the current selection) was reading the wrong box dimensions for Band 1.
A rendering-only override — introduced earlier to make grid *lines*
draw correctly on a 3×3 board — was being reused by the gameplay
highlighting logic too, so selecting any cell on a Band 1 puzzle lit up
the **entire board** as "related." On a tiny puzzle with only 1-2 empty
cells, that visually pointed at exactly where the remaining values go —
not a solution leak (no digit or correctness color was ever shown), but
a real, confirmed bug that made the puzzle needlessly easy. Fixed by
giving `BoardConfig` two separate fields — `box` (render-only) and
`constraintBox` (the actual Sudoku rule) — and pointing the highlighting
logic at the correct one. A regression test
(`tests/BoardConfigBoxFix.test.ts`) reproduces the old buggy math
directly to prove the fix is real, not just asserted.

**One official attempt per player per grade band.** Since every
challenge is now Official by default (Mode Select was removed), a real
player name is required before starting one — enforced with an inline
error on Grade Select, not a redirect from a screen that no longer
exists. When a player selects a grade, `GradeSelectScreen` checks
`AttemptManager.getRecordedAttempt(name, band)` first: if they've
already completed that band officially, they're taken straight to
their existing Results screen (with a "you've already completed this"
note, no re-earned sound/animation) instead of being allowed to play
again. `AttemptManager` (`src/competition/AttemptManager.ts`) keys
attempts by normalized name (trimmed, lowercased) + grade band, and — as
with every other localStorage module here — this is an honest,
client-side-only identity check, not real authentication: two different
people who type the same name will share a slot. The first recorded
attempt always stands; a second `recordAttempt()` call for the same
identity is a no-op. 12 new tests cover recording, lookup, per-band and
per-player isolation, empty-name handling, malformed-storage recovery,
and the full GameState-level flow (including that practice completions
are never recorded as an official attempt).

## Technology Stack

- Vite · TypeScript (strict, `erasableSyntaxOnly`) · Three.js (unchanged
  from Build 01) · Vitest · Plain HTML/CSS, no frameworks, no backend

## Installation / Development / Build / Tests

```
npm install
npm run dev          # local dev server
npm run build         # tsc + vite build -> dist/
npx tsc --noEmit      # type-check only
npm run test          # 176 automated tests
```

## What Changed in Build 02A

All corrections were made to **puzzle data only** — the engine
(`SudokuEngine`, `SudokuSolver`, `PuzzleValidator`, `CandidateManager`,
`PuzzleConstraints`) is completely unchanged from Build 02, remains one
generic implementation with zero band-specific branches, and BUILD 01's
`BoardScene`/`CameraManager`/`InputManager`/responsive/panning system was
not touched. Full before/after/why documentation for every changed band
lives in `src/puzzle/PuzzleRepository.ts` — this section summarizes it.

**Band 2 (Grades 3–4) — corrected.** The spec's declared solution was only
a Latin square (box (0,0)-(1,1) held `{1,2,2,1}`, not four distinct
values) and its givens conflicted under real 2×2-box rules — confirmed
unsolvable (0 solutions). A fresh 2×2-box 4×4 puzzle was constructed:
a hand-verified valid solution, with givens built by adding clues
(row-major) until the solver confirmed uniqueness — 10 of 16 cells given,
appropriately generous for Grades 3–4.

**Band 3 (Grades 5–6) — corrected.** Original givens were solvable but not
unique (solver found 2+ completions). Every original given was preserved;
4 additional clues (taken from the spec's own declared solution, never
invented) were added at (0,1), (0,3), (0,5), (1,0) until the solver
confirmed uniqueness — 22 of 36 cells given (was 18).

**Band 4 (Grades 7–8) — corrected.** Same underlying issue as Band 3.
Rather than inventing new clues, Band 4's corrected givens are a genuine
**subset** of Band 3's corrected 22-given grid — built by starting from
Band 3's grid and removing exactly the clues Band 4 didn't originally
have, one at a time, keeping each removal only while uniqueness held.
Result: 15 of 36 cells given — strictly fewer than Band 3's 22, preserving
the intended Band 3 → Band 4 difficulty progression, unique.

**Band 5 (Grades 9–10) — unchanged.** Already valid/solvable/unique;
re-verified, still passes.

**Band 6 (Grades 11–12) — corrected.** Confirmed: the classic Arto Inkala
givens have exactly one solution under *standard* Sudoku rules, but the
spec's required diagonal (X-Sudoku) constraint on those same givens leaves
*zero* solutions — the two requirements are mutually incompatible as
specified, not fixable by tweaking a few Inkala clues. Per instructions,
the diagonal rule was **not** dropped, ignored, or special-cased. Instead:
this project's own solver found a full valid grid satisfying row + column
+ box + both diagonals, which was then reduced to a sparse 19-of-81-given
puzzle by removing cells one at a time, keeping each removal only while
uniqueness held under the full rule set. As confirmation the diagonal rule
is genuinely load-bearing (not decorative): the same 19 givens have **two**
solutions with the diagonal rule off, and exactly **one** with it on.

**Temporary "unavailable" handling removed.** Build 02's graceful
`puzzle:unavailable` fallback (grade-select inline message, no crash) was
necessary while Bands 2/6 were broken. Now that every band is genuinely
valid, that machinery has been removed — `GameState.selectGrade()` no
longer needs a try/catch, and `GradeSelectScreen` navigates directly, per
the Build 02A data-audit instruction not to leave temporary fallback code
in place once the underlying data is fixed.

## Puzzle Validation Table

| Band | Size | Boxes | Diagonals | Solutions | Unique | Status |
|---|---|---|---|---|---|---|
| 1 | 3×3 | 1×3† | — | 1 | ✅ | unchanged |
| 2 | 4×4 | 2×2 | — | 1 | ✅ | **corrected** |
| 3 | 6×6 | 2×3 | — | 1 | ✅ | **corrected** |
| 4 | 6×6 | 2×3 | — | 1 | ✅ | **corrected** |
| 5 | 9×9 | 3×3 | — | 1 | ✅ | unchanged |
| 6 | 9×9 | 3×3 | both | 1 | ✅ | **corrected** |

† Band 1's engine box is a degenerate 1×3 row-box (redundant with the row
rule) — a real box constraint can't cover more cells than there are
values, so a "3×3 box = whole grid" reading is mathematically impossible
for a 3-value puzzle. Rendering still shows a bold outer border only, via
`boardAdapter.ts`'s render-vs-constraint box distinction (see Build 01).

## Grade → Band Mapping (all 12 grades now load successfully)

Grades 1–2 → Band 1 (3×3) · 3–4 → Band 2 (4×4) · 5–6 → Band 3 (6×6) ·
7–8 → Band 4 (6×6, fewer givens) · 9–10 → Band 5 (9×9) · 11–12 → Band 6
(9×9 + diagonals).

## Engine Architecture (unchanged from Build 02)

```
PuzzleRepository (data) → SudokuEngine (rules + state) ←→ Solver/Validator/CandidateManager
    → boardAdapter (translation) → GameState → BoardScene/InputManager/GameHUD (Three.js/DOM, untouched)
```

`SudokuEngine` has zero band-specific branches — one generic
implementation handles all six bands via `PuzzleDefinition` data
(`size`, `boxRows`, `boxCols`, `diagonal`), confirmed by a project-wide
search for `if (band ===` (none found).

## The Central Rule: Structural Legality ≠ Solution Match

`isValueAllowed()` checks only the current board's constraints, never the
hidden solution. A locally-legal-but-solution-wrong value is accepted and
stays on the board with no feedback. See `tests/SudokuSolverAndValidator.test.ts`,
"Test group 10", still passing unchanged from Build 02.

## Build 03 — Dead End / Delayed-Consequence System

**What a Dead End means.** The board is incomplete, but at least one
empty cell has zero legal candidate values left — the current path
cannot be completed as-is. This is distinct from both normal play (every
empty cell has ≥1 candidate) and a valid completion (board full and
matches the hidden solution). A puzzle that reaches a valid completion is
never classified as dead-end, and a dead-end board is never treated as
complete — `GameState.updatePuzzleState()` checks completion **first**,
and only runs the Dead End scan when the board is genuinely incomplete.

**How zero candidates trigger it.** `DeadEndDetector.detect(engine)`
scans every empty cell and asks the existing `CandidateManager` "what's
still legal here?" (row/column/box/diagonal against the *current* board).
If any empty cell comes back with zero candidates, that's a Dead End. No
new rules engine, no duplicated constraint logic — it's a thin, stateless
wrapper around infrastructure Build 02 already built.

**Why the hidden solution is never used for immediate feedback.** The
entire point of Logic Grid is that a locally legal move can be globally
wrong without the player being told immediately. `DeadEndDetector` never
looks at `PuzzleDefinition.solution` — it can't, because it never receives
it; it only ever calls `engine.isValueAllowed()`/`CandidateManager`,
which are themselves solution-blind by construction (see Build 02's
central rule above). `SudokuEngine.matchesSolution()` remains the *only*
place the solution is consulted anywhere in the codebase, and it's called
only for completion classification, never for per-move feedback.

**Illegal moves vs. Dead Ends — kept distinct.** A structurally illegal
placement (duplicate in row/column/box/diagonal) is rejected outright by
`SudokuEngine.setCell()`: the board doesn't change, nothing is recorded,
and this is **not** a Dead End — it never even reaches
`DeadEndDetector`. A Dead End can only be reached through a chain of
individually-legal moves.

**How affected cells are identified.** `DeadEndResult.cellsWithoutCandidates`
is a plain list of `{row, col}` coordinates — never values, never a
"which move was wrong" judgment. These are the cells where the
contradiction is currently visible, not necessarily where the original
mistake happened; the game deliberately does not (and, using only this
detector, structurally *cannot*) identify the historical bad move. That
investigation is Build 04's Trace Back.

**Move history.** Every successful `setCell`/`clearCell` call on
`SudokuEngine` appends a `MoveRecord` (`{moveId, row, col, previousValue,
newValue, order, playerEntered}` — the type Build 02 already stubbed,
reused as-is) to an internal, chronological list, retrievable via
`getMoveHistory()`. Givens are never recorded (they're not player moves);
rejected/illegal attempts are never recorded (the push only happens after
a successful mutation). Not consumed by any rollback logic yet — this is
purely the foundation Build 04 needs.

**Presentation.** When `puzzleStatus` becomes `"dead-end"`: a small,
restrained orange banner appears below the HUD's top bar ("DEAD END —
This path can no longer be completed. Review your recent moves."); the
affected cells get a subtle orange emissive glow with a gentle pulse
(`three/BoardScene.ts`); the value palette and Clear button are disabled
(input is locked, per spec, until Build 04's Trace Back exists); and an
`AudioManager.play("dead-end")` hook fires (placeholder, no asset yet).
None of this touches `CameraManager`, `InputManager`, the pan system, or
the overall holographic visual language — it's an additive HUD/board-state
layer only.

**Trace Back was a placeholder through Build 03.** Build 04 replaces the
placeholder with real functionality — see below.

## Build 04 — Trace Back / Rollback Mechanic

**What Trace Back does.** Reverses the single most recent successful
player move (placement or clear), restoring the affected cell to
whatever it held immediately before that move. It operates entirely on
real Sudoku game state via `SudokuEngine`/move history — never on
browser history, DOM undo, or any generic action stack.

**How it's implemented.** `SudokuEngine.rollbackLastMove()` pops the last
`MoveRecord` (the exact type Build 03 already defined — reused, not
duplicated) off the move history and writes `previousValue` directly
into the board. It deliberately bypasses `setCell()`/`clearCell()`
entirely: going through either would push a *new* history entry for
what is fundamentally an undo, which would violate the requirement that
Trace Back never creates history entries of its own (verified by
`tests/TraceBack.test.ts`, "Test group 7"). No re-validation against
Sudoku rules is needed either — a value that was legal when placed can't
become newly illegal by being removed.

**Recovery is re-evaluated fresh every time, never assumed.**
`GameState.traceBack()` calls the exact same `updatePuzzleState()` every
other mutation uses — completion check first, then a fresh
`DeadEndDetector` scan. This is what correctly handles both "one Trace
Back was enough" and "the dead end remains, keep tracing back" (spec
§13): each call is a genuine re-scan of current board state, not a
decrement of some assumed fixed number of required rollbacks. Covered by
`tests/TraceBack.test.ts`, "Test groups 9/10", including a scenario where
the dead end survives one rollback and only clears after several.

**Dead End + Trace Back interaction.** Placement and clearing remain
locked while `puzzleStatus === "dead-end"` (Build 03's rule, unchanged),
but `traceBack()` has no such guard — it's the one action still allowed
during a dead end, exactly as specified. The HUD reflects this: the
palette and Clear button are disabled during a dead end, but the Trace
Back button stays enabled as long as there's a traceable move.

**Given-cell protection.** Structurally guaranteed, not just checked:
`setCell`/`clearCell` both reject given cells *before* ever pushing a
history record, so there is no code path by which a given could enter
`moveHistory` in the first place — `rollbackLastMove()` can only ever
touch a coordinate that was already a successful player mutation.

**Solution protection.** `MoveRecord` and the `"move:rolledback"` event
both carry only coordinates and values the player themselves placed —
never the hidden solution. `SudokuEngine.matchesSolution()` remains the
only method that ever reads `PuzzleDefinition.solution`, and Trace Back
never calls it for anything beyond the same post-mutation completion
check every other move already goes through.

**Fixed along the way:** `GameState.updatePuzzleState()` previously only
emitted `"puzzle:status"` when entering completion or a dead end (fine
for Build 03, where the only transitions *into* those states mattered).
Build 04 needs the event on *every* call, including recovering from
dead-end back to in-progress via Trace Back — otherwise the HUD would
never learn a rollback resolved things. Now emits unconditionally after
every mutation; the one existing Build 03 test that assumed the old
narrower behavior was updated to match (see `tests/GameState.test.ts`).

**UI.** The existing Build 01 Trace Back button is unchanged in
placement/styling — same holographic pulse on press, same terminology.
It's simply wired to `GameState.traceBack()` now instead of an inert
placeholder event, and its `disabled` state tracks
`GameState.canTraceBack()` (true whenever move history is non-empty).
No new screens, no modal, no "you were wrong" messaging — the player
only sees the board state move backward.

**Not implemented (correctly, per scope):** no scoring or penalty for
using Trace Back (a non-scoring `traceBackCount` counter is tracked
internally, per spec §42's "may expose... if required", but never
displayed), no timer interaction (there is no timer), no automatic
identification of which historical move was the actual mistake — Trace
Back only ever removes moves in strict reverse chronological order.

## What Is Intentionally NOT Implemented Yet

Final audio assets (placeholder hooks only — see Build 06 below for the
full hook set), server/cloud leaderboard, multiplayer, timer
(deliberately excluded — the game is untimed by design).

## Build 05 — Complete Competition Gameplay + Scoring + Results + Polish

**Competition flow.** Grade Select now leads to Mode Select (Practice vs.
Official Challenge) → Challenge Briefing → Gameplay → (on genuine
completion) Results → optionally Leaderboard. `GameState.startChallenge(mode)`
always produces a fresh `SudokuEngine` instance for the current grade —
move history, Trace Back count, confirmed mistakes, Dead End state, and
`lastResult` are all genuinely reset, not just zeroed on top of stale state.

**Candidate visual safety (the concern flagged going into this build).**
Re-verified before touching anything: the 3D board's highlighting was
already purely structural (selected/related/given/dead-end) — it never
rendered a per-value "this is legal" glow. Legality is communicated only
by the palette button's `disabled` attribute, styled identically for
every legal value regardless of whether it happens to be the actual
solution. No changes were needed here; the palette redesign (skin-aware
labels, competition styling) preserves this exactly.

**Mistake definition (documented, since the spec left it open).** A
"confirmed mistake" is counted **once per distinct Dead End event** —
i.e., each time the puzzle transitions from non-dead-end into dead-end —
not once per Trace Back spent resolving it, and not for every illegal
attempt (those are simply rejected, as always). This interpretation is
documented directly in `GameState.ts` next to the `confirmedMistakes`
field.

**Scoring engine** (`src/scoring/ScoringEngine.ts`, pure, no Three.js/DOM):
```
baseScore        = 1000
mistakePenalty   = confirmedMistakes * 100
traceBackPenalty = max(0, traceBackCount - 2) * 25       (2 free Trace Backs)
efficiencyRatio  = 2 / max(traceBackCount, 2)
efficiencyBonus  = round(200 * efficiencyRatio)           (0-200, clamped)
finalScore       = max(0, base - mistakePenalty - traceBackPenalty + efficiencyBonus)
```
Max theoretical score: 1200. Rating bands (presentation-only, never fed
back into the score): 1000+ ELITE, 850-999 EXCELLENT, 700-849 STRONG,
500-699 DEVELOPING, 0-499 KEEP PRACTICING.

**Practice vs. Official** (`src/results/ResultManager.ts`). Both modes
compute and display a score (so a practice player can see how they'd
have done), but only a **completed** (board full and matches the hidden
solution) **official** session ever touches `LeaderboardManager` or
`PersonalBestManager`. Verified directly: practice sessions and
incomplete official attempts leave both stores untouched.

**Badges** (`src/badges/BadgeManager.ts`, pure): FIRST GRID (first
official completion — the caller supplies this via
`LeaderboardManager.hasAnyCompletion()`, since BadgeManager itself has no
persistence), CLEAN LOGIC (zero confirmed mistakes), TRACE MASTER (≤2
Trace Backs), PRECISION PLAYER (≥90% efficiency), LOGIC GRID ELITE (Elite
final score). Badges are evaluated only for completed official sessions.

**Leaderboard & Personal Best** (`src/competition/`). LocalStorage-backed
under `logicGrid.leaderboards` and `logicGrid.personalBest`, isolated per
grade band (never mixes Band 1 with Band 12), top-10-per-band, sorted by
score desc → mistakes asc → Trace Backs asc (never time — the game stays
untimed). **A real bug was found and fixed while testing**: malformed
stored data shaped as a JSON array (rather than an object) passed the
original `typeof === "object"` check (since `typeof [] === "object"`)
and crashed downstream; both managers now explicitly reject arrays and
fail gracefully back to an empty store.

**Skins** (`src/skins/SkinManager.ts`) — Number/Letter/Symbol display
mapping over the same one puzzle; switching skin never touches the
engine, solution, constraints, or score. Letter sets verified for all
six bands (CAT, LOVE, PLANET, GARDEN, COMPUTERS, DISCOVERY). **Two
genuine data gaps found and honestly reported, not papered over**: the
source spec's Band 4 symbol set has only 5 symbols for a 6-value puzzle,
and Band 5's has only 8 for a 9-value puzzle. Both fall back to the
Number skin rather than shipping a misaligned or invented symbol —
`isSkinAvailable()` reports this so the HUD can grey out the option.

**Results screen** — reads the one `GameState.lastResult` object built
exactly once by `finalizeResult()` at the moment of genuine completion
(guarded against double-submission if the player navigates back and
forth); never recalculates the score itself. Shows the full breakdown
(base/mistake penalty/Trace Back penalty/efficiency bonus/final),
rating, badges earned, and — for official sessions — personal best and
local leaderboard rank.

**Leaderboard screen** — per-band table (rank/player/score/mistakes/Trace
Backs), explicitly labeled as a local leaderboard, never claiming a
global rank it can't back up.

**Competition HUD** — grade, mode (PRACTICE/OFFICIAL), live
mistakes/Trace Backs counters, and a skin selector (auto-disabled for
Band 4/5 symbol, per the gap above) added to the existing Build 01/03/04
HUD without touching `CameraManager`, `InputManager`, or the mobile pan
system.

**"Grid full" state.** A full-but-incorrect board (`complete-invalid` —
architecturally possible since Build 02/03 but never previously surfaced
in the UI) now shows a small neutral banner ("GRID FULL — Some
placements may need review. Use Trace Back or Clear to continue.")
instead of silently doing nothing. This is not a Dead End (no empty
cell can have zero candidates when the board is full by definition) and
does not lock input — the player can keep using Trace Back/Clear.

**What was scoped down, disclosed rather than silently skipped:**
keyboard cell-navigation was not added (mouse/touch only, matching every
prior build); the score-reveal and badge presentation use simple CSS
transitions rather than an elaborate animation sequence; accessibility
work was limited to using semantic buttons/labels and sufficient
contrast rather than a full ARIA/focus-management pass.

## Known Testing Limitations

- `npx tsc --noEmit`, `npm run test` (150/150 — 83 regression + 67 new
  Build 05 tests), `npm run build` all pass from a fully clean reinstall.
- All 12 grades were verified end-to-end through the **real `GameState`
  class**: correct band/size, correct skin availability per band
  (confirming the two documented gaps), a full official
  challenge→score→badges→leaderboard→personal-best cycle, and confirmed
  practice mode never persists — via a standalone script exercising the
  actual shipped code, not a re-implementation.
- A real bug (the JSON-array storage crash above) was caught by these
  automated tests before shipping, not left for manual discovery.
- **Real browser/visual/touch verification still could not be performed**
  in this sandbox (no installable Chrome/Chromium — same limitation
  disclosed in every prior build). Please verify in an actual browser:
  the full competition flow end-to-end (mode select → briefing →
  gameplay → dead end → trace back → completion → results →
  leaderboard); the results/leaderboard panels don't overflow on mobile;
  the skin selector's disabled state is visually clear for Bands 4/5
  symbol; and the existing Build 01 responsive/panning behavior is
  unaffected.

## Build 06 — Final Competition Polish, UX, Accessibility & QA

**Keyboard navigation (mandatory, not optional).** Arrow keys move the
selected cell — stepping automatically over given cells rather than
landing on one and appearing to do nothing, wrapping at board edges —
number keys place the corresponding value, Backspace/Delete clears.
Every keyboard action calls the exact same `GameState` API mouse/touch
input uses (`selectCell`/`placeValue`/`clearSelectedCell`), so it is
structurally impossible for a keyboard action to bypass given-cell
protection, structural legality, or the Dead End input lock. The
movement math is extracted into a pure `computeNextSelection()` function
(`src/input/keyboardNav.ts`), directly unit-tested (9 tests) rather than
only exercised indirectly through DOM events.

**A genuine performance fix.** `BoardScene`'s glyph-update path was
rebuilding the *entire* board — every cell's geometry and material —
on every single placement, clear, and Trace Back. Replaced with
`updateCellGlyph()` (touches only the one changed cell's glyph mesh) and
`refreshAllGlyphTextures()` (a skin change swaps existing textures in
place rather than rebuilding geometry). This was a real, measurable
inefficiency, not a hypothetical one — exactly the class of bug Build 06
§55 asked to be found and fixed.

**Focus states.** Global `:focus-visible` styling (cyan outline + glow,
orange variant for the value palette) — visible only for keyboard/
programmatic focus, so mouse users don't see a ring on every click while
keyboard users always get a strong, unambiguous indicator. Never
color-only: outline + offset + glow together.

**Reduced motion.** A single `prefers-reduced-motion: reduce` media
query collapses all animation/transition durations to near-zero
globally, and the results screen's score count-up explicitly checks
`matchMedia` and jumps straight to the final value when reduced motion
is requested.

**Screen reader support.** A new `src/ui/liveRegion.ts` provides one
polite and one assertive ARIA live region. Wired into gameplay for: Dead
End (assertive — "Dead End reached... Use Trace Back..."), recovery
("Path restored. You may continue."), completion ("Puzzle completed.
Your result is ready."), per-cell selection ("Row 3 column 5. Empty."),
and into the results screen (final score, rating, personal best, badge
count — read immediately, not counted digit-by-digit). `aria-label`s
were added throughout: palette buttons, skin buttons (including *why*
one is disabled — "Symbol display — not available for this grade"),
Trace Back, Clear, Exit, pan controls, and leaderboard rows.

**Skin UX correction.** An unavailable skin (Band 4/5 Symbol — see the
Build 05 data-gap note above) is disabled with an explicit `title`/
`aria-label` explaining why, rather than a bare disabled button with no
explanation.

**Leave-Challenge confirmation.** Exiting an active Official session now
shows a custom, accessible `role="alertdialog"` modal ("LEAVE
CHALLENGE? Your current official attempt will not be completed.") with
Escape-to-close and focus management — never a browser `confirm()`.
Practice sessions and already-completed sessions exit immediately, no
modal needed.

**Score reveal.** An ease-out count-up animation in `ResultsScreen`,
presentation-only — the actual score was already final before the
animation starts (an `sr-only` span carries the real value immediately
for screen readers), and the animation is skipped entirely under
reduced motion. No score is ever animated toward a value the
`ScoringEngine` didn't actually produce.

**Badge reveal.** A short staggered fade/scale-in per badge chip
(`animation-delay` per index), an achievement sound cue, and a combined
result announcement mentioning badge count — collapses to an instant,
non-animated reveal under reduced motion via the same global media
query.

**Official-mode name validation.** Starting an Official Challenge with
an empty player name is now blocked with an inline, accessible error
message ("Please enter your name before starting an Official
Challenge.") — Practice remains unaffected, matching Build 01's original
"optional for practice" design intent while satisfying the spec's "do
not allow an empty official player name."

**Leaderboard presentation.** Each row now carries a full
`aria-label` sentence ("Rank 1. Alex. Score 1100. Zero mistakes. Two
trace backs.") for screen readers, and the current player's just-earned
result is visually and textually tagged "YOU" when it appears on the
board they're viewing.

**What was scoped down, disclosed rather than silently skipped:** a
dedicated reusable toast/notification component was not built — the
existing HUD banners and ARIA live region cover the required feedback
moments (move recorded implicitly via the board update, path restored,
badge earned) without adding a new UI primitive; a full 200%-zoom and
multi-browser visual QA pass was not performed (see below); the
transition system stayed CSS-based (existing `panel-in`/`score-reveal`/
`badge-reveal` keyframe animations) rather than a new
`src/effects/Transitions.ts` abstraction, since the existing per-screen
CSS animations already satisfy the duration/easing guidance without
adding an indirection layer that nothing else needed yet.

## Known Testing Limitations (Build 06)

- `npx tsc --noEmit`, `npm run test` (159/159 — 150 regression + 9 new
  Build 06 keyboard-navigation tests), `npm run build` all pass from a
  fully clean reinstall.
- Keyboard navigation was verified across all six bands and all 12
  grades via both direct unit tests of the pure movement function and a
  standalone integration script driving the real `GameState`/
  `computeNextSelection` pairing — including confirming that Bands 2/3's
  row 0 (entirely given, an artifact of the Build 02A uniqueness fix)
  correctly returns "nowhere to go" for pure horizontal movement rather
  than silently misbehaving.
- **Real browser/visual/accessibility QA (screen reader, 200% zoom,
  multi-browser) could not be performed** in this sandbox — no
  installable Chrome/Chromium, same limitation disclosed in every prior
  build. All ARIA/focus/reduced-motion work is implemented per spec and
  code-reviewed, but has not been confirmed with an actual screen reader
  or at 200% browser zoom. Please verify: keyboard-only play from Home
  through Results; a screen reader announces cell selection, Dead End,
  and the final result; focus rings are visible and never color-only;
  reduced-motion settings visibly calm the interface; and the leave-
  challenge modal traps focus sensibly.
