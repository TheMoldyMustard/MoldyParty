# Charades Gravity Tilt Design

## Intent

Restore reliable Forehead Charades tilt controls on real phones without relying on discontinuous `deviceorientation` Euler angles. Keep landscape presentation scoped to Charades and preserve taps as the universal fallback.

## Goals

- Use normalized `devicemotion.accelerationIncludingGravity` vectors for neutral, Correct, Pass, dwell, latch, and re-arm recognition.
- Preserve guided calibration: stable neutral, demonstrate phone-face-up Correct, return neutral, then count down.
- Make tilt enabled by default for new sessions and honor persisted `motionEnabled` for recovered sessions.
- Keep `screen.orientation.lock('landscape')` best-effort during Charades; do not force every MoldyParty screen into landscape.
- Preserve scoring, audio, haptics, timers, session persistence, and tap/keyboard controls.

## Non-goals

- No global PWA manifest orientation change.
- No telemetry or persisted raw sensor data.
- No scoring/store schema change.
- No threshold-only patch to the existing beta/gamma algorithm.

## Approaches

1. **Normalized gravity vectors — selected.** Gravity stays continuous across the Euler boundary and directly represents phone pose. Calibrate a neutral unit vector and a demonstrated Correct displacement; project live displacement onto that learned axis. This adds a Device Motion permission/listener adapter but keeps the recognizer pure.
2. **Quaternion conversion from alpha/beta/gamma.** Mathematically complete, but adds more conversion complexity and remains exposed to browser-specific orientation conventions.
3. **Wrap-aware beta/gamma subtraction.** Smallest diff, rejected because coupled Euler changes and the missing alpha value cannot be repaired reliably by per-axis wrapping.

## Design

`tiltInput.ts` owns a pure `TiltRecognizer` consuming `{ x, y, z, angle }`. Valid gravity triples are normalized. Neutral stability is measured as angular distance from a median unit vector. The demonstrated Correct pose produces a learned displacement axis; positive projection emits Correct and negative projection emits Pass. Existing 8°, 16°, and 30° behavioral bounds are converted to unit-vector chord distances, retaining the current timing, latch, and screen-angle fail-closed rules.

`useCharadesDevices.ts` requests `DeviceMotionEvent` permission from the Start Get Ready gesture, listens for `devicemotion`, and forwards `accelerationIncludingGravity`. Missing/malformed samples cannot arm or score. The controller contract and status union stay unchanged.

The setup screen restores an enabled Tilt checkbox defaulting to on. New sessions persist the selected value, and Get Ready passes the session value rather than a literal shutdown flag. Runtime landscape lock remains independent of motion permission and failure.

## Validation

- Pure fixtures cover neutral stability, Correct, Pass, boundary-equivalent poses, invalid/missing gravity, weak gestures, rotation, latch, and re-arm.
- Controller tests cover permission, listener lifecycle, real recognizer phases, and accepted outcomes.
- UI tests cover default-on setup, opt-out, recovered-session behavior, calibration gating, and tap fallback.
- Full tests, lint, build, and diff checks must pass. Physical-phone validation remains required because jsdom cannot provide real sensor hardware.
