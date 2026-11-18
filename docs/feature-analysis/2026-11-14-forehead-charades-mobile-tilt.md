# Forehead Charades Mobile Tilt Feature Analysis

## 1. Executive verdict

Scope: the Forehead Charades tilt path from the Get Ready gesture through browser permission, `deviceorientation` events, calibration, outcome submission, and cleanup. The feature owner is the Charades device layer in `src/features/charades/useCharadesDevices.ts`, with recognition isolated in `orientationInput.ts`.

Manual phone rotation was a confirmed trigger for the reported failure and is fixed in the current worktree. The app still attempts `screen.orientation.lock('landscape')` as a best-effort enhancement, but an observable angle change during calibration or active play now clears stale gesture state, starts a fresh one-second neutral calibration at the new angle, reports `calibrating`, and returns to `armed` after stable samples without emitting an outcome. Angle changes are processed even when that sensor event lacks beta/gamma values, and an unstable recovery window keeps recalibrating rather than permanently disabling tilt. If `screen.orientation` is absent, the safe `0` fallback avoids the previous crash but still cannot describe a manually rotated landscape screen, so beta/gamma normalization may use the wrong axis. Physical-device incidence and that missing-angle branch remain unverified.

Coupling is moderate: the path crosses permission, sensor events, screen orientation, persisted game state, audio/haptics, wake lock, lifecycle cleanup, and CSS feedback. It remains removable as a progressive enhancement because tap controls are independent. The implemented fix keeps landscape lock best-effort and recovers through recalibration rather than forcing the PWA manifest to landscape; the manifest remains intentionally `orientation: 'any'` because setup and recap support portrait.

## 2. Feature anatomy

1. `GetReadyScreen` calls `devices.start()` from the explicit Start Get Ready button, passing the persisted motion preference.
2. The controller requests orientation permission, unlocks audio, acquires wake lock, attempts landscape lock, then immediately starts calibration plus a `deviceorientation` listener when permission is granted.
3. `orientationInput.ts` collects one second of samples, requires at least eight samples with spread no greater than eight degrees, then compares screen-relative tilt against a baseline. A 25-degree delta held for 100 ms emits one semantic outcome and requires returning within eight degrees of neutral before re-arming.
4. `CharadesGame` routes a recognized outcome through the same token-guarded store submission used by taps. `ActiveRoundScreen` supplies the visible tap zones and feedback.
5. Only after `devices.start()` resolves does the three-second countdown begin and, when lock failed, tell the player to rotate. Rotation at this point now restarts calibration at the new angle; outcomes remain suppressed until the new baseline arms.
6. Stop/unmount removes the sensor and visibility listeners, releases wake lock and orientation lock, disposes audio, and resets device status.

## 3. Cascade map

| ID | Provider → interface → consumer | Effect | Risk | Confidence | Evidence | Disposition |
|---|---|---|---|---|---|---|
| E1 | `GetReadyScreen.start` → `CharadesDeviceController.start` → device orchestration | Starts all optional device services from the user gesture. | Medium | Confirmed | `src/features/charades/GetReadyScreen.tsx:30-37`; `useCharadesDevices.ts:94-128` | Preserve; keep permission request inside the gesture call stack. |
| E2 | `window.DeviceOrientationEvent` → `requestOrientationPermission` → controller | Permission is granted, denied, or unavailable; denied/unavailable leaves tap play available. | High | Confirmed | `orientationPermission.ts:7-17`; `useCharadesDevices.ts:98-125` | Preserve progressive fallback; test absent constructor and denied permission. |
| E3 | `screen.orientation` → `lockLandscape` and `getAngle` → sensor callback | Lock is best-effort; every sample depends on the reported angle. Missing angle safely becomes `0`, which is not proof that the screen is portrait. | High | Confirmed | `useCharadesDevices.ts:161-182`; `orientationLock.ts:7-19`; `vite.config.ts:14-24` | Preserve the safe adapter; distinguish unknown angle from a real zero or add a tested fallback source. |
| E4 | `deviceorientation` → `OrientationRecognizer.update` → `onOutcome` | Calibration, threshold, dwell, latch, and neutral reset convert motion into Correct/Pass. | High | Confirmed | `useCharadesDevices.ts:70-82`; `orientationInput.ts:62-115` | Preserve; add an integration test for missing angle capability. |
| E5 | `onOutcome` → `charadesStore.submitOutcome` → active card/recap state | Sensor and tap input share the card token and event-count guard, preventing duplicate scoring. | High | Confirmed | `CharadesGame.tsx:17-24`; `ActiveRoundScreen.tsx:25-36` | Preserve contract; no store change required for the compatibility fix. |
| E6 | visibility/phase/unmount → wake lock, listener, orientation, audio cleanup | Backgrounding and exit release optional resources. | Medium | Confirmed | `useCharadesDevices.ts:85-91,130-140`; `CharadesGame.tsx:27-35` | Preserve; add mobile lifecycle coverage if sensor testing is expanded. |
| E7 | recognizer status → `deviceStatus.motion` → UI status | Rotation recovery publishes `calibrating`, then restores `armed`; active UI falls back to “Tap controls” during the bounded transition. | Low | Confirmed | `useCharadesDevices.ts:70-83`; `useCharadesDevices.test.ts:100-137`; `ActiveRoundScreen.tsx:76-80` | Implemented; optional copy could distinguish recalibration from generic tap fallback. |
| E8 | mobile Playwright project → Charades E2E flows | Mobile layout and tap fallback are covered, but no sensor permission/event simulation exists. | Medium | Confirmed | `playwright.config.ts:13-15`; `e2e/charades-flow.spec.ts:31-53` | Add a focused simulated-sensor test after the seam is fixed. |
| E9 | countdown/rotate prompt → user rotation → recalibration | The prompt is displayed after initial calibration begins; a reported right-angle change resets timing, samples, baseline, and gesture candidate before collecting a new baseline. Invalid-axis events still reset by angle, and unstable recovery windows retry. | Low | Confirmed | `GetReadyScreen.tsx:30-47`; `orientationInput.ts:54-103`; `orientationInput.test.ts:42-84` | Implemented; preserve the no-outcome transition, repeated-rotation reset, and recovery retry. |
| E10 | missing `screen.orientation` → `getOrientationAngle` fallback → normalization | Manual landscape rotation can remain reported as angle `0`, selecting beta where landscape normalization expects gamma. | High | Inferred from confirmed branches; device incidence unverified | `orientationLock.ts:7-10`; `orientationInput.ts:20-25`; `deviceServices.test.ts:45-49` | Represent angle availability explicitly and validate the fallback on target browsers. |
| E11 | `normalizeForwardTilt` sign → recognizer outcome | Positive delta always means Correct and negative always means Pass; device-specific direction remains a physical-QA risk. | Medium | Confirmed mapping; inversion unverified | `orientationInput.ts:20-25,93-114`; `orientationInput.test.ts:22-28` | Calibrate direction/sign only if physical QA proves inversion after E9/E10 are fixed. |
| E12 | raw sensor delta → threshold/dwell/latch | A raw 25° excursion sustained across samples for 100 ms emits an outcome; no filtering exists. | Medium | Confirmed behavior; noise failure unverified | `orientationInput.ts:38-40,93-114`; `orientationInput.test.ts:22-23` | Tune only with captured device traces after the rotation defect is removed. |
| E13 | accepted outcome → `.charades-flash` CSS overlay | Correct uses green; Pass uses orange. Both include text. | Low | Confirmed | `ActiveRoundScreen.tsx:32-35,95`; `styles.css:387-389` | Visual improvement is independent of the tilt failure. |

## 4. Isolation/disassembly

The implemented rotation fix is isolated at E4/E7/E9 without touching domain rules, scoring, persistence, audio, or haptics. The missing-angle risk remains isolated at E3/E10.

Prerequisites:

- Preserve permission requests inside the Start gesture and the best-effort landscape-lock adapter.
- Define an orientation-readiness contract: known/stable angle, unknown angle, and changed angle must not collapse into one numeric fallback.
- Keep recalibration inside the device/recognizer layer so tap scoring and store contracts remain unchanged.

Ordered cuts and validation:

1. Completed at E7/E9: replace permanent failure on angle change with a bounded recalibration transition. Candidates and samples are cleared, a new stable baseline is collected, and no outcome is submitted during the transition. Rollback is recognizer/controller only.
2. Validate the completed transition on physical devices after lock success/rejection in portrait, landscape-left, and landscape-right, including repeated rotations and tap availability. Rollback is operational only.
3. Make unavailable angle explicit (E3/E10). Validate the browser fallback against real portrait and manual-landscape sensor streams; disable motion with an actionable message if correct normalization cannot be established. Rollback preserves the current safe-zero behavior.
4. Completed at E4/E9: controller coverage drives angle 0→90, verifies `calibrating`, confirms no outcome, and observes recovery to `armed`. Browser-level sensor simulation remains optional E8 coverage.
5. Run the physical matrix before changing sign or thresholds (E11/E12). Rollback is operational because no product behavior changes in this phase.

Compatibility effect: the current tap path, store schema, timers, and summaries do not depend on tilt and should remain unchanged. No persisted sensor samples or external systems are involved.

## 5. Improvements

Required rotation recovery is implemented. “Force rotate” remains a best-effort call through `screen.orientation.lock('landscape')`; making it mandatory is not a sufficient recovery strategy within the current capability contract.

Optional, evidence-backed enhancements:

- Add a `screen.orientation`-absent controller regression test; current controller tests inject a constant angle.
- Show explicit “rotate first,” “hold still/calibrating,” and “tilt ready” states.
- Capture normalized sample traces during physical QA before tuning sign, filtering, dwell, or thresholds.
- Keep Correct/Pass text; changing Pass from orange to red is an independent UI decision.

## 6. Uncertainty and coverage boundary

- No physical mobile browser or sensor stream was available; E10 missing-angle behavior, axis/sign behavior, usable thresholds, and browser/version-specific incidence remain unverified.
- The inspected E2E suite covers mobile Chromium tap journeys, not real or simulated `deviceorientation`, orientation-lock rejection, or manual rotation.
- No additional dependency was found within the inspected scope after focused searches for tilt, orientation, permission, motion, and mobile references.

Implementation verification: `npm run test:run` — 22 files / 192 tests passed; `npm run lint` passed; `npm run build` passed. Focused regressions cover rotation during calibration, rotation after arming, invalid-axis rotation events, unstable recovery windows, no outcome during recalibration, controller `calibrating` status, and recovery to `armed`.
