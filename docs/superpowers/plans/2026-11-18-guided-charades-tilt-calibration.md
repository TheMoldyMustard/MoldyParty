# Guided Charades Tilt Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make forehead-charades tilt reliable by learning the player's phone-face-up Correct gesture before gameplay instead of guessing sensor axis, sign, and amplitude.

**Architecture:** Replace scalar neutral-only calibration with a pure two-axis beta/gamma state machine: collect neutral medians, collect a held phone-face-up demonstration, learn a unit vector and bounded threshold, require return to neutral, then arm. The controller exposes each calibration phase; Get Ready waits for `armed` before starting the 3-2-1 countdown. Rotation during Get Ready restarts guided calibration, while rotation during active gameplay disables tilt and leaves tap controls available.

**Tech Stack:** TypeScript, React, Vitest, Testing Library

**Spec:** `docs/feature-analysis/2026-11-14-forehead-charades-mobile-tilt.md`

## Global Constraints

- Phone face up is Correct; the opposite learned direction is Pass.
- Keep permission requests inside the Start gesture and landscape lock best-effort.
- Never emit an outcome before guided calibration is armed.
- Preserve tap/keyboard scoring, store contracts, cleanup, and `orientation: 'any'`.
- Keep sensor calibration ephemeral; add no persistence, telemetry, dependencies, or schema changes.

## Review Focus

- A learned gamma-dominant gesture works even when reported screen angle is `0`.
- Weak/noisy demonstrations cannot arm or produce outcomes.
- Returning neutral is required before gameplay and before re-arming after each outcome.
- Rotation during Get Ready discards the baseline/vector; rotation during gameplay fails tilt closed without affecting taps.
- Permission denial, motion disabled, and calibration failure still start the normal countdown with tap controls.

---

### Task 1: Two-axis guided recognizer

**Files:**
- Modify: `src/features/charades/orientationInput.test.ts`
- Modify: `src/features/charades/orientationInput.ts`

**Interfaces:**
- Produces statuses: `idle | calibrating-neutral | calibrating-correct | returning-neutral | armed | latched | failed`
- Produces `OrientationRecognizer.beginGameplay(): void`
- Keeps `startCalibration(startedAtMs)` and `update(sample, nowMs)` entry points

- [x] **Step 1: Write failing recognizer tests**

Cover: neutral → phone-face-up Correct demonstration → return neutral → armed; gamma-dominant learned axis with angle `0`; learned direction emits Correct and opposite emits Pass; weak demonstration remains `calibrating-correct`; rotation during calibration restarts neutral; `beginGameplay()` makes a later rotation `failed` with no action.

- [x] **Step 2: Verify RED**

Run: `npm run test:run -- src/features/charades/orientationInput.test.ts`

Expected: FAIL because guided statuses/API and learned-vector behavior do not exist.

- [x] **Step 3: Implement guided vector calibration**

Collect median neutral beta/gamma for `calibrationMs` with the existing sample/spread checks. Collect a continuous phone-face-up window for `gestureCalibrationMs` (default 250 ms, at least 3 samples) after magnitude exceeds `minimumGestureMagnitude` (default 16°). Learn the median delta vector, normalize it, and derive the action threshold as `clamp(magnitude * 0.5, neutralThreshold + 4, 30)`, unless `actionThreshold` is explicitly supplied. Require neutral distance for `dwellMs` before arming. During play, project the beta/gamma delta onto the learned vector: positive = Correct, negative = Pass; retain dwell/latch/neutral re-arm.

Track orientation angle only to invalidate calibration. An angle change before `beginGameplay()` restarts neutral calibration; after `beginGameplay()` it sets `failed`.

- [x] **Step 4: Verify GREEN**

Run: `npm run test:run -- src/features/charades/orientationInput.test.ts`

Expected: all recognizer tests pass.

### Task 2: Controller phases and Get Ready gate

**Files:**
- Modify: `src/features/charades/useCharadesDevices.test.ts`
- Modify: `src/features/charades/useCharadesDevices.ts`
- Create: `src/features/charades/GetReadyScreen.test.tsx`
- Modify: `src/features/charades/GetReadyScreen.tsx`

**Interfaces:**
- `CharadesDeviceStatus.motion`: `off | calibrating-neutral | calibrating-correct | returning-neutral | armed | denied | failed`
- `CharadesDeviceController.beginGameplay(): void`
- Get Ready starts its countdown only for `armed | off | denied | failed`

- [x] **Step 1: Write failing controller and screen tests**

Controller: drive the real recognizer through all guided phases and assert phase propagation, no premature outcome, and `beginGameplay()` delegation. Screen: after Start, show neutral/correct/return-neutral instructions and do not count down while calibrating; start at 3 only when armed. Verify motion disabled/denied still starts the countdown and calls `beginGameplay()` at zero.

- [x] **Step 2: Verify RED**

Run: `npm run test:run -- src/features/charades/useCharadesDevices.test.ts src/features/charades/GetReadyScreen.test.tsx`

Expected: FAIL because phase statuses, controller method, and countdown gate do not exist.

- [x] **Step 3: Implement controller and Get Ready integration**

Map recognizer calibration statuses directly to device status. Add `beginGameplay()` forwarding. In Get Ready, separate `started` from `countdown`; render phase-specific accessible instructions; begin the countdown only after armed or a tap-only terminal status; call `devices.beginGameplay()` immediately before `charadesStore.beginTurn()`.

- [x] **Step 4: Verify GREEN**

Run: `npm run test:run -- src/features/charades/useCharadesDevices.test.ts src/features/charades/GetReadyScreen.test.tsx`

Expected: all controller and screen tests pass.

### Task 3: Compatibility, documentation, and full verification

**Files:**
- Modify as required by type/test fallout: `src/features/charades/CharadesGame.tsx`, existing Charades tests
- Modify: `README.md`
- Modify: `docs/feature-analysis/2026-11-14-forehead-charades-mobile-tilt.md`

**Interfaces:**
- Consumes the guided statuses/controller contract from Tasks 1–2
- Preserves all existing gameplay, fallback, and lifecycle contracts

- [x] **Step 1: Resolve compatibility failures without widening scope**

Run the full suite; update only consumers whose compile/test assumptions depended on neutral-only calibration or the old motion union.

- [x] **Step 2: Update documentation**

Document phone-face-up = Correct, opposite = Pass, and the guided calibration flow. Reconcile the analysis verdict and cascade-map dispositions with implemented behavior while retaining physical-device uncertainty.

- [x] **Step 3: Run full verification**

Run: `npm run test:run`, `npm run lint`, and `npm run build`.

Expected: all tests pass; lint and build exit successfully.

- [x] **Step 4: Inspect final scope**

Run: `git diff --check` and `git status --short`.

Expected: only guided-calibration code, tests, plan, README, and canonical analysis are modified.
