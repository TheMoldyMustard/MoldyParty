# Category Bomb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recoverable offline Category Bomb game with radial arrow play for 2–12 players and name-only play for 13+ players.

**Architecture:** A pure `categoryBomb` domain owns validation, display-mode derivation, turn queues, deadlines, and explosions. An isolated persisted Zustand store exposes semantic commands. Feature components branch only at the pre-round and active presentation layers, while app routing and global sound/haptic preferences remain shared.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Testing Library, Playwright, Vite PWA.

**Spec:** `docs/feature-plans/2026-11-20-category-bomb.md`

## Global Constraints

- Two or more unique non-empty player names; each trimmed name is at most 24 characters.
- Player counts 2–12 derive `radial`; counts 13+ derive `name-only`; users cannot override the mode.
- Radial mode uses twelve fixed seats, optional swapping, perimeter labels, and a derived arrow.
- Name-only mode has no seats, placement, perimeter roster, arrow element, or arrow semantics; it prominently displays the current name.
- Default Fair cycle visits every player once before reshuffling; Chaos may revisit prior players but never selects the current player.
- Secret duration is uniformly sampled from `20 + 3n` through `30 + 5n` seconds; optional random pass-time bonuses default off, use an inclusive 0.5–3.0-second range when enabled, and remain capped at 15 seconds total.
- Deadline expiry wins every late-answer/foul race; no remaining time/progress/countdown is visible or announced.
- Invalid/repeated answers use a cancelable 600 ms hold-to-foul action; no microphone or automatic validation.
- No new runtime dependency, backend, analytics, audio asset, custom pack schema, push, or merge.

## Review Focus

- A 12→13 or 13→12 roster edit must clear/rebuild seats rather than hydrate an incompatible layout; Task 1 tests this.
- A double tap, stale token, or answer exactly at the deadline must not extend or advance the round; Task 1 tests this.
- A restored active round whose deadline elapsed while hidden must explode the same current player once; Task 2 tests this.
- Name-only mode must not leave an invisible or accessible arrow/perimeter roster in the DOM; Task 4 tests this.
- Large-roster validation/selection must remain correct at 50 players without quadratic duplicate checks; Tasks 1 and 3 test this.

---

### Task 1: App identity and pure Category Bomb domain

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/packCompatibility.ts`
- Modify: `src/domain/packCompatibility.test.ts`
- Create: `src/domain/categoryBombCategories.ts`
- Create: `src/domain/categoryBomb.ts`
- Create: `src/domain/categoryBomb.test.ts`

**Interfaces:**
- Produces: `AppGameId`, `PackGameId`, `CategoryBombSettings`, `CategoryBombRound`, `validateCategoryBombSettings`, `deriveCategoryBombDisplayMode`, `createCategoryBombRound`, `acceptCategoryBombAnswer`, `callCategoryBombFoul`, `syncCategoryBombClock`, `replayCategoryBombRound`, `swapCategoryBombSeats`.
- Consumes: no new interfaces.

- [ ] **Step 1: Write failing identity/domain tests** covering pack-ID narrowing; name/count and pass-bonus validation; 12/13 display threshold; seat assignment/swap; duration boundaries; Fair/Chaos selection; disabled and random answer extension/cap; stale token; exact-deadline precedence; foul; replay category avoidance.
- [ ] **Step 2: Run `npm run test:run -- src/domain/categoryBomb.test.ts src/domain/packCompatibility.test.ts`** and confirm failure because the new contracts/modules do not exist.
- [ ] **Step 3: Implement the minimal domain and typed category list** with injected clock/random inputs and linear-time normalized-name validation.
- [ ] **Step 4: Run the focused tests, then `npm run test:run -- --reporter=dot`** and confirm all pass.
- [ ] **Step 5: Commit** with `feat: add category bomb domain`.

### Task 2: Persisted store and recovery

**Files:**
- Create: `src/store/categoryBombStore.ts`
- Create: `src/store/categoryBombStore.test.ts`
- Modify: `src/store/appStore.ts`
- Modify: `src/store/appStore.test.ts`

**Interfaces:**
- Consumes: Task 1 domain functions and `AppGameId`.
- Produces: `CategoryBombStoreState`, `createCategoryBombStore`, `categoryBombStore`, `useCategoryBombStore`; three-game `resolveActiveGame(explicit, hasImpostor, hasCharades, hasCategoryBomb)`.

- [ ] **Step 1: Write failing store tests** for setup, seat swap, arm, accept, foul, replay, mode-appropriate return, reset, hydration before/after deadline, malformed snapshots, 13+ null seats, and app-pointer validation/recovery.
- [ ] **Step 2: Run `npm run test:run -- src/store/categoryBombStore.test.ts src/store/appStore.test.ts`** and confirm expected missing-interface failures.
- [ ] **Step 3: Implement the version-1 persisted store and app-store migration/normalization** using injected random, clock, and storage.
- [ ] **Step 4: Run focused tests, then the full unit/component suite** and confirm all pass.
- [ ] **Step 5: Commit** with `feat: persist category bomb rounds`.

### Task 3: Setup, radial placement, and large-group ready screens

**Files:**
- Create: `src/features/category-bomb/CategoryBombSetupScreen.tsx`
- Create: `src/features/category-bomb/CategoryBombPlacementScreen.tsx`
- Create: `src/features/category-bomb/CategoryBombReadyScreen.tsx`
- Create: `src/features/category-bomb/CategoryBombSetupFlow.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Task 1 display/validation contracts and Task 2 store commands; existing preference store.
- Produces: setup and pre-round components accepting `onBack: () => void`.

- [ ] **Step 1: Write failing component tests** for validation, mode notice, 12→13→12 transition, 50-player setup, Radial placement swaps, Name-only ready copy, absence of seats/arrow at 13+, and Arm bomb.
- [ ] **Step 2: Run `npm run test:run -- src/features/category-bomb/CategoryBombSetupFlow.test.tsx`** and confirm missing-component failures.
- [ ] **Step 3: Implement accessible setup and conditional pre-round screens** with stable IDs, 24-character inputs, tap-select/tap-seat swapping, category preview, and sound/haptic toggles.
- [ ] **Step 4: Add focused responsive styles** for roster editing, twelve semantic seat classes, four rotations, safe areas, and the centered Name-only ready view.
- [ ] **Step 5: Run focused tests and the full suite** and confirm all pass.
- [ ] **Step 6: Commit** with `feat: add category bomb setup`.

### Task 4: Active game, device feedback, app routing, and results

**Files:**
- Create: `src/features/category-bomb/CategoryBombGame.tsx`
- Create: `src/features/category-bomb/CategoryBombActiveScreen.tsx`
- Create: `src/features/category-bomb/CategoryBombExplosionScreen.tsx`
- Create: `src/features/category-bomb/useCategoryBombDevices.ts`
- Create: `src/features/category-bomb/CategoryBombFlow.test.tsx`
- Modify: `src/features/charades/audioSynth.ts`
- Modify: `src/features/charades/audioSynth.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Task 2 store and Task 3 screens; existing audio, wake-lock, preferences, and app shell.
- Produces: complete home→setup→pre-round→active→exploded→replay/exit flow.

- [ ] **Step 1: Write failing flow/app/audio tests** for the third home card, refresh routing, Radial arrow/name status, Name-only central name with no arrow/roster DOM, answer feedback, hidden timer DOM, exact explosion result, replay, exit isolation, audio failure fallback, and cancelable pointer/keyboard foul hold.
- [ ] **Step 2: Run the focused test files** and confirm failures are caused by missing active-flow behavior.
- [ ] **Step 3: Implement the game phase switch and active/result screens** with 200 ms clock sync, focus/page-show/visibility reconciliation, action tokens, accessible live status, conditional actual-bonus flash, and cleanup.
- [ ] **Step 4: Implement the Category Bomb device controller** using synthesized accepted/explosion cues, optional vibration, and advisory wake lock; failures remain non-blocking.
- [ ] **Step 5: Integrate `AppGameId`, `App.tsx`, home card, persisted recovery, and CSS** without changing existing game behavior.
- [ ] **Step 6: Run focused tests and the full suite** and confirm all pass.
- [ ] **Step 7: Commit** with `feat: integrate category bomb game`.

### Task 5: End-to-end, offline documentation, and release verification

**Files:**
- Create: `e2e/category-bomb-flow.spec.ts`
- Modify: `e2e/offline.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the complete Category Bomb flow.
- Produces: browser/offline coverage and user-facing documentation.

- [ ] **Step 1: Write failing Playwright journeys** for Radial play, 13+ Name-only play, no-arrow DOM, expiry/replay, and offline reload recovery.
- [ ] **Step 2: Run the new E2E tests against a production build** and confirm they fail for missing test seams or uncovered behavior, not test syntax.
- [ ] **Step 3: Add only the smallest production/test-seam corrections required** and update README with both display modes, hidden timer, self-moderation, and local recovery.
- [ ] **Step 4: Run `npm run test:run -- --reporter=dot`, `npm run lint`, `npm run build`, and `npm run e2e`**; inspect all outputs and confirm zero failures.
- [ ] **Step 5: Inspect `git status`, `git diff --check`, and branch history**; confirm no generated artifacts, push, or merge.
- [ ] **Step 6: Commit** with `test: verify category bomb flow`.
