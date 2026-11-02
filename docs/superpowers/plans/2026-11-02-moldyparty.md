# MoldyParty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, installable, offline-first MoldyParty PWA containing the Impostor game and local custom-word-pack management.

**Architecture:** Pure TypeScript domain functions define game rules and JSON parsing. A Zustand store coordinates the finite-state lifecycle, React phase screens render it, and Dexie persists custom packs. Vite PWA generates the manifest and service worker.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Zustand, Dexie, vite-plugin-pwa/Workbox, Vitest, Testing Library, Playwright

**Spec:** `docs/superpowers/specs/2026-11-02-moldyparty-design.md`

## Global Constraints

- Fully installable on desktop and mobile and offline-first after initial load.
- Minimum 3 players; `1 <= impostorCount < playerCount`.
- Canonical imports use `{ packName, category, items: [{ word, hint }] }` and fallback imports use `{ words: string[], hints: string[] }`.
- All secrets and votes use a neutral hand-off mask between players.
- All persistent user data stays local.

## Review Focus

- Duplicate or blank player names are rejected before a round starts (Task 2).
- Deterministic role assignment never duplicates an impostor and respects bounds (Task 2).
- Malformed imports and mismatched fallback arrays produce useful validation errors (Task 3).
- Tied and all-skipped ballots eliminate nobody without crashing (Task 4).
- Refresh/offline startup preserves packs and loads a usable app shell (Tasks 5 and 7).

---

### Task 1: Project shell and visual foundation

**Files:** Create `package.json`, Vite/TypeScript/Tailwind/Vitest config, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, and `src/test/setup.ts`.

**Interfaces:** Produces a renderable `<App />`, test environment, scripts `dev`, `build`, `test`, `test:run`, `lint`, and `e2e`.

- [ ] Write a failing app-shell test asserting the MoldyParty heading and Impostor launch card.
- [ ] Run the focused test and confirm it fails because the shell does not exist.
- [ ] Add the minimal project configuration, semantic app shell, responsive theme tokens, and accessible base styles.
- [ ] Run the focused test and full suite; expect PASS.

### Task 2: Domain types, built-in packs, and round creation

**Files:** Create `src/domain/types.ts`, `src/domain/builtInPacks.ts`, `src/domain/game.ts`, and `src/domain/game.test.ts`.

**Interfaces:** Produce `Player`, `GameState`, `WordPack`, `WordItem`, `VoteRecord`, `PWAConfig`; `validateSetup(input): SetupErrors`; `createRound(input, random?): GameState`; and `advanceRoleReveal(state): GameState`.

- [ ] Write failing tests for setup constraints, duplicate names, deterministic role assignment, word selection, hints, and reveal progression.
- [ ] Run the focused test and confirm rule-level failures.
- [ ] Implement the exact types, three built-in packs, validation, injected-random assignment, and phase progression.
- [ ] Run focused and full tests; expect PASS.

### Task 3: Custom word-pack parser and persistence

**Files:** Create `src/features/packs/packParser.ts`, `packParser.test.ts`, `packDb.ts`, `packDb.test.ts`, and `PackManager.tsx`.

**Interfaces:** Produce `parseWordPackJson(text): ParseResult`, `serializeWordPack(pack): string`, and a Dexie repository with `list`, `put`, `rename`, and `delete` operations.

- [ ] Write failing parser tests for canonical, fallback, empty, malformed, duplicate, and mismatched-array input; write fake-IndexedDB CRUD tests.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement validation, normalization, export formatting, Dexie schema, and repository.
- [ ] Add manual pair rows, paste/upload validation, preview, rename, export, and delete UI.
- [ ] Run focused and full tests; expect PASS.

### Task 4: Voting and result rules

**Files:** Extend `src/domain/game.ts` and `src/domain/game.test.ts`.

**Interfaces:** Produce `startVoting(state): GameState`, `recordVote(state, targetId | null): GameState`, and `calculateVoteResult(players, votes): VoteResult`.

- [ ] Write failing tests for normal ballots, skipped votes, self-voting prevention, ties, all-skipped votes, and final voter transition.
- [ ] Run focused tests and confirm rule-level failures.
- [ ] Implement minimal immutable vote and result transitions.
- [ ] Run focused and full tests; expect PASS.

### Task 5: Zustand lifecycle store and refresh recovery

**Files:** Create `src/store/gameStore.ts`, `src/store/gameStore.test.ts`, and `src/store/preferencesStore.ts`.

**Interfaces:** Produce actions `startGame`, `showRole`, `hideRole`, `confirmRole`, `beginVoting`, `castVote`, `confirmVote`, `playAgain`, `changeCategory`, and `returnToLobby`.

- [ ] Write failing store tests covering every FSM transition and persisted setup recovery.
- [ ] Run focused tests and confirm missing-store failures.
- [ ] Implement the store as commands over domain functions with a versioned local persistence slice.
- [ ] Run focused and full tests; expect PASS.

### Task 6: Complete pass-the-device interface

**Files:** Create components under `src/features/game/` for `LobbyScreen`, `PlayerEditor`, `CategoryPicker`, `RoleRevealScreen`, `PassDeviceMask`, `DiscussionScreen`, `VotingScreen`, `GameOverScreen`, and shared controls; connect them in `src/App.tsx`.

**Interfaces:** Consume Task 5 store actions and render one screen per FSM phase.

- [ ] Write failing interaction tests for setup validation, hold-to-reveal masking, role hand-off, timer controls, secret voting, and all game-over actions.
- [ ] Run focused tests and confirm missing UI behavior.
- [ ] Implement touch/pointer/keyboard-safe screens with 48px targets, focus visibility, and reduced-motion handling.
- [ ] Run interaction and full tests; expect PASS.

### Task 7: AI prompt helper and installable offline PWA

**Files:** Create `src/features/packs/AiPromptHelper.tsx`; modify `vite.config.ts`; create `public/icons/*`; create `src/components/InstallPrompt.tsx` and `UpdatePrompt.tsx`.

**Interfaces:** Produce topic-aware prompt copy, web app manifest, generated service worker, install handling, and explicit update activation.

- [ ] Write failing tests for generated prompt content and clipboard behavior.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the helper and configure manifest metadata, maskable icons, app-shell precache, offline navigation fallback, and update banner.
- [ ] Build and inspect generated manifest/service-worker artifacts; expect icons, `display: standalone`, theme colors, and precache entries.
- [ ] Run full tests and build; expect PASS.

### Task 8: End-to-end and offline verification

**Files:** Create `playwright.config.ts`, `e2e/game-flow.spec.ts`, and `e2e/offline.spec.ts`; create `README.md`.

**Interfaces:** Verify the shipped browser experience rather than adding production APIs.

- [ ] Write an end-to-end game covering three players, reveal, discussion, secret votes, tie/result, and replay.
- [ ] Write an installed-build test that reloads offline and verifies a previously saved custom pack.
- [ ] Run E2E tests against `vite preview`; expect PASS on Chromium mobile and desktop projects.
- [ ] Document setup, scripts, architecture, import schema, install behavior, and offline limitations.
- [ ] Run `npm run lint`, `npm run test:run`, `npm run build`, and `npm run e2e`; all must pass without warnings.

