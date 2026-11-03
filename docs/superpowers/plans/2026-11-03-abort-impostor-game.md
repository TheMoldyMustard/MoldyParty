# Abort Impostor Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let players confirm an `Abort game` action from any active Impostor phase without recording the unfinished round in session statistics.

**Architecture:** Add `abortGame()` to the Zustand store. It clears the active in-memory game, active session `currentGame`, pending vote/guess state, and timer state while preserving the session roster, setup, completed-round count, and stats. Render one reusable confirmation control from `AppContent` around all active non-result screens, then route to the session manager after confirmation.

**Tech Stack:** React, TypeScript, Zustand, Vitest, React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-abort-impostor-game-design.md`

## Global Constraints

- Confirmation is required because aborting discards the unfinished round.
- The result screen is already completed and remains unchanged.
- Aborting clears only unfinished `currentGame`; it does not mutate `completedRounds` or `statsByPlayerId`.
- Persisted hydration must restore the session with `currentGame: null`.
- Existing local-only storage and privacy masking rules remain unchanged.

## Review Focus

- Abort during role reveal, discussion, voting, and Outlier guessing must clear the same session-owned round state.
- Canceling confirmation must preserve phase, pending input, and timer state.
- Aborting a session with prior completed rounds must preserve all stats exactly.
- Reload after abort must show the session manager and not resume the discarded round.
- No abort control may appear on the completed-result screen.

### Task 1: Store abort action and persistence invariant

**Files:**
- Modify: `src/store/gameStore.ts`
- Test: `src/store/gameStore.test.ts`

**Interfaces:**
- Produces `GameStoreState.abortGame: () => void`.
- The action clears `game`, `activeSessionId`, `setup`, pending vote/guess fields, and timer fields; it updates the prior active session to `currentGame: null` and leaves its stats and completed-round count unchanged.

- [ ] **Step 1: Write the failing tests**

Add tests named `aborts an unfinished round without changing session statistics` and `persists an aborted session without a current game`. Start and complete one round to create non-zero stats, start another round, invoke the wished-for action, and assert the prior session remains with the same `completedRounds` and `statsByPlayerId` but `currentGame: null`; hydrate a new store and assert the same result.

- [ ] **Step 2: Run the focused tests and verify RED**

Run `npm run test:run -- --run src/store/gameStore.test.ts`.

Expected failure: `abortGame` is not defined on the store interface/action.

- [ ] **Step 3: Implement `abortGame()` in `src/store/gameStore.ts`**

Capture the active session ID, copy `sessionsById`, set only that session's `currentGame` to `null`, then clear the active projection and ephemeral vote/guess/timer state. Do not call `finishRound`, `calculateRoundStats`, or alter stats fields.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run `npm run test:run -- --run src/store/gameStore.test.ts`.

Expected: all store tests pass.

### Task 2: Shared confirmation UI and app wiring

**Files:**
- Create or modify: `src/features/game/AbortGameDialog.tsx`
- Modify: `src/App.tsx`, `src/styles.css`
- Test: `src/App.test.tsx`

**Interfaces:**
- `AbortGameDialog` accepts `onCancel: () => void` and `onConfirm: () => void` and exposes buttons named `Cancel` and `Abort game`.
- `AppContent` uses the store action and routes to `sessions` after confirmation.

- [ ] **Step 1: Write the failing component tests**

Add tests named `shows abort confirmation during an active round`, `canceling abort keeps the round active`, and `confirming abort returns to sessions without stats changes`. Assert the dialog is absent on `GAME_OVER`, Cancel keeps the current phase, and confirmation clears the current game and shows `Impostor sessions`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run `npm run test:run -- --run src/App.test.tsx`.

Expected failure: no active-screen abort control/dialog exists.

- [ ] **Step 3: Implement the dialog and app wiring**

Reuse the existing native-dialog accessibility pattern: initial focus on Cancel, Escape dismissal, focus containment, background inertness, and focus restoration. Render the control for `ROLE_REVEAL`, `DISCUSSION`, `VOTING`, and `OUTLIER_GUESS`; keep `GAME_OVER` unchanged. Confirmation calls `abortGame()` then sets the app view to `sessions`.

- [ ] **Step 4: Run component tests and verify GREEN**

Run `npm run test:run -- --run src/App.test.tsx`.

Expected: all app tests pass.

### Task 3: Browser acceptance coverage and documentation

**Files:**
- Modify: `e2e/game-flow.spec.ts`, `README.md`

- [ ] **Step 1: Add the failing E2E acceptance path**

Add a desktop/mobile test that starts a named session, begins a round, opens `Abort game`, cancels once, confirms the dialog leaves the round active, then confirms abort and verifies the session manager contains the session with no completed round and the session can be continued into fresh setup rather than resumed gameplay.

- [ ] **Step 2: Run the targeted E2E test and verify RED**

Run `npx playwright test e2e/game-flow.spec.ts --grep "abort"`.

Expected failure: the abort control and flow are not available.

- [ ] **Step 3: Implement the user-facing copy/documentation**

Document that aborting discards only the unfinished round and does not affect prior local session statistics.

- [ ] **Step 4: Run the targeted E2E test and verify GREEN**

Run `npx playwright test e2e/game-flow.spec.ts --grep "abort"`.

Expected: desktop and mobile acceptance paths pass.

### Task 4: Full verification

- [ ] **Step 1: Run `npm run test:run`**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Run `npm run e2e`**
- [ ] **Step 5: Run `git diff --check` and inspect the final status**

Expected: all checks pass, no lint warnings, and no generated build output is added to the working tree.
