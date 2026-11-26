# Forehead Charades Mobile Tilt Feature Analysis

## Executive verdict

The non-working forehead tilt path was caused by using raw `DeviceOrientationEvent` beta/gamma Euler angles as if one screen-relative axis remained continuous. That assumption breaks around landscape orientation boundaries and varies by browser/device posture. Setting the feature off by default only hid the defect; forcing landscape alone would not repair the sensor math.

The implementation now consumes `devicemotion` events and normalizes `accelerationIncludingGravity` into a physical three-dimensional gravity vector. Guided calibration learns the player's neutral vector and demonstrated **phone face up = Correct** direction in the tangent plane at neutral. Gameplay measures signed angular displacement along that axis: the demonstrated direction is Correct and its opposite is Pass, including after a full 90° demonstration. The recognizer therefore does not choose between beta and gamma based on portrait or landscape.

Tilt is enabled by default for new sessions, remains selectable in setup, and preserves an explicit tap-only opt-out. Landscape remains scoped to Charades through a best-effort runtime orientation lock; the PWA manifest remains orientation-agnostic so other games are not forced into landscape. Tap controls remain available regardless of permission or sensor support.

## Feature anatomy

1. `CharadesSetupScreen` defaults `motionEnabled` to `true`, restores an existing session's value, and persists user opt-out.
2. `GetReadyScreen` calls `devices.start()` from the Start gesture with the stored motion preference.
3. The controller requests `DeviceMotionEvent` permission, unlocks audio, acquires wake lock, and independently attempts a landscape lock.
4. When permission is granted, the controller listens for `devicemotion` and forwards `accelerationIncludingGravity.x/y/z` plus the current screen angle to `tiltInput.ts`.
5. `tiltInput.ts` normalizes every valid gravity vector, collects a stable neutral median, learns the demonstrated Correct displacement, requires a return to neutral, then arms gameplay recognition.
6. Dwell, latch, and neutral re-arm suppress jitter and repeated outcomes. A screen-angle change restarts calibration before gameplay and fails motion closed during gameplay.
7. Recognized outcomes share the same token-guarded store command as taps. Permission denial, missing/invalid gravity data, calibration failure, and rejected orientation locking do not disable tap play; **Continue with taps** lets a player escape a silent or stalled sensor stream.

## Dependency and risk map

| Provider → consumer | Contract | Risk and disposition |
|---|---|---|
| `DeviceMotionEvent` → `requestSensorPermission` → controller | Permission is granted, denied, or unavailable. | High: iOS permission must remain inside the Start gesture; denied/unavailable explicitly falls back to taps. |
| `devicemotion.accelerationIncludingGravity` → `TiltRecognizer.update` | Three finite, non-zero coordinates become a normalized gravity vector. | Critical: missing, non-finite, or zero vectors are ignored and cannot calibrate or score. |
| guided calibration → learned Correct axis | Stable neutral, deliberate face-up gesture, and return to neutral are required before arming. | Critical: weak/noisy gestures do not arm; focused tests cover both semantic directions and instability. |
| `screen.orientation.angle` → recognizer lifecycle | Angle is a rotation boundary signal, not an axis selector. | High: rotation recalibrates before play and disables tilt during play rather than interpreting discontinuous data. |
| `screen.orientation.lock('landscape')` → Charades device status | Lock is progressive enhancement and may be rejected by browsers. | Medium: recognition remains gravity-based; a failed lock does not prevent guided calibration or tap play. |
| recognizer outcome → Charades store | Sensor and tap input share outcome guards and card tokens. | High: no scoring or persistence semantics changed. |
| stop/unmount/visibility → listener, wake lock, orientation, audio cleanup | Optional device resources are released or reacquired as appropriate. | Medium: controller tests cover motion-listener cleanup. |

## Isolation and blast radius

The fix is isolated to the Charades device-input seam:

- `tiltInput.ts` owns pure gravity-vector calibration and recognition.
- `sensorPermission.ts` owns the generic motion permission adapter.
- `useCharadesDevices.ts` owns browser event wiring and optional device services.
- `CharadesSetupScreen.tsx` and `GetReadyScreen.tsx` own preference/default behavior.

Domain scoring, card selection, timers, recaps, statistics, audio cues, haptics, and tap/keyboard controls retain their existing contracts. No raw sensor samples or learned vectors are persisted, logged, exported, or transmitted.

## Verification boundary

Automated coverage exercises Correct and Pass, the landscape Euler-boundary case, invalid and zero vectors, unstable calibration, weak demonstrations, rotation before and during gameplay, permission states, event wiring and cleanup, the default-on setup control, tap-only opt-out, and recovered-session preference forwarding.

Physical-device QA is still required before claiming device-wide reliability. Test at least iOS Safari/PWA and Android Chromium/PWA in landscape-left and landscape-right, including permission allow/deny, an orientation-lock rejection, Correct/Pass gestures, held tilt, neutral re-arm, manual rotation, and tap fallback. Browser automation cannot prove real sensor coordinate quality, sampling rate, OS filtering, or whether a particular forehead gesture produces a usable gravity displacement.
