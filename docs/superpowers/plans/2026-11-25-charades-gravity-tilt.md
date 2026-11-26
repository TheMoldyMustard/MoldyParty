# Charades Gravity Tilt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Euler-angle tilt recognition with normalized gravity vectors, then safely re-enable Forehead Charades tilt controls.

**Architecture:** A pure `TiltRecognizer` learns neutral and Correct gravity vectors and emits Correct/Pass from signed displacement projection. The device controller adapts browser `devicemotion` events and permission into that pure input while existing UI/store contracts remain intact.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, Vite PWA

**Spec:** `docs/superpowers/specs/2026-11-25-charades-gravity-tilt-design.md`

## Global Constraints

- Keep landscape behavior scoped to Charades; leave manifest `orientation: 'any'`.
- Keep permission requests inside Start Get Ready.
- Preserve tap/keyboard controls and all scoring/store contracts.
- Persist no sensor samples and add no dependency.
- Follow RED→GREEN for every production behavior change.

## Review Focus

- Gravity vectors remain continuous for landscape-vertical poses that crossed the Euler boundary.
- The opposite physical tilt emits Pass after Correct calibration.
- Missing, zero-length, or malformed gravity samples never arm or score.
- Permission denial/unavailability and lock rejection preserve tap play.
- Listener and orientation resources are released on stop and remount safely.

---

### Task 1: Pure gravity-vector recognizer

**Files:**
- Create: `src/features/charades/tiltInput.test.ts`
- Create: `src/features/charades/tiltInput.ts`

**Interfaces:**
- Produces: `GravitySample { x, y, z, angle }`, `TiltRecognizerStatus`, `TiltRecognizer`, `createTiltRecognizer(options?)`.

- [ ] Write failing tests for guided calibration, symmetric Correct/Pass around a landscape-vertical neutral vector, neutral stability across the former Euler boundary, invalid vectors, rotation fail-closed, latch, and neutral re-arm.
- [ ] Run `npm run test:run -- src/features/charades/tiltInput.test.ts`; expect failure because `tiltInput.ts` does not exist.
- [ ] Implement normalized-vector helpers and the minimal recognizer state machine with the existing phase/timing semantics and degree-to-chord thresholds.
- [ ] Run the focused test; expect all tests to pass.
- [ ] Commit `fix: recognize charades tilt from gravity vectors`.

### Task 2: Device Motion controller integration

**Files:**
- Create: `src/features/charades/sensorPermission.ts`
- Modify: `src/features/charades/deviceServices.test.ts`
- Modify: `src/features/charades/useCharadesDevices.test.ts`
- Modify: `src/features/charades/useCharadesDevices.ts`
- Delete: `src/features/charades/orientationPermission.ts`
- Delete: `src/features/charades/orientationInput.ts`
- Delete: `src/features/charades/orientationInput.test.ts`

**Interfaces:**
- Consumes: `createTiltRecognizer`, `GravitySample` from Task 1.
- Produces: unchanged `CharadesDeviceController` and `CharadesDeviceStatus`; browser adapter uses `DeviceMotionEvent` and `devicemotion`.

- [ ] Write failing controller/service tests that dispatch complete `accelerationIncludingGravity` events, reject missing vectors, verify permission behavior, and verify listener cleanup.
- [ ] Run focused controller/service tests; expect failures against the orientation-event adapter.
- [ ] Generalize permission handling, replace the browser listener/sample adapter, and remove the obsolete Euler recognizer only after all references migrate.
- [ ] Run recognizer, controller, and device-service tests; expect all to pass.
- [ ] Commit `fix: feed charades tilt from device motion`.

### Task 3: Re-enable tilt through setup and Get Ready

**Files:**
- Modify: `src/features/charades/CharadesFlow.test.tsx`
- Modify: `src/features/charades/CharadesSetupScreen.tsx`
- Modify: `src/features/charades/GetReadyScreen.test.tsx`
- Modify: `src/features/charades/GetReadyScreen.tsx`

**Interfaces:**
- Consumes: existing `CharadesSettings.motionEnabled` and controller start option.
- Produces: default-on selectable tilt for new sessions and persisted-setting behavior for recovered sessions.

- [ ] Change integration tests first to require an enabled, checked-by-default Tilt control, opt-out persistence, and recovered-session forwarding.
- [ ] Run the two focused UI test files; expect failures from the current literal shutdown guards.
- [ ] Restore setup state and pass `session.settings.motionEnabled` into `devices.start`, retaining tap fallback copy.
- [ ] Run focused UI and controller tests; expect all to pass.
- [ ] Commit `feat: re-enable charades tilt controls`.

### Task 4: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/feature-analysis/2026-11-14-forehead-charades-mobile-tilt.md`

**Interfaces:**
- Consumes: implemented gravity-vector behavior and fresh verification output.
- Produces: current user/developer documentation and final evidence.

- [ ] Update docs to distinguish gravity-vector recognition from best-effort landscape lock and retain the physical-device QA limitation.
- [ ] Run `npm run test:run`, `npm run lint`, `npm run build`, and `git diff --check`; expect every command to pass.
- [ ] Search for obsolete `deviceorientation`, beta/gamma recognizer, and work-in-progress shutdown references; expect none in active code/docs except historical analysis where explicitly contextualized.
- [ ] Commit `docs: document gravity-based charades tilt`.
