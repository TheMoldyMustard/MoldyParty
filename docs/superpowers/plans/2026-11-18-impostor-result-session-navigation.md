# Impostor Result and Session Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route completed-round category changes directly to category setup within the same saved session, and make saved-session cards continue on click with per-card icon actions for rename, statistics, and deletion.

**Architecture:** Keep `AppContent` as the view router and `gameStore` as the owner of session identity. Split completed-round category continuation from exiting to the session manager, consume the existing category intent in the setup UI, and refactor each saved-session card into a container with one primary Continue control plus sibling secondary icon controls. Add name-only session editing so roster identities and accumulated statistics remain unchanged.

**Tech Stack:** React 19, TypeScript, Zustand 5, Vitest/Testing Library, Playwright, CSS.

**Spec:** `docs/feature-analysis/2026-11-18-impostor-result-session-navigation.md`

## Global Constraints

- Preserve the active `SessionRecord`, roster IDs, completed-round count, and `statsByPlayerId` when changing category.
- Keep the persisted Zustand schema at version 4 unless implementation evidence requires a schema change.
- Treat Edit as session-name rename only; do not mutate the stable roster.
- Use valid DOM structure: no interactive element may contain another interactive element.
- Icon-only actions require session-specific accessible names and at least 48px targets.
- Preserve named delete confirmation, Escape cancellation, inert background, and focus restoration.
- Add no dependencies and do not modify Charades behavior.

## Review Focus

- Starting after Change category must update the same session rather than create a second one; Task 1 adds store and App-flow coverage.
- The category destination must be visible/focused without changing the selected category; Task 1 adds UI coverage.
- An unfinished session card must still resume its exact phase when its primary surface is clicked; Task 2 adds App coverage.
- Stats, Edit, and Delete controls must not trigger Continue through bubbling; Task 2 adds interaction coverage.
- Delete cancellation/deletion must restore or relocate focus deterministically for the initiating card; Task 2 adds focus coverage.

---

### Task 1: Same-session category navigation

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/store/gameStore.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/features/game/LobbyScreen.tsx`
- Modify: `src/features/game/CategoryPicker.tsx`

**Interfaces:**
- Consumes: `GameStoreState.changeCategory(): void`, `activeSessionId`, `lobbyIntent`, App-local `lobbyDraft`.
- Produces: category continuation that retains `activeSessionId`; `LobbyScreen` receives/consumes category intent and focuses the category section; result copy uses `Return to sessions` for the manager exit.

- [ ] **Step 1: Write failing store tests**

Add a test proving `changeCategory()` clears the completed `currentGame` but preserves the active session ID, registry record, completed-round count, stats, and setup. Start the next round and assert the registry still has exactly one session.

- [ ] **Step 2: Run the focused store test and verify RED**

Run: `npm run test:run -- src/store/gameStore.test.ts -t "changes category within the active session"`

Expected: FAIL because `activeSessionId` is currently cleared and the next start creates a new session.

- [ ] **Step 3: Implement the store invariant**

Update `changeCategory()` to retain the valid active session while clearing its completed `currentGame`, `game`, and transient round state. Keep `returnToLobby()` as the exit-to-manager command for compatibility.

- [ ] **Step 4: Run the focused store test and verify GREEN**

Run the Step 2 command; expect PASS.

- [ ] **Step 5: Write failing App/category tests**

Add a result-flow test that clicks `Change category` and asserts the setup screen opens directly, the category heading receives focus, the saved roster stays locked, and the same active session remains selected. Update the existing result exit expectation to `Return to sessions` and assert it reaches `Impostor sessions`.

- [ ] **Step 6: Run the focused App tests and verify RED**

Run: `npm run test:run -- src/App.test.tsx src/features/game/GameFlow.test.tsx -t "category|Return to sessions"`

Expected: FAIL because App routes category change to Sessions and no category focus consumer exists.

- [ ] **Step 7: Implement App routing and category focus**

Route `onChangeCategory` through `changeCategory()`, `setLobbyDraft(null)`, and `setView('lobby')`. Pass the one-shot category intent into `LobbyScreen`; let `CategoryPicker` expose a focusable section/heading ref and focus/scroll it after mount without changing the radio selection. Rename result copy to `Return to sessions`.

- [ ] **Step 8: Run Task 1 tests and verify GREEN**

Run: `npm run test:run -- src/store/gameStore.test.ts src/App.test.tsx src/features/game/GameFlow.test.tsx`

Expected: PASS with no warnings.

### Task 2: Direct session cards and per-card actions

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/store/gameStore.test.ts`
- Modify: `src/features/game/SessionManagerScreen.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `onContinue(sessionId)`, `sessionsById`, `deleteSession(sessionId)`.
- Produces: `renameSession(sessionId: string, name: string): void`; a non-interactive card container with primary `Continue <name>` button and `Rename <name>`, `View stats for <name>`, and `Delete <name>` icon buttons.

- [ ] **Step 1: Write failing rename store tests**

Test trimming/default rejection behavior and prove rename changes only `name` and `updatedAt`, preserving roster, setup, stats, and current game.

- [ ] **Step 2: Run the focused rename test and verify RED**

Run: `npm run test:run -- src/store/gameStore.test.ts -t "renames a session"`

Expected: FAIL because `renameSession` does not exist.

- [ ] **Step 3: Implement `renameSession(sessionId: string, name: string): void`**

Ignore missing sessions and blank trimmed names; update the named record and timestamp only.

- [ ] **Step 4: Run the focused rename test and verify GREEN**

Run the Step 2 command; expect PASS.

- [ ] **Step 5: Write failing session-card interaction tests**

Assert the primary session control immediately continues/resumes; Rename opens an accessible per-session form/dialog and updates the visible card without continuing; View stats opens the correct read-only table without continuing; Delete opens the correct named confirmation without continuing; Escape/cancel restores focus to the initiating delete icon; confirmed deletion focuses the next card or Create when empty.

- [ ] **Step 6: Run session-card tests and verify RED**

Run: `npm run test:run -- src/App.test.tsx -t "session|rename|delete"`

Expected: FAIL because cards currently only select and actions are global.

- [ ] **Step 7: Implement card structure, rename UI, and keyed focus handling**

Remove selected-card state and the global action strip except Create. Render each card as a container with a primary continue button and sibling icon buttons. Reuse modal focus containment for delete and rename; track the exact initiating control for restoration and choose deterministic post-delete focus.

- [ ] **Step 8: Run Task 2 tests and verify GREEN**

Run: `npm run test:run -- src/store/gameStore.test.ts src/App.test.tsx`

Expected: PASS with no invalid-DOM or accessibility warnings.

### Task 3: Styling, E2E flow, and documentation

**Files:**
- Modify: `src/styles.css`
- Modify: `e2e/game-flow.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1 result action names/destinations and Task 2 card accessible names.
- Produces: responsive card-level action layout, updated end-to-end selectors, and user documentation matching the new workflow.

- [ ] **Step 1: Update E2E expectations before styling/product changes are complete**

Change the saved-session journey to click `Continue <session>`, exercise per-card stats/delete actions, verify rename persistence, and assert Change category reaches the category section while preserving the same session statistics.

- [ ] **Step 2: Run focused desktop/mobile E2E and verify RED**

Run: `npx playwright test e2e/game-flow.spec.ts --project=desktop-chromium --project=mobile-chromium -g "saved session|category"`

Expected: FAIL on missing new accessible names/layout or new category path.

- [ ] **Step 3: Implement responsive card-action styling and update documentation**

Style card containers, the large primary surface, and per-card icon group with visible focus and 48px targets. Update README session-manager/result-navigation copy, including name-only editing.

- [ ] **Step 4: Run focused E2E and verify GREEN**

Run the Step 2 command; expect PASS in both projects without page overflow or overlapping controls.

- [ ] **Step 5: Run full verification**

Run: `npm run test:run`

Run: `npm run lint`

Run: `npm run build`

Run: `npm run e2e`

Expected: all commands exit 0.

- [ ] **Step 6: Inspect the final diff**

Confirm only scoped source/tests/docs plus the requested analysis/plan are changed, and preserve the pre-existing edit to `docs/feature-analysis/2026-11-14-forehead-charades-mobile-tilt.md` untouched.
