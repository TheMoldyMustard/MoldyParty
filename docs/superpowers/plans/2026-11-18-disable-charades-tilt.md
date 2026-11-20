# Disable Charades Tilt Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Forehead Charades tilt controls from being enabled while presenting them as work in progress.

**Architecture:** Enforce the temporary shutdown at the setup boundary. The UI exposes a disabled unchecked control, and session construction uses a literal `false` so new gameplay never starts motion services.

**Tech Stack:** TypeScript, React, Vitest, Testing Library

**Spec:** `docs/superpowers/specs/2026-11-18-disable-charades-tilt-design.md`

## Global Constraints

- Keep tap and keyboard controls unchanged.
- Keep the existing motion implementation and settings schema intact.
- Every newly created Charades session must have `motionEnabled: false`.
- The disabled control must be visible and identified as work in progress.

## Review Focus

- A player cannot toggle Tilt controls on.
- The control remains unchecked even after interaction attempts.
- Starting a game produces a session with motion disabled.
- Existing tap-based game startup remains functional.
- Other device preferences remain editable.

---

### Task 1: Disable tilt at the Charades setup boundary

**Files:**
- Modify: `src/features/charades/CharadesFlow.test.tsx`
- Modify: `src/features/charades/CharadesSetupScreen.tsx`
- Modify: `src/features/charades/GetReadyScreen.test.tsx`
- Modify: `src/features/charades/GetReadyScreen.tsx`

**Interfaces:**
- Consumes: `CharadesSettings.motionEnabled: boolean`
- Produces: new sessions with `motionEnabled: false`

- [ ] **Step 1: Write the failing setup integration test**

Add a test that opens Forehead Charades, finds `Tilt controls — Work in progress`, asserts that its checkbox is disabled and unchecked, attempts interaction, starts the game, and asserts `charadesStore.getState().session?.settings.motionEnabled` is `false`.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm run test:run -- src/features/charades/CharadesFlow.test.tsx`

Expected: FAIL because the existing Tilt controls checkbox is enabled, checked, and lacks work-in-progress copy.

- [ ] **Step 3: Implement the setup guard**

Remove mutable `motionEnabled` setup state. Render the Tilt controls checkbox with `checked={false}` and `disabled`, use the label `Tilt controls — Work in progress`, show `Use tap controls for now`, construct settings with `motionEnabled: false`, and pass `motionEnabled: false` to device startup for recovered legacy sessions.

- [ ] **Step 4: Verify focused and full checks**

Run `npm run test:run -- src/features/charades/CharadesFlow.test.tsx`, then `npm run test:run`, `npm run lint`, `npm run build`, and `git diff --check`.

Expected: all commands exit successfully.

- [ ] **Step 5: Commit, push, and merge**

Commit on `codex/disable-charades-tilt`, push the branch, merge to `main`, re-run the full verification on merged `main`, and push `main`.
