# Forehead Charades Rotation Recalibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep forehead-charades tilt input usable when the player manually rotates the phone after orientation lock is unavailable or rejected.

**Architecture:** The orientation recognizer remains the owner of calibration and gesture state. A right-angle change clears the current gesture candidate and restarts neutral calibration at the new angle instead of permanently failing; the device controller reports `calibrating` during that transition and returns to `armed` only after a stable baseline is collected. Scoring, tap fallback, orientation locking, and persistence remain unchanged.

**Tech Stack:** TypeScript, React, Vitest

**Spec:** `docs/feature-analysis/2026-11-14-forehead-charades-mobile-tilt.md`

## Global Constraints

- Keep `screen.orientation.lock('landscape')` best-effort and retain manifest `orientation: 'any'`.
- Never submit an outcome while recalibrating.
- Preserve tap/keyboard scoring and existing device cleanup behavior.
- Add no dependencies and make no schema or persistence changes.

## Review Focus

- Rotation during initial calibration restarts the one-second window and cannot arm from mixed-axis samples.
- Rotation after arming immediately reports `calibrating`, emits no outcome, and can arm again.
- Repeated rotations discard earlier samples and candidates rather than accumulating stale state.
- A held tilt before rotation cannot emit after recalibration without a fresh post-baseline gesture.
- Stable-orientation Correct/Pass, latch, neutral re-arm, permission denial, and cleanup continue to work.

---

### Task 1: Rotation-aware recognizer

**Files:**
- Modify: `src/features/charades/orientationInput.test.ts`
- Modify: `src/features/charades/orientationInput.ts`

**Interfaces:**
- Consumes: `OrientationSample`, `OrientationRecognizer.update(sample, nowMs)`
- Produces: the existing `OrientationRecognizerStatus` contract, with angle changes returning `calibrating` instead of `failed`

- [ ] **Step 1: Write failing recognizer tests**

Add tests proving rotation during calibration resets the timer/samples and rotation after arming returns `calibrating`, emits no action, and re-arms after a fresh stable baseline.

- [ ] **Step 2: Verify the tests fail for the current permanent-failure behavior**

Run: `npm run test:run -- src/features/charades/orientationInput.test.ts`

Expected: FAIL because `getStatus()`/`update().status` is `failed`, not `calibrating`/`armed`.

- [ ] **Step 3: Implement minimal recalibration transition**

In `createOrientationRecognizer`, centralize calibration reset so `startCalibration()` and a normalized-angle change both clear samples/candidates and start a new calibration window at the current timestamp and angle.

- [ ] **Step 4: Verify recognizer tests pass**

Run: `npm run test:run -- src/features/charades/orientationInput.test.ts`

Expected: all recognizer tests pass.

### Task 2: Controller status integration

**Files:**
- Modify: `src/features/charades/useCharadesDevices.test.ts`
- Modify: `src/features/charades/useCharadesDevices.ts`

**Interfaces:**
- Consumes: recognizer result status `calibrating`
- Produces: `CharadesDeviceStatus.motion === 'calibrating'` during rotation recovery

- [ ] **Step 1: Write a failing controller regression test**

Drive the real recognizer through angle `0` calibration, rotate the injected angle to `90`, assert no outcome and `motion: 'calibrating'`, then provide a stable new baseline and assert `motion: 'armed'`.

- [ ] **Step 2: Verify the controller test fails**

Run: `npm run test:run -- src/features/charades/useCharadesDevices.test.ts`

Expected: FAIL because the controller currently leaves the prior motion status unchanged for recognizer status `calibrating`.

- [ ] **Step 3: Map recognizer recalibration to controller status**

Update `onOrientation` to publish `motion: 'calibrating'` when the recognizer reports that status.

- [ ] **Step 4: Verify controller tests pass**

Run: `npm run test:run -- src/features/charades/useCharadesDevices.test.ts`

Expected: all controller tests pass.

### Task 3: Full verification and documentation reconciliation

**Files:**
- Modify: `docs/feature-analysis/2026-11-14-forehead-charades-mobile-tilt.md`

**Interfaces:**
- Consumes: implemented behavior and fresh verification results
- Produces: analysis report that distinguishes the fixed rotation race from remaining physical-device uncertainty

- [ ] **Step 1: Run full verification**

Run: `npm run test:run`, `npm run lint`, and `npm run build`.

Expected: all tests pass; lint and build exit successfully.

- [ ] **Step 2: Update the analysis report**

Record that rotation now recalibrates, cite the regression tests, keep missing-angle/manual-landscape behavior and physical-device validation as unresolved where still applicable.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only the plan, analysis, recognizer, controller, and their tests are modified.
