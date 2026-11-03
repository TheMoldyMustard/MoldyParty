# Abort an Impostor Game

## Intent

Let players safely abandon an in-progress Impostor round without recording it as a win, loss, role appearance, vote, guess, or completed round.

## Scope and behavior

- Every in-progress game screen exposes an `Abort game` action.
- Selecting it opens a confirmation dialog because it discards the unfinished round.
- Confirming clears the active session's `currentGame` and the active UI game state, then returns to the local session manager.
- The session remains saved, including its roster, setup, and all statistics from previously completed rounds.
- Cancelling the dialog leaves the game and its in-progress state unchanged.
- Aborting is unavailable or unnecessary on the completed-result screen; a completed round has already been counted.

## Approaches considered

1. Add the action only to setup. Rejected because players can abandon during role reveal, discussion, voting, or Outlier guessing.
2. Add a separate transient abort flag. Rejected because the existing session model already represents unfinished work with `currentGame`; clearing that record is simpler and preserves the exactly-once accounting boundary.
3. Add a shared abort callback/action to all in-progress screens and clear the session-owned current game. Selected because it gives consistent access, one persistence rule, and no statistics mutation.

## Implementation contract

- Store action: `abortGame()` clears `game`, active-session `currentGame`, pending vote/guess state, and timer state, while retaining `sessionsById`, `activeSessionId` only long enough for the navigation callback, and all stats.
- UI: a shared confirmation component or equivalent dialog is rendered by each in-progress flow through the app shell; confirmation navigates to the session manager.
- Persistence: the next hydration restores the session with `currentGame: null`; `completedRounds` and `statsByPlayerId` are byte-for-byte unchanged.
- Tests cover cancel, confirm, persistence, no stat changes, and abort from representative active phases.

## Acceptance criteria

- A confirmed abort from an active round returns to `Impostor sessions`.
- Continuing that session opens setup for a fresh round rather than resuming the aborted round.
- Existing cumulative and per-role statistics do not change.
- Cancel leaves the current phase and round intact.
- Desktop/mobile E2E coverage verifies the user-visible flow.
