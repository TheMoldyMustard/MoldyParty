# MoldyParty System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the current MoldyParty flow for future games by stabilizing setup layouts, redirecting successful pack imports, and replacing hold-to-reveal with drag-up reveal.

**Architecture:** Keep the current React/Zustand/Dexie architecture and local `AppView` navigation. Changes are limited to screen composition, callbacks, CSS layout, and transient reveal gesture state; domain rules and persistence schemas remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, Dexie, Vitest/Testing Library, Playwright.

**Spec:** `docs/feature-plans/2026-11-03-system-redesign.md`

## Global Constraints

- Preserve offline-first behavior and current pack/game persistence.
- Preserve privacy masking on blur, pointer cancellation, hidden documents, and restored rounds.
- Do not change role assignment, validation, voting, timer, or pack schemas.
- Keep controls keyboard accessible and responsive from 320px upward.

## Review Focus

- Toggling Outlier and timer options must not reorder unrelated setup controls; test in `LobbyScreen` behavior coverage.
- Long custom pack names must not change card height or overflow; test category rendering with long labels.
- Invalid JSON import must remain on the import view; test the import callback only fires after persistence succeeds.
- Short/downward/horizontal gestures must not reveal a role; test pointer movement thresholds in `GameFlow.test.tsx`.
- Long secret words must wrap inside the reveal surface; cover with narrow viewport/e2e or DOM style assertions where practical.

### Task 1: Landing shell and setup layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/game/LobbyScreen.tsx`
- Modify: `src/features/game/CategoryPicker.tsx`
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`, `src/features/game/GameFlow.test.tsx`

- [ ] Add/update failing assertions for product-level landing copy, grouped round rules, stable conditional rows, and equal category-card rendering.
- [ ] Run the focused tests and confirm failure for missing behavior.
- [ ] Update landing copy and introduce semantic grouped rules with reserved Outlier/timer slots; preserve draft payloads.
- [ ] Update category grid/card CSS to use equal tracks, stretch cards, and wrap long names.
- [ ] Run focused tests and confirm pass.

### Task 2: Import redirect and selected-pack handoff

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/game/LobbyScreen.tsx`
- Modify: `src/features/packs/PackManager.tsx`
- Test: `src/features/packs/PackManager.test.tsx`, `src/features/game/GameFlow.test.tsx`

- [ ] Add a failing test proving a valid import invokes a completion callback with the pack id and returns to Build your round with the imported pack selected.
- [ ] Run the focused tests and confirm failure.
- [ ] Add `onImported(packId: string)` callback, wire it through App view state, and apply the selection after custom packs load; keep parse/storage failures in place.
- [ ] Run focused tests and confirm pass.

### Task 3: Drag-up private reveal

**Files:**
- Modify: `src/features/game/RoleRevealScreen.tsx`
- Modify: `src/styles.css`
- Test: `src/features/game/GameFlow.test.tsx`, `e2e/game-flow.spec.ts`

- [ ] Add failing pointer-event tests for thresholded upward reveal, non-reveal for short/downward movement, persistent visibility after release, and privacy masking.
- [ ] Run focused tests and confirm failure.
- [ ] Implement pointer-captured drag state with a 56px upward threshold, keyboard fallback, updated accessible copy, and long-word wrapping styles.
- [ ] Run focused tests and confirm pass.

### Task 4: Full verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run test:run`.
- [ ] Run `npm run build`.
- [ ] Run `npm run e2e`.
- [ ] Review the diff for scope, accessibility, and privacy regressions.

