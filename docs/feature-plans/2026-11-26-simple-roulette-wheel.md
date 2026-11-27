# Simple roulette wheel with name entry

**Status:** Planning only  
**Date:** 2026-11-26  
**Feature owner:** Standalone roulette utility

## 1. Decision summary and feature brief

Add **Name Roulette** as a fourth activity on the MoldyParty home screen. It opens one self-contained screen where a group enters names or copies the roster from any saved Impostor, Forehead Charades, or Category Bomb session, spins a visible wheel, and sees one uniformly selected winner. The wheel remains usable offline, needs no account or permission, and can be spun again with the same roster.

**Recommendation:** implement a small pure roulette domain module plus a local-state React screen rendered from the existing `AppContent` view switch. Draw the wheel with repository-native SVG/CSS, preselect the winner with injected randomness, and animate the wheel to that winner. Do not add a package, saved-session manager, Zustand store, `AppGameId`, statistics, or persistence schema for v1.

The requested feature is interpreted as a lightweight picker rather than a fourth recoverable game. Names exist only while the roulette screen is mounted. Reloading or returning home clears the list; this keeps the feature simple and avoids implying that a saved roster or prior result is durable.

## 2. Scope, non-goals, permissions, and assumptions

### In scope

- A fourth home card labeled **Name Roulette** and a local `roulette` view in `AppContent`.
- A dedicated screen with two initial name rows, add/remove controls, a visible wheel, a pointer, a **Spin** button, and a winner result.
- A saved-session roster picker that reads the three existing local session stores and copies the selected roster into the editable roulette draft without mutating or linking the source session.
- Validation for 2–50 entered names, non-empty trimmed values, case-insensitive uniqueness, and a 24-character limit per name.
- Uniform winner selection over the current normalized list.
- Wheel sectors and labels derived from the same ordered list used for selection.
- A spin animation that lands on the preselected sector, ignores repeat spin requests while active, and announces the winner after the animation completes.
- A reduced-motion path that chooses and announces the same result without a long rotation.
- Responsive, keyboard, screen-reader, unit/component, end-to-end, and offline verification.
- README updates describing the fourth activity and its non-persistent behavior.

### Non-goals

- No roulette-owned saved sessions, named groups, live roster links, writes to existing game sessions, history, statistics, favorites, or cross-device synchronization.
- No weighted entries, multiple copies of a name, teams, elimination mode, “remove winner,” prizes, custom colors, sound, haptics, confetti, or editable spin duration.
- No server, account, analytics, telemetry, remote random service, or cryptographic fairness claim.
- No new dependency, canvas library, SVG library, router, or change to Impostor, Charades, Category Bomb, packs, preferences, or their persistence formats.
- No guarantee that an animation is physically simulated; the selected index is authoritative and the animation is presentation.

### Permissions and privacy

Name Roulette needs no browser permission and makes no network request. In v1, names and the winner remain only in React memory and disappear when the screen unmounts or the page reloads. Existing PWA caching continues to make the code available offline after the first production load.

### Assumptions and explicit product calls

- **Assumption:** “simple roulette wheel” means a random name picker, not a casino betting game or a reusable saved roster.
- **Product call:** start with two blank inputs and require at least two valid names before spinning. This matches the plural request and avoids a meaningless one-sector wheel.
- **Product call:** support up to 50 names and 24 Unicode code points per name so large saved Category Bomb rosters remain importable. The winner panel always shows the full normalized name; wheels above 24 names use numbered visual sectors while retaining accessible full names.
- **Product call:** names must be unique after trimming and locale-aware lowercasing so the announced winner is unambiguous. Duplicate weighting is explicitly deferred.
- **Product call:** returning to MoldyParty clears the roulette draft. If persistence is later desired, it should be a separately approved local preference or roster feature rather than an accidental `localStorage` side effect.
- **Product call:** a session import is a one-time copy. The picker labels each source with its game and session name, excludes records with fewer than two usable names, and leaves the copied names editable. Later session renames or roster changes do not update an open roulette draft.
- **Product call:** `Math.random` is acceptable for a party picker, but the selection function accepts a random callback so boundary cases and uniform index mapping are deterministic in tests.
- **Unverified product boundary:** the 24-name threshold for switching from names to numbered sectors is a planning recommendation based on mobile label density, not a measured device result. Responsive QA may justify a different threshold without changing the architecture.

## 3. Current-state evidence ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | `AppContent` owns routing with a local `AppView` union and renders the home screen when no view/active-game branch matches (`src/App.tsx:25`, `src/App.tsx:34-35`, `src/App.tsx:117-198`). | Add a local `roulette` view and screen branch without introducing a router. |
| Confirmed | The home screen contains one accessible `section.game-card` and explicit button per current game (`src/App.tsx:198-241`). | Add one matching card, distinct modifier class, heading ID, copy, and **Open Name Roulette** button. |
| Confirmed | `AppGameId` is restricted to `impostor`, `charades`, and `category-bomb`; `appStore` persists and validates only those recoverable active games (`src/domain/types.ts:3-5`; `src/store/appStore.ts:6-10`, `src/store/appStore.ts:21-38`, `src/store/appStore.ts:43-55`). | Keep roulette out of `AppGameId` and `appStore`; it has no recoverable active state or migration. |
| Confirmed | Existing name editors use controlled rows with accessible labels, add/remove actions, minimum-count rules, and 24-character trimming in Category Bomb (`src/features/game/PlayerEditor.tsx:7-40`; `src/features/category-bomb/CategoryBombSetupScreen.tsx:72-87`). | Follow these interaction/accessibility patterns, but isolate roulette limits and IDs rather than reusing either specialized editor unchanged. |
| Confirmed | The shared `PlayerEditor` hard-codes a three-player minimum and player-specific copy (`src/features/game/PlayerEditor.tsx:9-12`, `src/features/game/PlayerEditor.tsx:27-39`). | Do not reuse it unchanged; a small roulette-owned editor avoids widening an established Impostor contract. |
| Confirmed | All three persisted session records expose a session name and player roster through their existing stores (`src/domain/types.ts:123-138`; `src/store/charadesStore.ts:27-43`; `src/store/categoryBombStore.ts:43-68`). | Assemble read-only picker options in the app shell and pass copied names into roulette; no schema or migration is needed. |
| Confirmed | Existing domain code injects randomness into pure functions and maps random samples to indexes (`src/domain/game.ts:56-81`; `src/domain/categoryBomb.ts:71-83`, `src/domain/categoryBomb.ts:153-169`). | Implement and directly test one pure `selectRouletteIndex(count, random)` boundary-safe selector. |
| Confirmed | The visual system supplies 48 px minimum buttons, visible focus, responsive game cards, a mobile single-column card layout, and global reduced-motion handling (`src/styles.css:29-34`, `src/styles.css:36-103`). | Extend the existing CSS tokens/classes; add feature-specific wheel sizing and explicit reduced-motion behavior. |
| Confirmed | Workbox precaches built JS/CSS/HTML/SVG and provides an offline navigation fallback (`vite.config.ts:30-34`). | Source and CSS changes join the existing bundle automatically; no precache or manifest schema change is required. |
| Confirmed | Vitest/Testing Library and Playwright cover app-shell navigation and desktop/mobile journeys (`src/App.test.tsx:36-100`; `playwright.config.ts:3-20`). | Add domain/component/app integration checks plus one desktop/mobile E2E journey. |
| Confirmed | Focused read-only baseline on 2026-11-26: `npm run test:run -- src/App.test.tsx src/store/appStore.test.ts --reporter=dot` passed 2 files and 24 tests. | The implementation must preserve these routing/recovery tests while adding roulette coverage. |
| Confirmed | The repository is already offline-first and states that gameplay data is not transmitted (`README.md:1-3`, `README.md:123-134`). | Document roulette as local, transient, and offline; do not add telemetry solely to observe it. |
| Unverified | No browser mockup, production build, or physical-device wheel inspection was performed during planning. | Sector label readability, pointer alignment, final transform accuracy, rotation smoothness, and touch ergonomics remain release QA boundaries. |
| Unverified | Browser timing behavior during backgrounding was not measured for a roulette animation. | Treat the result as preselected domain state; when the completion timer fires or the page resumes after the deadline, show that result rather than deriving it from rendered animation progress. |

## 4. End-to-end impact and consumer map

```text
Home: Name Roulette card
          ↓ setView('roulette')
RouletteScreen (local state only)
  ├─ saved roster options copied from existing stores
  ├─ raw name rows
  ├─ normalizeRouletteNames(rawNames)
  ├─ validation errors
  ├─ selectedIndex / displayedWinner
  ├─ rotation / spin token / completion deadline
  └─ SVG wheel sectors + labels
          ↓ Spin
selectRouletteIndex(validNames.length, random)
          ↓ preselected index
rotationForRouletteIndex(index, count, currentRotation)
          ├─ visual transform and pointer
          └─ completion/reduced-motion path
                    ↓
winner status / dialog-like result panel
  ├─ Spin again (same roster)
  └─ edit roster or ← MoldyParty (local state is discarded)
```

| Producer / consumer / boundary | Required impact |
|---|---|
| `src/domain/roulette.ts` | Own name normalization/validation, boundary-safe index selection, and sector/target-angle math as pure functions. Avoid React, timers, DOM, and storage. |
| `src/features/roulette/RouletteScreen.tsx` | Own input draft, spin lifecycle, accessible errors/status, SVG rendering, reduced-motion choice, cleanup, and navigation callback. |
| `src/App.tsx` | Import the screen, add `'roulette'` to `AppView`, assemble read-only roster options from all three session stores, render its branch before home, and add the fourth card. Do not call `appStore.setActiveGame` for roulette. |
| `src/domain/types.ts` | No change. `AppGameId` continues to mean recoverable persisted games only. |
| `src/store/appStore.ts` and game stores | No change. There is no roulette persisted producer or consumer. |
| `src/styles.css` | Add home-card colors plus responsive wheel/layout/result styles, transition state, long-label handling, focus/touch behavior, and reduced-motion rules. |
| Tests | New pure domain tests, component behavior tests, app-shell navigation assertion, and Playwright desktop/mobile/offline journey. Existing suites remain regression consumers. |
| `README.md` | Add Name Roulette to the product summary/how-to-use text and explicitly state that its roster/result are not saved. |
| PWA/build | No contract change; bundled code/CSS is covered by existing Workbox glob patterns. Verify rather than edit configuration. |
| Backend/auth/API/jobs/audit | Not applicable. No backend exists; the relevant boundary is transient local UI state and accessible feedback. |

## 5. Conflicts, invariants, risks, and design options

### Invariants to preserve

- Each accepted spin selects exactly one integer index in `[0, names.length - 1]` from the same normalized ordered names array rendered on the wheel.
- The selected index is the source of truth. CSS/SVG animation never decides the winner by inspecting a transform or pointer position.
- A random sample below 0 maps to the first sector and a sample at/above 1 maps to the last sector defensively, matching the repository's boundary-safe random patterns.
- Spin input is disabled while spinning. Repeated clicks, Enter presses, or delayed completion callbacks cannot select or announce a second winner for the same spin token.
- Editing, adding, or removing names clears the prior winner and cancels/invalidates any pending animation completion.
- Sector ordering, color ordering, accessible list ordering, and selection ordering remain identical.
- The pointer visually targets the center of the selected sector after rotation; angle math is independent of animation duration.
- Reduced-motion users receive the same uniformly selected result with no long spin; accessibility feedback does not depend on motion.
- Unmounting clears timers/listeners, and returning home cannot announce a stale winner later.
- Existing active-game persistence and recovery behavior remains unchanged because roulette never writes `activeGameId`.

### Main conflicts and risks

- **The repository's existing activities all now use saved-session managers.** Copying that model would turn a simple picker into storage, migration, statistics, and lifecycle work. A transient utility is the deliberate exception and must be labeled clearly.
- **Reusing `PlayerEditor` would inherit a three-player minimum and player-specific assumptions.** Generalizing it for one small screen risks Impostor regressions; isolate the first version.
- **Animation can disagree with selection because of off-by-one angle direction or the pointer's zero angle.** Put geometry in pure functions, define zero/pointer orientation once, and test every sector for representative counts.
- **SVG labels become unreadable with many or long names.** Use responsive font sizing and visual truncation through 24 names, then numbered sectors while the editable list and accessible sector labels retain full names; perform 2-, 12-, 24-, and 50-name mobile QA.
- **React index keys can associate the wrong input after removal.** Give draft entries stable local IDs, even though only normalized strings enter the domain function.
- **A timer alone can finish late after background throttling.** Store a completion deadline/token and reconcile on visibility/focus, or simply reveal the already chosen winner when the delayed callback executes; never select again.
- **Randomness may be perceived as unfair.** Selection must be uniform by index and deterministic under an injected random function, but copy must not claim cryptographic security or physical-wheel simulation.
- **Global reduced-motion CSS shortens animations to `.01ms`.** The component cannot rely only on a `transitionend` event; it needs a controlled completion path that also handles reduced motion and missing events.
- **A fourth 22-rem stacked card lengthens the home page.** Preserve normal document scrolling and test the fourth card and footer on small mobile viewports; do not silently redesign all cards as part of this feature.

### Feasible designs

1. **SVG wheel + pure selector + local React state — recommended.** SVG gives exact sector geometry and readable labels without a dependency. Pure index/angle functions are deterministic, while the component remains small and intentionally non-persistent.
2. **CSS `conic-gradient` wheel + HTML label overlay.** Sector colors are concise, but aligning a variable number of labels and pointer-center math is harder to verify and less semantic. It is acceptable only if an implementation spike shows simpler accessible markup.
3. **Canvas or third-party wheel library.** Canvas makes text/accessibility and deterministic tests harder; a library adds bundle, license, API, and offline supply-chain surface for a small feature. The current repository has no need for it.

## 6. Recommended architecture, data flow, security, and error behavior

### Proposed pure contracts

Create `src/domain/roulette.ts` with a small API equivalent to:

```ts
export interface RouletteValidationResult {
  names: string[]
  errors: string[]
}

export function validateRouletteNames(rawNames: string[]): RouletteValidationResult
export function selectRouletteIndex(count: number, random?: () => number): number
export function rouletteSectorCenterDegrees(index: number, count: number): number
export function nextRouletteRotationDegrees(
  currentRotation: number,
  selectedIndex: number,
  count: number,
  extraTurns?: number,
): number
```

`validateRouletteNames` trims values, measures the agreed Unicode length consistently, rejects blanks, rejects case-insensitive duplicates, enforces 2–50 entries and 24 characters, and returns normalized names only when valid. `selectRouletteIndex` throws on an invalid count and clamps the sampled value before `Math.floor(sample * count)`. Angle functions define the pointer at 12 o'clock and return a clockwise target that places the selected sector center under it after several complete turns.

### UI state and flow

1. `RouletteScreen` starts with two stable-ID blank rows and no winner. When saved rosters exist, a labeled picker can replace those rows with a copied roster; source sessions remain unchanged.
2. Every draft edit updates only local state and clears validation/result state. Remove is available only above two rows; add is disabled at 24.
3. **Spin** validates. On failure, render a `role="alert"`, focus the summary, and keep all entered values.
4. On success, compute the selected index once, increment a monotonic spin token, calculate the target rotation, set a completion deadline, disable roster/spin controls, and start the presentation transition.
5. On completion (timeout or deadline reconciliation), verify the token, mark the selected name as the displayed winner, update an `aria-live="polite"` status, and focus the winner heading or result region without opening a modal.
6. **Spin again** retains the roster and starts a new independent selection. Editing the roster returns to the ready state.
7. **← MoldyParty** calls `onBack`; unmount cleanup invalidates the token and clears pending completion work.

### SVG and presentation model

- Render one SVG path per sector from `count`, `index`, center, and radius; alternate a fixed accessible palette derived from the existing cream/lime/coral/plum family.
- Render a full-name accessible label for each sector. Visual text follows a radial position/orientation and truncates only presentation when needed.
- Keep the pointer outside the rotating group. Rotate one inner `<g>` or wheel wrapper around its center.
- Use a stable easing curve and fixed duration (for example 3.5 seconds) plus several complete turns. The exact duration/turn count is presentation configuration, not domain state.
- With `prefers-reduced-motion: reduce`, skip the long transition and publish the preselected result immediately or after a very short non-motion state change.
- The result region repeats the full winner name in normal text; users never need to infer it from the pointer.

### Security, privacy, accessibility, and errors

- Treat names as text only. React escaping remains intact; do not use `innerHTML`, embed names into CSS, or serialize them into URLs/logs.
- Use stable generated local IDs for row controls and DOM labels. Do not treat display names as identifiers.
- Inputs have visible or screen-reader labels (`Name 1`, etc.), autocomplete disabled, and remove buttons name the current entry when available.
- The SVG has an accessible name and description; the editable list remains the authoritative accessible roster. Decorative paths/pointer details should not create noisy repeated announcements.
- Validation errors identify blank, duplicate, too-long, too-few, or too-many entries and preserve the draft for correction.
- If selection receives invalid state despite UI validation, fail closed with an inline error and no animation. Do not silently choose a default winner.
- No names are persisted, transmitted, included in telemetry, or written to console output.

## 7. Contract, schema, migration, and compatibility changes

| Area | Change |
|---|---|
| App view contract | Add `'roulette'` only to the file-local `AppView` union in `src/App.tsx`. |
| Persisted app identity | No change to `AppGameId`, `appStore`, its storage version, migration, validation, or `resolveActiveGame`. |
| Roulette domain | Add new non-persisted validation, selection, and geometry contracts under `src/domain/roulette.ts`. |
| UI props | Add `RouletteScreen({ onBack, rosterOptions, random? })`; production omits `random`, while focused component tests may inject it. `rosterOptions` contains stable source IDs, game/session labels, and copied names only. |
| Data/schema | No database, IndexedDB table, localStorage key, session record, statistics schema, or pack format change. |
| PWA | No manifest or Workbox configuration change; the existing built asset patterns include the new compiled code and CSS. |
| Compatibility | Existing saved sessions, active game recovery, pack data, preferences, and URLs remain untouched. Reloading during roulette intentionally returns to home rather than attempting recovery. |

## 8. Ordered implementation phases with exact owners

### Phase 1 — Pure validation, selection, and geometry

**Owners:** new `src/domain/roulette.ts` and `src/domain/roulette.test.ts`.

1. Define constants for minimum/maximum entries and name length.
2. Implement normalization and validation with explicit Unicode/case rules.
3. Implement boundary-safe uniform index selection with injected randomness.
4. Implement sector-center and cumulative target-rotation math with a documented 12-o'clock pointer convention.
5. Test invalid counts, random boundaries, every index for representative roster sizes, normalization/duplicates, and rotation landing tolerances.

### Phase 2 — Accessible local-state roulette screen

**Owners:** new `src/features/roulette/RouletteScreen.tsx`, `src/features/roulette/RouletteScreen.test.tsx`.

1. Build stable-ID name rows with add/remove/edit behavior and two-row minimum.
2. Build the saved-session roster picker, copy a selected valid roster into new stable-ID draft rows, and keep source stores read-only.
3. Render the SVG wheel from validated current names; show an instructive placeholder before names are valid rather than drawing misleading blank sectors.
4. Implement spin token, selected index, rotation, completion deadline/timer, disabled-state, cleanup, and reduced-motion behavior.
5. Add validation focus management and winner announcement/focus behavior.
6. Test entry editing, session import, duplicate/blank rejection, deterministic winner display, double-spin rejection, spin-again behavior, edit-after-result reset, reduced motion, and unmount cleanup.

### Phase 3 — App-shell integration and responsive styling

**Owners:** `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`.

1. Add the local view branch and back navigation without touching persisted active-game state.
2. Assemble picker options from Impostor, Charades, and Category Bomb sessions, with a cross-store integration test proving selection copies names and does not mutate the source.
3. Add a fourth accessible home card with roulette-specific art/color treatment and button.
4. Add responsive two-column/stacked screen layout as space allows, square wheel sizing, sector labels, pointer, controls, result treatment, spin transition, and explicit reduced-motion override.
5. Extend app-shell tests to verify the new card, navigation to the roulette screen, session import, back navigation, and unchanged existing cards.

### Phase 4 — End-to-end, offline, documentation, and release evidence

**Owners:** new `e2e/roulette.spec.ts`, `e2e/offline.spec.ts`, `README.md`, optional dated `docs/qa/2026-11-26-name-roulette.md`.

1. Add a Playwright journey that enters names, validates a failure, spins, observes exactly one listed winner, spins again, and returns home on desktop and mobile Chromium.
2. Add or extend production-preview offline coverage: load once online, go offline, reload home, open roulette, enter names, and complete a spin.
3. Update product summary/how-to/offline/privacy text without claiming roster persistence or cryptographic randomness.
4. Run full unit/component tests, lint, production build, existing E2E regression suites, and responsive/manual QA before release.

## 9. Verification matrix and acceptance criteria

| Area | Verification | Acceptance criteria |
|---|---|---|
| Validation | Domain tests + component tests | Fewer than 2, more than 50, blank, duplicate-after-trim/case-fold, and over-24-character names cannot spin; correction preserves the draft. |
| Random selection | Deterministic domain tests | Samples partition `[0,1)` into equal index intervals; defensive out-of-range samples cannot produce an invalid index. |
| Geometry | Domain tests over 2, 3, 12, 24, and 50 sectors | Every selected sector center lands under the defined pointer within a small floating-point tolerance and cumulative rotation never reverses unexpectedly. |
| Spin lifecycle | Component tests with controlled randomness/timers | One click yields one selection and one announcement; controls are disabled during spin; stale timers/double clicks do not alter the result. |
| Roster editing | Component tests | Starts with two rows; add/remove honors 2–50 bounds; stable inputs keep the correct values after middle-row removal; edits clear a prior winner. |
| Reduced motion | Media-query component test + manual inspection | The same deterministic winner appears without a long rotation, and no completion depends solely on `transitionend`. |
| Accessibility | Testing Library queries + keyboard/manual screen-reader pass | All inputs/actions have accessible names, errors use alert semantics/focus, winner uses polite status plus visible text, and the wheel is understandable without color/motion. |
| Responsive UI | Playwright desktop/mobile + manual 320 px portrait, Pixel 7 portrait/landscape | Wheel, pointer, inputs, actions, result, fourth card, and footer remain visible/reachable without horizontal overflow. |
| Label density | Manual 2-, 12-, 24-, and 50-name cases including long and non-Latin names | Full names remain editable and are fully shown in the result/accessibility text; dense wheels use numbered sectors without losing accessible names. |
| Navigation/recovery | `App.test.tsx`, `appStore.test.ts`, manual reload | Roulette opens/backs locally; reload returns safely to home; existing three active-game recovery paths remain unchanged. |
| Offline/PWA | Production build + offline Playwright | After initial caching, roulette opens and completes a selection with the network offline; no new remote request is made. |
| Regression | `npm run test:run`, `npm run lint`, `npm run build`, `npm run e2e` | All existing and new checks pass on the supported Node/browser matrix. |
| Privacy | Source/network/storage inspection | Entered names and results are absent from local/session storage, IndexedDB, URLs, console logging, and network traffic. |

### Acceptance criteria

1. From the home screen, a user can open **Name Roulette**, enter 2–50 valid unique names, and see those names represented by the wheel.
2. Pressing **Spin** selects exactly one of the entered names uniformly, animates or follows the reduced-motion path, and presents the full winner name in visible and accessible text.
3. Spin cannot run with invalid input, cannot be triggered twice concurrently, and never announces a winner different from the sector targeted by the pointer.
4. **Spin again** keeps the roster; roster edits invalidate the old result; **← MoldyParty** returns home and discards the roulette state.
5. The feature works with keyboard/touch, at mobile and desktop sizes, and offline after the app shell is cached.
6. No existing saved-session, recovery, pack, preference, or game behavior changes.

## 10. Rollout, rollback, observability, cleanup, and unverified boundaries

### Rollout

1. Land pure domain/tests first with no entry point.
2. Land the screen and integration behind an unlinked local view if visual QA needs iteration.
3. Expose the home card only after deterministic, accessibility, mobile, offline, and full regression gates pass.
4. No data migration, feature flag, backend coordination, or staged server deployment is required.

### Rollback

- Remove/hide the home card and `roulette` view branch, then remove the isolated feature/domain/test/style code.
- No user data cleanup or storage-version rollback is required because v1 writes no roulette data.
- Re-run app-shell, active-game recovery, production build, and offline smoke tests after rollback.

### Observability

This repository is telemetry-free. Observe correctness through injected-random domain tests, controlled-timer component tests, accessible status/error output, Playwright traces on failure, production offline checks, and responsive/manual QA. Do not add analytics solely for roulette usage or outcomes.

### Cleanup requirements

- Clear/ignore pending spin completion work on edit, back navigation, and unmount.
- Keep roulette CSS names feature-scoped so removal does not disturb shared cards/screens.
- Do not leave dead `AppGameId` branches, persistence migrations, temporary feature flags, console logs, or test-only random hooks in production call sites.
- If a prototype dependency is evaluated, remove it and its lockfile changes unless separately approved; the recommended implementation needs none.

### Unverified boundaries

- Exact visual design, palette contrast for every adjacent sector, easing, duration, pointer size, and wheel label strategy need browser inspection.
- The 24-name visual-label threshold, 50-name cap, and 24-character limit need real-device review with Latin, CJK, emoji/grapheme clusters, and right-to-left text. The final Unicode counting/case-fold rule must be documented by implementation tests.
- Mobile/browser behavior when a spin is backgrounded, the device locks, or `transitionend` is omitted needs manual verification.
- Statistical randomness quality beyond correct uniform index mapping is not assessed; this is not a security or gambling feature.
- The user did not request saved rosters, weighted names, or removal-after-win. Adding any of those changes the data/interaction contract and should receive a follow-up plan rather than being folded into v1.

## 11. Self-review result

- **Unsupported claims:** repository behavior claims cite current files or the recorded focused test command. Proposed limits, persistence behavior, and animation behavior are labeled as product calls or recommendations.
- **Consumer coverage:** app routing, domain logic, UI state, SVG/CSS, accessibility, tests, PWA/offline, documentation, privacy, and rollback are covered. Backend/auth/schema categories are explicitly not applicable.
- **Conflict check:** the plan does not expand `AppGameId`, alter persisted stores, generalize `PlayerEditor`, or add a dependency; those boundaries are consistent throughout.
- **Scope check:** sessions, stats, weighting, elimination, sound/haptics, and customization remain explicit non-goals.
- **Task specificity:** each phase names exact repository owners and observable completion evidence; no implementation placeholders remain.
- **Open decisions:** only measured presentation details and Unicode/label-density thresholds remain unverified; none blocks the recommended architecture.
