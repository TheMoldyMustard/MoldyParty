# MoldyParty system redesign implementation plan

## 1. Decision summary

Redesign the current single-game experience as a cohesive, stable pass-the-device flow while keeping the existing React/Zustand architecture and finite game lifecycle. This is an incremental UI refactor, not a navigation rewrite.

The work addresses five reported problems:

1. Replace the Impostor-specific landing-page motto with product-level copy that can accommodate future games.
2. Make Round rules a predictable, grouped layout whose rows do not shift when optional settings are enabled.
3. Make every category card occupy the same grid track and remain readable at desktop and mobile widths.
4. Return users to Build your round after a successful custom-pack import, with the imported pack selected when possible.
5. Replace hold-to-reveal with an upward drag gesture that reveals long words without horizontal overflow and preserves privacy safeguards.

Recommendation: implement these changes in the existing screen/view structure, with small callback and state additions where needed. Defer a full route registry or multi-game catalog until a second game has concrete metadata and an entry flow.

## 2. Scope, non-goals, permissions, and assumptions

### In scope

- `home`, `lobby`, and `packs` view transitions in `src/App.tsx`.
- Landing-page copy and game-card structure in `src/App.tsx` and `src/styles.css`.
- Lobby grouping and layout stability in `src/features/game/LobbyScreen.tsx` and `src/styles.css`.
- Equal-height category cards in `src/features/game/CategoryPicker.tsx` and `src/styles.css`.
- Import completion callback and selection handoff in `src/features/packs/PackManager.tsx`, `src/features/game/LobbyScreen.tsx`, and `src/App.tsx`.
- Private role reveal interaction and long-word wrapping in `src/features/game/RoleRevealScreen.tsx` and `src/styles.css`.
- Unit, component, and Playwright coverage for the changed behavior.

### Out of scope

- Adding another game.
- Replacing Zustand, Dexie, React, or the existing phase model.
- Changing role assignment, voting, timer, pack schema, persistence version, or domain rules.
- Replacing the browser history/router model; the app currently uses local view state.
- New visual branding, illustrations, or a full design-system extraction.

### Assumptions / builder calls

- The landing page should describe MoldyParty as a collection of offline party games, while Impostor remains the only playable card for now.
- “Redirected to Build your round” means a successful import returns to the lobby and makes the imported pack the selected category; the pack remains persisted in IndexedDB.
- “Drag up to reveal” means a player starts near the lower portion of the reveal surface and swipes upward past a threshold. The role becomes visible after the threshold and stays visible until “I’ve seen my role” or a privacy-loss event masks it. A keyboard-accessible reveal fallback remains available.
- Long words must wrap inside the role card and be visually bounded; no horizontal scrolling or clipping is acceptable.
- Existing privacy behavior remains invariant: blur, pointer cancellation, hidden document, and restored persisted rounds mask secrets.

## 3. Current-state evidence ledger

| Finding | Status | Evidence | Consequence |
|---|---|---|---|
| The home screen is branded around one game and uses “Pass it. Bluff it. Find them.” | Confirmed | `src/App.tsx`, `AppContent`, `.brand-lockup` | Copy and card structure need to be generalized without blocking the current launch game. |
| The app uses local view state for `home`, `lobby`, and `packs`. | Confirmed | `src/App.tsx`, `type AppView` | A callback can redirect after import without introducing a router. |
| Outlier hint is conditionally rendered as a grid child only when Outlier is enabled. | Confirmed | `src/features/game/LobbyScreen.tsx`, rules JSX | Insertion changes grid placement and causes vertical reflow. |
| Round rules currently mix selects, switches, and conditional timer fields in one two-column grid. | Confirmed | `LobbyScreen.tsx`, `.rule-grid` in `src/styles.css` | Grouped sections and reserved slots are needed for scanability and stability. |
| Category cards use fixed column counts but only `min-height`. | Confirmed | `CategoryPicker.tsx`, `.category-grid`, `.category-option` | Equal grid tracks and flex/grid card internals are needed for consistent size. |
| Pack import saves the pack, clears the editor, refreshes storage, and stays in `PackManager`. | Confirmed | `src/features/packs/PackManager.tsx`, `importPack` | Import needs a completion callback carrying the imported pack id. |
| Lobby loads custom packs independently from `PackManager`. | Confirmed | `LobbyScreen` effect calls `packRepository.list()` | Redirect should either preserve the selected id and let lobby reload, or pass the pack id through app state. |
| Role reveal is pointer-down to show and pointer-up/leave/cancel/blur to hide. | Confirmed | `src/features/game/RoleRevealScreen.tsx` | Gesture semantics and tests must change together; privacy event masking remains. |
| Role content has no explicit word-break/overflow constraint. | Confirmed | `.role-card strong` in `src/styles.css` | Long secret words can exceed the reveal surface on narrow devices. |
| Existing tests assert the current hold interaction and copy. | Confirmed | `src/features/game/GameFlow.test.tsx`, `e2e/game-flow.spec.ts` | Tests are contract consumers and must be updated, not left as stale selectors. |

## 4. End-to-end impact and consumer map

### Landing and setup flow

`AppContent` owns the top-level view. The home card opens `LobbyScreen`; the lobby passes `onManagePacks` into `CategoryPicker`; the current callback changes the view to `packs`; the pack page has a back button that returns to `lobby`.

Planned flow:

`home → lobby → packs → successful import → lobby with imported pack selected`

The import callback is a UI contract only. Pack persistence remains owned by `packRepository`; game setup still resolves the selected id from the lobby's combined built-in/custom pack list.

### Setup layout

`LobbyScreen` owns the draft fields and constructs `GameSetupInput` on submit. `validateSetup` and `createRound` remain unchanged. The redesign changes layout and presentation only, except for ensuring that `outlierHintsEnabled` remains false when Outlier is disabled.

### Reveal flow

`RoleRevealScreen` owns the transient gesture state and calls existing store commands: `showRole`, `hideRole`, and `confirmRole`. No domain or persistence schema changes are required. `GameFlow.test.tsx` and `e2e/game-flow.spec.ts` are direct consumers of the reveal control's accessible name and pointer behavior.

## 5. Conflicts, invariants, risks, and design options

### Important invariants

- Role content must never remain visible after blur, pointer cancel, document visibility loss, or round restoration.
- The selected pack id must resolve to a persisted pack after redirect; if the pack disappears before lobby load, fall back to the first available pack.
- The lobby must still support three or more players, optional timer, Jester, Outlier, hints, and Absolute Voting without altering validation.
- Category cards must remain usable with an arbitrary number of built-in and custom packs.
- The drag interaction must not prevent page scrolling outside the reveal surface.

### Design options considered

1. **Incremental refactor (selected):** retain local view state and existing components; add stable layout wrappers, import callback, and gesture logic. Lowest risk and directly matches current boundaries.
2. **Explicit route model:** replace `AppView` with a route state object and shared setup shell. Better future navigation semantics, but not justified before a second game exists.
3. **Full game catalog:** introduce a data-driven game registry and “coming soon” cards now. More future-proof visually, but expands scope into product/catalog decisions not represented by current domain or tests.

## 6. Recommended implementation design

### 6.1 Landing page

- Replace the Impostor-specific eyebrow with product copy such as “Offline party games for suspicious friends.”
- Keep MoldyParty as the primary title and describe the experience broadly.
- Treat the existing Impostor card as the first game card; use neutral “Play” / “Set up a round” language rather than a slogan tied to one mechanic.
- Keep the current card accessible name and click target stable enough for existing user journeys, updating test selectors only where the visible copy changes.
- Preserve the current responsive split card, but make the card container a reusable visual pattern so a later second card can be added without restructuring the home shell.

### 6.2 Round rules layout

Replace the flat `rule-grid` with explicit groups:

- **Roles:** Impostors, Jester, Outlier.
- **Hints:** Impostor hints and Outlier hint.
- **Discussion:** Discussion timer and timer minutes.
- **Voting:** Absolute Voting.

The Outlier hint should be rendered in a stable reserved row/slot. When Outlier is disabled, the slot remains present but disabled or visually muted with explanatory text; it must not be conditionally inserted into the grid. Timer minutes should use the same stable-slot approach when the timer is off, or move into the timer control's own sub-layout so enabling it does not reorder unrelated settings.

Implementation should prefer semantic fieldsets/legends or equivalent labelled group containers, and keep each switch row as a consistent two-column label/control surface. On mobile, groups collapse to one column while preserving the same order.

### 6.3 Category cards

- Use a responsive grid with `grid-auto-rows: 1fr` or an equivalent equal-track strategy.
- Make each `.category-option` stretch to its grid area and use a consistent internal layout: icon, name, metadata.
- Ensure long pack names wrap rather than change the card height or overflow.
- Keep the selected state and radio input semantics unchanged.
- Add a responsive minimum card height only as a fallback; equality must come from the grid track, not content-dependent height.

### 6.4 Import redirect

- Extend `PackManagerProps` with an optional `onImported(packId: string)` callback.
- In `importPack`, persist the parsed pack, refresh local saved-pack state, then invoke the callback with the imported pack id after the write succeeds.
- In `App.tsx`, keep the selected pack id in a small handoff value or lobby draft seed, set the app view to `lobby`, and pass the id into `LobbyScreen`.
- In `LobbyScreen`, initialize or update the draft selection from the handoff id after custom packs load, only if that id exists in the combined pack list.
- Show a short success status in the lobby (or preserve an accessible status message across the redirect) so users know the pack was imported and selected.
- Do not redirect on parse failure or storage failure; keep the user on the import form with the error visible.

### 6.5 Drag-up reveal

- Replace the current hold-only pointer handlers with a pointer gesture state: initial Y, active pointer id, and whether the upward threshold has been crossed.
- Begin tracking only on pointer down inside the reveal surface; use pointer capture so the gesture remains reliable if the finger moves slightly outside the control.
- Reveal after an upward movement threshold (builder default: 56 CSS pixels, configurable as a constant). Ignore downward or mostly horizontal movement.
- Once revealed, keep the role visible until confirmation or privacy-loss events. Preserve the existing “I’ve seen my role” action as the explicit completion control.
- Change the instruction copy and accessible label to “Drag up to reveal your role,” with a keyboard fallback such as Enter/Space to reveal.
- Keep `touch-action` scoped to the reveal control so the rest of the page can scroll normally.
- Add `overflow-wrap: anywhere`, `word-break: break-word`, and a bounded text width to `.role-card strong`; long words should wrap within the card.
- Keep the existing blur, `pointercancel`, and `visibilitychange` masking listeners. Do not use a global pointer-up handler to re-hide the role after the new gesture completes.

## 7. Ordered implementation phases and owners

### Phase 1 — Shared layout and landing copy

Owner: UI shell (`src/App.tsx`, `src/styles.css`).

- Introduce the generalized landing copy and slightly more reusable game-card markup.
- Add layout tokens/classes for stable content widths, headings, grouped setup sections, and equal card tracks.
- Verify desktop and narrow mobile layouts before changing behavior.

### Phase 2 — Setup rules and category picker

Owner: Lobby UI (`LobbyScreen.tsx`, `CategoryPicker.tsx`, `styles.css`).

- Refactor Round rules into semantic groups.
- Reserve conditional rows for Outlier hint and timer minutes.
- Make category cards equal-height and robust to long names.
- Preserve all existing draft fields and submit payloads.

### Phase 3 — Import handoff

Owner: Pack flow (`PackManager.tsx`, `App.tsx`, `LobbyScreen.tsx`).

- Add `onImported` callback and redirect behavior.
- Carry the imported id into lobby initialization.
- Add success and failure states that are screen-reader observable.

### Phase 4 — Reveal gesture and overflow safety

Owner: Private reveal (`RoleRevealScreen.tsx`, `styles.css`).

- Implement pointer-captured upward drag threshold.
- Keep keyboard fallback and privacy masking.
- Update instruction copy and constrain long words.

### Phase 5 — Verification and polish

Owner: Test suite and UI QA (`GameFlow.test.tsx`, `e2e/game-flow.spec.ts`, new focused tests as needed).

- Update existing hold-to-reveal tests to drag semantics.
- Add setup layout behavior tests for Outlier/timer toggles.
- Add import redirect/selection coverage.
- Run lint, unit/component tests, build, and Playwright desktop/mobile journeys.
- Inspect the built app at representative widths: 320px, 375px, 768px, and desktop.

## 8. Verification matrix and acceptance criteria

| Area | Verification | Acceptance criteria |
|---|---|---|
| Landing | Component test + visual QA | Copy is product-level; Impostor remains launchable; no slogan implies it is the only game. |
| Rules layout | Component test toggling Outlier and timer | Enabling/disabling options does not shift unrelated groups or change control order; all controls remain labelled. |
| Categories | Component test with long and short pack names + responsive QA | Cards share equal height within a row/track; names wrap; selected state remains obvious. |
| Import | PackManager/Lobby integration test | Valid import persists, returns to Build your round, selects the imported pack, and exposes success status. Invalid import stays on import view with an error. |
| Reveal gesture | Component test with pointer events | Upward movement past threshold reveals; short/downward movement does not; confirmation advances; blur/cancel/hidden document masks. |
| Long word | Narrow viewport component/e2e assertion + visual QA | Secret word remains inside the reveal surface with no horizontal overflow or clipping. |
| Regression | `npm run lint`, `npm run test:run`, `npm run build`, `npm run e2e` | Existing role assignment, voting, Outlier, offline, and replay journeys still pass. |

## 9. Rollout, rollback, observability, cleanup, and unverified boundaries

### Rollout

Ship as one client-side release. No migration or backend coordination is required. The existing persisted Zustand and Dexie schemas remain compatible because this plan changes presentation and view handoff only.

### Rollback

Revert the UI commit if the gesture or redirect causes regressions. Persisted packs and game state are not mutated by the redesign, so rollback does not require data cleanup.

### Observability

There is no remote telemetry by design. Use accessible status text, Playwright coverage, and manual device-width QA as the evidence surface. If product analytics are added later, import success/failure and reveal-gesture completion are the likely events, but they are explicitly not part of this plan.

### Cleanup

- Remove obsolete hold-to-reveal copy and selectors from tests.
- Remove CSS rules that only support the old flat rules grid if no longer referenced.
- Keep the new import callback optional if `PackManager` remains reusable in tests or future surfaces.

### Unverified boundaries

- Exact desired visual hierarchy and copy tone for future game cards are not specified; this plan uses a neutral product-level default.
- The preferred drag threshold and whether the reveal should persist after the finger lifts are product decisions; this plan chooses 56px and persistence until explicit confirmation because it is more usable for long words while retaining blur/cancel masking.
- No runtime screenshot or device testing was performed during planning; responsive and overflow acceptance must be verified in Phase 5.

