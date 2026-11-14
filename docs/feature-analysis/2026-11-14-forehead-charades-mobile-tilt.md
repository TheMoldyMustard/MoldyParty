# Forehead Charades Mobile Tilt Feature Analysis

## 1. Executive verdict

Scope: the Forehead Charades tilt path from the Get Ready gesture through browser permission, `deviceorientation` events, calibration, outcome submission, and cleanup. The feature owner is the Charades device layer in `src/features/charades/useCharadesDevices.ts`, with recognition isolated in `orientationInput.ts`.

The likely mobile failure is a confirmed compatibility defect at the screen-orientation boundary. `browserDependencies()` stores `screen.orientation` as possibly absent, and `lockLandscape()` correctly treats it as optional, but `getAngle()` later reads `orientation.angle` without an existence check. On a mobile browser without `ScreenOrientation`, a delivered `deviceorientation` event throws before the recognizer receives it; tilt therefore cannot produce Correct/Pass. This is especially relevant to iOS/Safari-class environments, but no physical-device run was available, so browser/version incidence is unverified.

Coupling is moderate: the path crosses permission, sensor events, screen orientation, persisted game state, audio/haptics, wake lock, and lifecycle cleanup. It is removable as a progressive enhancement because tap controls are independent, but the orientation seam must be made capability-safe before treating mobile tilt as reliable. Recommended next step: isolate screen-angle access behind a safe capability adapter, then add a mobile-browser regression test that dispatches a sensor event with no `screen.orientation`.

## 2. Feature anatomy

1. `GetReadyScreen` calls `devices.start()` from the explicit Start Get Ready button, passing the persisted motion preference.
2. The controller requests orientation permission, unlocks audio, acquires wake lock, attempts landscape lock, and then starts calibration plus a `deviceorientation` listener when permission is granted.
3. `orientationInput.ts` collects one second of samples, requires at least eight samples with spread no greater than eight degrees, then compares screen-relative tilt against a baseline. A 25-degree delta held for 100 ms emits one semantic outcome and requires returning within eight degrees of neutral before re-arming.
4. `CharadesGame` routes a recognized outcome through the same token-guarded store submission used by taps. `ActiveRoundScreen` supplies the visible tap zones and feedback.
5. Stop/unmount removes the sensor and visibility listeners, releases wake lock and orientation lock, disposes audio, and resets device status.

## 3. Cascade map

| ID | Provider → interface → consumer | Effect | Risk | Confidence | Evidence | Disposition |
|---|---|---|---|---|---|---|
| E1 | `GetReadyScreen.start` → `CharadesDeviceController.start` → device orchestration | Starts all optional device services from the user gesture. | Medium | Confirmed | `src/features/charades/GetReadyScreen.tsx:30-37`; `useCharadesDevices.ts:94-128` | Preserve; keep permission request inside the gesture call stack. |
| E2 | `window.DeviceOrientationEvent` → `requestOrientationPermission` → controller | Permission is granted, denied, or unavailable; denied/unavailable leaves tap play available. | High | Confirmed | `orientationPermission.ts:7-17`; `useCharadesDevices.ts:98-125` | Preserve progressive fallback; test absent constructor and denied permission. |
| E3 | `screen.orientation` → `lockLandscape` and `getAngle` → sensor callback | Landscape lock is advisory, but angle normalization is required by every sample. | High | Confirmed for unsafe dereference; mobile incidence unverified | `useCharadesDevices.ts:165-179`; `orientationLock.ts:6-13`; `orientationInput.ts:67-75` | Required seam: safe angle provider returning a stable numeric fallback. |
| E4 | `deviceorientation` → `OrientationRecognizer.update` → `onOutcome` | Calibration, threshold, dwell, latch, and neutral reset convert motion into Correct/Pass. | High | Confirmed | `useCharadesDevices.ts:70-82`; `orientationInput.ts:62-115` | Preserve; add an integration test for missing angle capability. |
| E5 | `onOutcome` → `charadesStore.submitOutcome` → active card/recap state | Sensor and tap input share the card token and event-count guard, preventing duplicate scoring. | High | Confirmed | `CharadesGame.tsx:17-24`; `ActiveRoundScreen.tsx:25-36` | Preserve contract; no store change required for the compatibility fix. |
| E6 | visibility/phase/unmount → wake lock, listener, orientation, audio cleanup | Backgrounding and exit release optional resources. | Medium | Confirmed | `useCharadesDevices.ts:85-91,130-140`; `CharadesGame.tsx:27-35` | Preserve; add mobile lifecycle coverage if sensor testing is expanded. |
| E7 | `deviceStatus.motion` → UI status/fallback text | Users see “Tilt ready” only after recognizer arms; otherwise tap controls remain visible. | Low | Confirmed | `ActiveRoundScreen.tsx:76-80`; `GetReadyScreen.tsx:45-47` | Keep; report angle/API failure distinctly if practical. |
| E8 | mobile Playwright project → Charades E2E flows | Mobile layout and tap fallback are covered, but no sensor permission/event simulation exists. | Medium | Confirmed | `playwright.config.ts:13-15`; `e2e/charades-flow.spec.ts:31-53` | Add a focused simulated-sensor test after the seam is fixed. |

## 4. Isolation/disassembly

The feature can be isolated at E2/E3/E4 without touching domain rules or persistence.

Prerequisites:

- Introduce one browser capability adapter for `screen.orientation?.angle`, returning `0` when unavailable; never read the raw object in the event callback.
- Keep the angle adapter injectable beside `getAngle` so unit tests can model absent, changing, and invalid values.
- Define whether a missing angle means “assume zero” or “disable motion”; assuming zero preserves portrait-capable devices but should be validated on the target mobile browsers.

Ordered cuts and validation:

1. Cut the raw `screen.orientation` dereference behind the adapter (E3). Validate existing tests, build, and a sensor event with no screen-orientation object. Rollback is reverting only the adapter wiring.
2. Add a mobile-browser sensor integration test (E4/E8) covering permission granted, calibration, a tilt event, and Correct/Pass submission. Validate no uncaught exception and one event per tilt. Rollback is test-only removal if the harness cannot model the target API.
3. Exercise visibility/rotation/exit cleanup (E6) on a real mobile browser. Validate listener removal and that tap controls still work after denial or API absence. Rollback is operational only; no persisted data or schema change is involved.

Compatibility effect: the current tap path, store schema, timers, and summaries do not depend on tilt and should remain unchanged. No persisted sensor samples or external systems are involved.

## 5. Improvements

Required: make screen-angle access capability-safe and observable enough to distinguish “permission denied,” “sensor unavailable,” and “recognizer failed.”

Optional, evidence-backed enhancements:

- Add a `screen.orientation`-absent regression test because current tests inject `getAngle` and never exercise browser dependency construction.
- Add a mobile test that rotates or changes the reported angle during calibration; the recognizer intentionally fails closed on angle changes (`orientationInput.ts:69-73,88-91`).
- Add a manual real-device verification matrix for iOS Safari/PWA and Android Chrome, including portrait fallback and landscape lock denial.
- Consider a short calibration diagnostic in the UI when the eight-sample/one-second requirement is not met, instead of only showing generic tap controls.

## 6. Uncertainty and coverage boundary

- No physical mobile browser or sensor stream was available; browser/version-specific incidence is therefore unverified.
- The inspected E2E suite covers mobile Chromium tap journeys, not real or simulated `deviceorientation` delivery.
- No additional dependency was found within the inspected scope after focused searches for tilt, orientation, permission, motion, and mobile references.

Verification run: `npm run test:run -- --reporter=dot` — 22 files / 177 tests passed; `npm run lint` passed; `npm run build` passed.
