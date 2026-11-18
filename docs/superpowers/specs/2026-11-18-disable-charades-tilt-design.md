# Disable Charades Tilt Controls Design

## Intent

Temporarily prevent players from enabling the unreliable Forehead Charades tilt controls while clearly indicating that the feature is still in progress.

## Goals

- Keep the Tilt controls setting visible, unchecked, and disabled.
- Label it **Tilt controls — Work in progress** and direct players to use taps for now.
- Force every newly created Charades session to use `motionEnabled: false`.
- Preserve tap, keyboard, sound, haptics, and all other Charades behavior.

## Non-goals

- Do not remove the calibration or sensor implementation.
- Do not change the Charades settings schema or persisted-session compatibility.
- Do not change active gameplay controls beyond preventing new motion-enabled sessions.

## Approaches

1. **Visible disabled control plus a session-level guard — selected.** This communicates that tilt is work in progress and prevents stale UI state from enabling it.
2. Hide the setting. Rejected because it loses the requested work-in-progress signal.
3. Disable only the checkbox. Rejected because keeping mutable state in the session builder would leave an unnecessary second path for enabling motion.

## Design

`CharadesSetupScreen` renders a disabled, unchecked Tilt controls checkbox with the requested work-in-progress copy. Session construction supplies the literal `false` for `motionEnabled`. A setup integration test verifies both the user-visible disabled state and the session created after Start game.
