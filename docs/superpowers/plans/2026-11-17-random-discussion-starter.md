# Random Discussion Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Randomly choose and display the player who starts each impostor-game discussion.

**Architecture:** Persist an optional starter player ID in `GameState`. Select it with the store's injected random source only when the final role confirmation enters discussion, then resolve the ID to a name in the discussion UI.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-11-17-random-discussion-starter-design.md`

## Global Constraints

- Any round player can be selected, regardless of role.
- Selection occurs only on the role-reveal to discussion transition and remains stable afterward.
- Existing persisted games without the optional field remain valid.
- Timer and voting behavior must not change.

## Review Focus

- Random values at `0` and near `1` select the first and last valid player without an out-of-range index; cover in Task 1.
- Non-final role confirmations do not select or replace a starter; cover in Task 1.
- Repeated calls after entering discussion do not reroll the starter; cover in Task 1.
- Legacy saved games without the optional starter field still hydrate; cover in Task 1.
- The UI handles a temporarily missing or invalid starter ID without crashing; cover in Task 2.

---

### Task 1: Persist a deterministic discussion starter

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/game.ts`
- Modify: `src/store/gameStore.ts`
- Test: `src/domain/game.test.ts`
- Test: `src/store/gameStore.test.ts`

**Interfaces:**
- Consumes: the existing `random: () => number` injected into `createGameStore`.
- Produces: `GameState.discussionStarterPlayerId?: string` and `advanceRoleReveal(state, random?)`.

- [ ] **Step 1: Write failing domain and store tests** asserting that only the final confirmation selects the indexed player, boundary random values stay in range, later calls keep the same ID, and legacy state without the field hydrates.
- [ ] **Step 2: Run `npm test -- src/domain/game.test.ts src/store/gameStore.test.ts`** and confirm the new assertions fail because no starter is selected.
- [ ] **Step 3: Add the optional field and minimal transition logic**, passing the store's injected random function into `advanceRoleReveal`.
- [ ] **Step 4: Run `npm test -- src/domain/game.test.ts src/store/gameStore.test.ts`** and confirm both files pass.
- [ ] **Step 5: Commit the domain/store change and its tests.**

### Task 2: Show the starter on the discussion screen

**Files:**
- Modify: `src/features/game/DiscussionScreen.tsx`
- Test: `src/features/game/GameFlow.test.tsx`

**Interfaces:**
- Consumes: `GameState.discussionStarterPlayerId?: string` from Task 1.
- Produces: prominent copy in the form “Alex starts the discussion”.

- [ ] **Step 1: Write a failing interface test** that completes all role reveals and expects the deterministic starter's name, plus a render test proving a missing or invalid ID does not crash.
- [ ] **Step 2: Run `npm test -- src/features/game/GameFlow.test.tsx`** and confirm the starter-copy assertion fails.
- [ ] **Step 3: Resolve the starter ID against `game.players`** and render the instruction above the existing discussion description when a matching player exists.
- [ ] **Step 4: Run `npm test -- src/features/game/GameFlow.test.tsx`** and confirm it passes.
- [ ] **Step 5: Commit the UI change and its test.**

### Task 3: Full verification

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed Tasks 1 and 2.
- Produces: verification evidence for the finished feature.

- [ ] **Step 1: Run `npm run test:run`** and confirm the full Vitest suite passes.
- [ ] **Step 2: Run `npm run lint`** and confirm ESLint reports no errors.
- [ ] **Step 3: Run `npm run build`** and confirm TypeScript and Vite complete successfully.
- [ ] **Step 4: Review `git diff --check` and `git status --short`**, confirming only intended files changed and the pre-existing user edit remains untouched.
