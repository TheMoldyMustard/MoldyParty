# Forehead Charades Mobile Tilt Feature Analysis

## 1. Executive verdict

Scope: the Forehead Charades tilt path from the Get Ready gesture through browser permission, `deviceorientation` events, calibration, outcome submission, and cleanup. The feature owner is the Charades device layer in `src/features/charades/useCharadesDevices.ts`, with recognition isolated in `orientationInput.ts`.

The latest physical-phone report showed that rotation recovery was necessary but insufficient. The confirmed design gap was neutral-only scalar calibration: it did not learn which beta/gamma direction the player's phone produced for **phone face up**, how large that gesture was, or whether the fixed 25° threshold was reachable. The implementation now learns a two-axis face-up vector as Correct, derives a bounded threshold from that demonstration, and treats the opposite projection as Pass. Physical-device validation is still required because no sensor trace from the reported phone is available.

Coupling is moderate: the path crosses permission, sensor events, screen orientation, Get Ready timing, controller status, scoring, audio/haptics, and cleanup. The user-confirmed product requirement is **phone face up = Correct**. A guided calibration would directly address the gap if it learns that two-dimensional beta/gamma gesture vector as Correct and treats the opposite direction as Pass. Learning only the sign of the current normalized scalar would not fix browsers where screen angle is missing and the wrong axis is selected. Tap controls remain an independent fallback.

## 2. Feature anatomy

1. `GetReadyScreen` calls `devices.start()` from the explicit Start Get Ready button, passing the persisted motion preference.
2. The controller requests orientation permission, unlocks audio, acquires wake lock, attempts landscape lock, then immediately starts calibration plus a `deviceorientation` listener when permission is granted.
3. `orientationInput.ts` collects one second of neutral beta/gamma samples, then collects a deliberate phone-face-up demonstration and learns its unit vector plus a bounded action threshold.
4. Active recognition projects the live beta/gamma delta onto the learned vector: the demonstrated direction is Correct, the opposite is Pass, and dwell/latch/neutral re-arm suppress repeated or jittery outcomes.
5. `GetReadyScreen` waits through neutral, phone-face-up, and return-neutral phases before starting its fixed three-second countdown. Motion-disabled, denied, or failed states proceed with tap controls.
6. `CharadesGame` routes a recognized outcome through the same token-guarded store submission used by taps. Stop/unmount cleans up device services and listeners.

## 3. Cascade map

| ID | Provider → interface → consumer | Effect | Risk | Confidence | Evidence | Disposition |
|---|---|---|---|---|---|---|
| E1 | `GetReadyScreen.start` → `CharadesDeviceController.start` → device orchestration | Starts all optional device services from the user gesture. | Medium | Confirmed | `src/features/charades/GetReadyScreen.tsx:30-37`; `useCharadesDevices.ts:94-128` | Preserve; keep permission request inside the gesture call stack. |
| E2 | `window.DeviceOrientationEvent` → `requestOrientationPermission` → controller | Permission is granted, denied, or unavailable; denied/unavailable leaves tap play available. | High | Confirmed | `orientationPermission.ts:7-17`; `useCharadesDevices.ts:98-125` | Preserve progressive fallback; test absent constructor and denied permission. |
| E3 | `screen.orientation` → `lockLandscape` and `getAngle` → sensor callback | Lock is best-effort; every sample depends on the reported angle. Missing angle safely becomes `0`, which is not proof that the screen is portrait. | High | Confirmed | `useCharadesDevices.ts:161-182`; `orientationLock.ts:7-19`; `vite.config.ts:14-24` | Preserve the safe adapter; distinguish unknown angle from a real zero or add a tested fallback source. |
| E4 | `deviceorientation` beta/gamma → learned-vector projection → `OrientationRecognizer.update` | Calibration retains neutral medians and an ephemeral two-axis Correct direction. | High | Confirmed | `useCharadesDevices.ts`; `orientationInput.ts` | Implemented with focused recognizer/controller tests. |
| E5 | `onOutcome` → `charadesStore.submitOutcome` → active card/recap state | Sensor and tap input share the card token and event-count guard, preventing duplicate scoring. | High | Confirmed | `CharadesGame.tsx:17-24`; `ActiveRoundScreen.tsx:25-36` | Preserve contract; no store change required for the compatibility fix. |
| E6 | visibility/phase/unmount → wake lock, listener, orientation, audio cleanup | Backgrounding and exit release optional resources. | Medium | Confirmed | `useCharadesDevices.ts:85-91,130-140`; `CharadesGame.tsx:27-35` | Preserve; add mobile lifecycle coverage if sensor testing is expanded. |
| E7 | recognizer status → `deviceStatus.motion` → Get Ready/active UI | Explicit neutral, Correct-demonstration, return-neutral, armed, and failure phases drive accessible instructions. | High | Confirmed | `useCharadesDevices.ts`; `GetReadyScreen.tsx`; `ActiveRoundScreen.tsx` | Implemented; active UI continues to expose motion failure and tap fallback. |
| E8 | mobile Playwright project → Charades E2E flows | Mobile layout and tap fallback are covered, but no sensor permission/event simulation exists. | Medium | Confirmed | `playwright.config.ts:13-15`; `e2e/charades-flow.spec.ts:31-53` | Add a focused simulated-sensor test after the seam is fixed. |
| E9 | countdown/rotate prompt → user rotation → recalibration | The prompt is displayed after initial calibration begins; a reported right-angle change resets timing, samples, baseline, and gesture candidate before collecting a new baseline. Invalid-axis events still reset by angle, and unstable recovery windows retry. | Low | Confirmed | `GetReadyScreen.tsx:30-47`; `orientationInput.ts:54-103`; `orientationInput.test.ts:42-84` | Implemented; preserve the no-outcome transition, repeated-rotation reset, and recovery retry. |
| E10 | missing `screen.orientation` → angle `0` fallback → learned-vector recognition | A gamma-dominant face-up gesture can be learned even when the reported screen angle is `0`. | Critical | Confirmed in unit tests; reported device unverified | `orientationLock.ts`; `orientationInput.ts`; `orientationInput.test.ts` | Implemented; angle now invalidates calibration instead of selecting the gesture axis. |
| E11 | demonstrated physical direction → semantic outcome | The deliberate phone-face-up gesture establishes Correct; the opposite learned direction is Pass. | Critical | Confirmed in unit tests; physical device unverified | `orientationInput.ts`; `orientationInput.test.ts`; `README.md` | Implemented and conflicting copy corrected. |
| E12 | demonstrated magnitude → bounded threshold → candidate/dwell | The threshold is half the learned magnitude, clamped above neutral hysteresis and at 30°, unless explicitly configured. | High | Confirmed in implementation/tests | `orientationInput.ts`; `orientationInput.test.ts` | Implemented; retain physical QA for device-specific usable amplitudes. |
| E13 | accepted outcome → `.charades-flash` CSS overlay | Correct uses green; Pass uses orange. Both include text. | Low | Confirmed | `ActiveRoundScreen.tsx:32-35,95`; `styles.css:387-389` | Visual improvement is independent of the tilt failure. |
| E14 | `devices.start()` → guided calibration/terminal fallback → countdown → `beginTurn` | The countdown waits for `armed`; off, denied, or failed motion proceeds explicitly with tap controls. | Critical | Confirmed in screen tests | `GetReadyScreen.tsx`; `GetReadyScreen.test.tsx`; `useCharadesDevices.ts` | Implemented. |

## 4. Isolation/disassembly

The remaining defect can be isolated at E4/E7/E10/E11/E12/E14. Domain scoring, card tokens, persistence, audio, haptics, summaries, and tap/keyboard controls need no semantic change.

Prerequisites:

- Preserve permission requests inside the Start gesture, best-effort landscape lock, and the completed rotation-state cleanup.
- Define guided states: neutral collection → prompt/collect tilt up → return neutral → armed, plus retry/failure.
- Keep learned sensor values ephemeral inside the device controller; do not add them to session persistence.

Ordered cuts and validation:

1. Extend the pure recognizer at E4/E11 with neutral beta/gamma medians, a deliberate phone-face-up sample window, minimum gesture magnitude, and return-to-neutral validation. Learn a unit vector from neutral to phone-face-up; projection in that direction is Correct and the opposite direction is Pass. Validate weak, noisy, reversed, and incomplete gestures. Rollback is recognizer-only.
2. At E12, derive the action threshold from the demonstrated projection magnitude with conservative lower/upper bounds; keep dwell, latch, and neutral re-arm. Validate both directions, held gestures, jitter, and asymmetric amplitudes. Rollback restores fixed thresholds.
3. Expand E7 controller status so UI can announce each calibration phase and retry. Outcomes must remain suppressed until `armed`. Rollback retains tap-only play.
4. Gate E14: finish guided calibration before starting the 3-2-1 gameplay countdown. Permission denial or failed/abandoned calibration explicitly selects tap controls instead of silently starting broken tilt. Rollback is Get Ready/controller wiring only.
5. On orientation change, discard both baseline and learned vector. During Get Ready restart guided calibration; during an active turn disable tilt until the next Get Ready rather than asking a forehead-held player to perform a calibration gesture. Validate cleanup and tap continuity. Rollback preserves the completed rotation cleanup.

Compatibility effect: the current tap path, store schema, timers, and summaries do not depend on tilt and should remain unchanged. No persisted sensor samples or external systems are involved.

## 5. Improvements

Implemented: neutral-only scalar calibration was replaced with guided two-axis phone-face-up = Correct calibration, and active play is gated on its result. This addresses direction, magnitude, and the missing-screen-angle branch together; forcing landscape alone would not.

Optional, evidence-backed enhancements:

- Add a temporary local-only calibration diagnostic that displays phase and gesture strength for physical QA; do not persist or transmit samples.
- Give calibration a retry and a visible “Use taps instead” action.
- Capture physical traces on landscape-left/right and browsers with/without `screen.orientation` before fixing threshold bounds.
- Keep outcome text and haptics; feedback-color changes remain independent.

## 6. Uncertainty and coverage boundary

- No sensor trace from the reported phone is available; wrong axis, inverted sign, and unreachable threshold remain competing explanations for that device.
- A single demonstrated tilt-up vector is expected to remove screen-angle dependence at a fixed orientation, but usable magnitude bounds and whether one gesture generalizes symmetrically to tilt down require physical validation.
- The inspected E2E suite covers mobile Chromium tap journeys, not real or simulated `deviceorientation`, orientation-lock rejection, or manual rotation.
- No additional dependency was found within the inspected scope after focused searches for tilt, orientation, permission, motion, and mobile references.

Current automated verification: `npm run test:run` — 23 files / 198 tests passed; `npm run lint`, `npm run build`, and `git diff --check` passed. Physical-phone validation remains outstanding.
