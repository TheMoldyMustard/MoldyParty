# Impostor session player statistics — feature impact plan

## 1. Decision summary and feature brief

### Recommendation

Add a first-class, local-only session registry. Each `SessionRecord` owns a name, stable roster, cumulative per-player statistics, setup defaults, timestamps, and optionally its recoverable in-progress round. Keep round facts in `GameState`; finalize one immutable round-stat contribution when the round reaches `GAME_OVER`, then carry the selected session through `playAgain()`.

Change the Impostor home-card action from directly opening setup to opening an Impostor session manager with four actions: `Create new session`, `Continue a session`, `View session stats`, and `Delete session`. Persist the registry locally so multiple named sessions can coexist. Render the selected session’s cumulative table both from the manager and on the completed-round result screen.

Do not derive session totals from the current round or from UI text. Add one pure domain function that converts a completed `GameState` into per-player deltas, and one store-owned commit path that applies that delta exactly once. This preserves the current separation between domain rules, Zustand lifecycle, and React presentation.

### Feature brief

For each player in an Impostor session, track:

| Requested metric | Planned definition |
|---|---|
| Correct impostor guess (vote) | Count each distinct Impostor selected by that player in a private ballot. A skipped ballot contributes zero. |
| Correct word guess as Outlier | Count a completed Outlier word guess that matches the round word; only the Outlier role can receive this metric. |
| Voted out as Jester | Count a completed round where that player had role `JESTER` and appears in `voteResult.eliminatedPlayerIds`. |
| Times played as each role | Increment the completed-round role counter for the player's assigned role. |
| Wrong guess for Innocents | Count each distinct non-Impostor target selected by an Innocent in a private ballot. A skip contributes zero. |
| Times voting a Jester | Count a private ballot that selects the Jester, regardless of whether the Jester is ultimately eliminated. |
| Wins/losses | Count total and role-keyed outcomes using the rules in section 6. |

Group Vote has no voter identity. By default it contributes to round/team outcomes but not to per-player correct/wrong-vote or “voted Jester” counters; otherwise every player would receive invented credit. This is an explicit product assumption and should be shown in the stats help text if the UI makes the omission visible.

## 2. Scope, non-goals, permissions, and assumptions

### In scope

- Stable session rosters and cumulative stats for multiple saved local sessions.
- Completed-round accounting across `Play again`, including rounds using private voting or Group Vote.
- Per-role play counts and total/per-role wins and losses.
- A cumulative session-statistics view on `GameOverScreen`.
- A session manager opened by clicking Impostor, with create, continue, stats, and delete actions.
- Persistence and migration of the local session registry through the existing local storage boundary.
- Pure domain tests, store/persistence tests, component/flow tests, E2E coverage, and README documentation.

### Non-goals

- Accounts, cloud sync, leaderboards, analytics, telemetry, or cross-device identity.
- Export/import, sharing, or cross-device session identity.
- Changing role assignment, elimination, tie, skip, Outlier-guess validation, or Group Vote mechanics.
- Reconstructing stats from arbitrary old rounds or importing stats from another device.

### Permissions and privacy

Stats are local gameplay data in the same browser profile as the current game. They are not secret once the round result is public, but pending role reveals, pending votes, and pending Outlier guesses must remain transient and masked exactly as they are now. No new network or auth boundary exists.

### Assumptions / builder calls

1. “A game is a session” means `Create new session` creates a named local record; its first round starts from the lobby; `Play again` appends another round; returning to the session manager ends only the active round, not the saved session.
2. Only completed rounds count. A reload or abandoned in-progress round does not increment role-play or outcome totals.
3. Player identity is stable for the lifetime of the session, even though the current round factory derives IDs from array position. The session roster must therefore be created once and reused by `playAgain`.
4. A team round win is determined by whether at least one Impostor is eliminated: Innocents win when one or more Impostors are eliminated; Impostors win when none are eliminated, including an all-skip result. Jester and Outlier outcomes remain independent and can win alongside either team.
5. When a private ballot selects multiple targets, each selected target is one guess for the accuracy counters. There is at most one Jester, so a private ballot can add at most one “voted a Jester” event.
6. If product wants Group Vote to credit each participant, it must be a separate decision because it changes the stats contract and fairness semantics. This plan recommends no per-player attribution.
7. A session needs a user-visible name to make Continue, View stats, and Delete unambiguous. Recommend a required trimmed name with a safe default such as `Session 1` when the user leaves it blank, subject to product copy review.
8. Delete is a destructive local action: require an explicit confirmation naming the session, then remove the session record and any saved in-progress round for it.

## 3. Current-state evidence ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | `src/domain/types.ts:54-77` defines `GameState` with current round number, players, roles, ballots, `VoteResult`, and Outlier guesses, but no session or statistics model. | Add a separate session contract rather than placing cumulative values in transient round fields. |
| Confirmed | `src/domain/game.ts:51-117` creates one round, assigns stable-looking positional IDs (`player-1`, etc.), and initializes empty votes/guesses. | Session identity must not rely solely on a newly-created round object; carry a roster/session ID across replay. |
| Confirmed | `src/domain/game.ts:140-159` calculates `counts`, top candidates, and `eliminatedPlayerIds`; `src/domain/game.ts:175-226` records private or Group Vote ballots. | Round-stat derivation can use final player roles plus the normalized vote records and elimination set. |
| Confirmed | `src/domain/game.ts:230-253` resolves Jester and Outlier outcomes only; there is no generic Innocent/Impostor winner model. | Add an explicit team-outcome resolver instead of inferring wins in React. |
| Confirmed | `src/store/gameStore.ts:111-151` owns `startGame`, `playAgain`, `returnToLobby`, and `changeCategory`; `playAgain` increments `round` and rebuilds the round from saved setup. | Session creation, continuation, termination, and exactly-once stats commit belong in this store boundary. |
| Confirmed | `src/store/gameStore.ts:298-387` persists setup/game at Zustand version `3`, masks role visibility, clears transient vote/guess UI state, and migrates older shapes. | Add a versioned session migration; never persist pending UI selections or raw unconfirmed guesses. |
| Confirmed | `src/features/game/GameOverScreen.tsx:10-71` renders the final result, special outcomes, role roster, and replay/navigation actions. | It is the natural consumer for cumulative session stats and current-round deltas. |
| Confirmed | `src/App.tsx:20-32,44-53` routes `GAME_OVER` directly to `GameOverScreen` and the home Impostor card directly to `setView('lobby')`; no session manager or stats view exists. | Add a session-manager view between the home card and lobby, plus a stats detail view. |
| Confirmed | `src/store/gameStore.ts:111-151,340-387` models one `game`/`setup` pair and one persisted Zustand record; `returnToLobby` clears the game. | Multiple sessions require a registry and an active-session identity; exiting to the manager must preserve the selected session record. |
| Confirmed | `README.md:1-22,69-77` describes the app as offline-first and documents the current finite-state lifecycle and local persistence. | Documentation should explain that session stats are local and reset when the session ends. |
| Confirmed | `npm run test:run` completed with 9 files and 95 tests passing; `npm run lint` completed successfully on 2026-11-03. | Existing baseline is green before implementation. |
| Inferred | `GameState.round` is a display/sequence number, not a globally unique round identity. | Add a session-scoped round identity or a persisted `statsRecorded` guard to prevent duplicate accounting after reload. |
| Unverified | No product requirement states whether a session should survive browser storage clearing, or whether player names may be edited after creation. | Preserve the recommended local-record lifecycle and lock roster editing to an explicit session-edit decision before release. |

## 4. End-to-end impact and consumer map

### Session lifecycle

Home Impostor card → session manager → `Create new session` / `Continue a session` / `View session stats` / `Delete session` → `LobbyScreen.submit()` → active `SessionRecord` + `GameState` → role reveal → discussion → voting → optional Outlier guess → `GAME_OVER` → finalize round delta → `GameOverScreen` displays cumulative stats → `playAgain()` reuses the selected session roster and increments its round.

`returnToLobby()` and `changeCategory()` now return to the session manager without deleting the record. A browser reload during an active round must restore the selected session and round together. Starting a different session must either save the current in-progress round inside its record or require the current round to be completed/left before switching; the recommendation is to save it.

### Producer/consumer map

| Producer or contract | Consumers affected | Required change |
|---|---|---|
| `GameSetupInput` / lobby submit | `LobbyScreen`, setup fixtures, `startGame` | No new setup toggle; initialize a session from the submitted roster. |
| `GameState` final round facts | `recordVote`, `recordOutlierGuess`, `calculateSpecialRoleOutcomes`, stats resolver | Add only the minimal completion/identity guard needed for exactly-once accounting. |
| `VoteRecord[]` and `VoteResult` | domain resolver, GameOverScreen, persistence validation | Preserve private voter identity and distinguish Group Vote from private ballots. |
| `GameStoreState` | all screens through `useGameStore`, persistence `partialize/merge/migrate`, replay/navigation | Add `session` state and a single commit path for completed round deltas. |
| Home/session manager state | `src/App.tsx`, new session-manager/stats components, store actions | Replace the direct home-to-lobby transition with local session selection and destructive-action confirmation. |
| `GameOverScreen` | result UI, component tests, E2E selectors, styles | Render per-player cumulative rows and current-round contribution without exposing unfinished secrets. |
| README / release behavior | users of installed PWA | Document reset boundary and local-only persistence. |

### Unaffected boundaries

`packDb`, pack parsing, preferences, service-worker assets, role reveal gesture logic, and the existing vote/guess input components do not need contract changes unless the session table requires shared presentational styling. There is no API, server, auth, audit, or remote database boundary in the discovered source.

## 5. Conflicts, invariants, risks, and design options

### Invariants to preserve

- A round is counted once, only after it reaches `GAME_OVER`.
- A reload of a completed result must not double-count when the user later starts another round.
- Existing role privacy behavior remains unchanged; session stats must not persist transient selections or guesses.
- Private voting retains voter identity, self-vote protection, skip semantics, multi-target semantics, and tie/elimination behavior.
- Group Vote remains a collective elimination input and does not acquire invented individual voter identities.
- A Jester win is based on being in the eliminated ID set, including multi-elimination results; an Outlier win remains based on the recorded word guess.
- The session roster and stats keys remain stable across `playAgain`, including when role assignment changes in the next round.

### Conflicts and risks

1. **Attribution conflict:** Group Vote has no individual voter. Crediting all players would inflate accuracy and Jester-vote metrics; crediting one arbitrary player would be misleading.
2. **Exactly-once risk:** The result screen can be restored from persistence. Updating stats from render or from every `GAME_OVER` observation would duplicate totals.
3. **Winner-rule gap:** Existing domain code has special-role outcomes but no team winner definition. The team rule must be explicit and tested before UI work.
4. **Identity drift:** Current round IDs are positional. Reordering or renaming players outside `playAgain` could associate stats with the wrong person if session identity is not separated from round players.
5. **Migration ambiguity:** Old persisted state has no historical session data. Retroactive reconstruction is not reliable, especially for old Group Vote and special-role rounds.
6. **Screen density:** A complete per-player table with role totals, vote accuracy, wins, and losses can overflow the small-screen result view; the existing result screen already scrolls vertically, but the table needs a deliberate compact/mobile layout.
7. **Registry lifecycle:** Returning to the lobby must no longer mean deleting the session, while deleting a session must remove its active round and aggregates without affecting other sessions.

### Feasible designs

#### Option A — First-class local session registry with pure round-delta finalization (recommended)

Store a locally persisted `sessionsById` registry and `activeSessionId`; each record owns `name`, roster, setup, aggregate stats, timestamps, and an optional recoverable `currentGame`. Keep the existing `game` selector as the active-session projection for screen compatibility. Finalize through the store exactly when a transition enters `GAME_OVER`. Keep a pure `calculateRoundStats(game)` function and persist a completion guard.

- Pros: clear ownership, deterministic tests, multiple local sessions, resumable rounds, no replay parsing, and direct support for the requested manager actions.
- Cons: requires persistence migration, registry UI, stable identity handling, and careful synchronization between the active projection and its record.

#### Option B — Separate IndexedDB session repository

Create a Dexie session table alongside the existing pack table and keep the active game in Zustand.

- Pros: better capacity and explicit delete/list operations.
- Cons: introduces an asynchronous repository boundary into session selection and active-game recovery for data that is small enough for the existing local-storage model.

#### Option C — Derive all stats by storing completed round history

Persist every completed `GameState` and reduce history for display.

- Pros: auditability and future historical charts.
- Cons: stores secret words and full ballots indefinitely, increases privacy/storage risk, makes migration and UI expensive, and duplicates data already summarized by the requested counters.

#### Option D — Keep stats only in the result component/local React state

Increment counters when `GameOverScreen` mounts or when replay is clicked.

- Pros: small initial code change.
- Cons: loses data on reload/navigation, risks duplicate counting, violates the existing Zustand persistence boundary, and cannot support a dependable session concept.

## 6. Recommended architecture, data flow, security, and error behavior

### Data model

Add typed contracts in `src/domain/types.ts` similar to:

```ts
type PlayerStats = {
  roundsPlayed: number
  rolesPlayed: Record<PlayerRole, number>
  correctImpostorGuesses: number
  wrongImpostorGuesses: number
  votesForJester: number
  votedOutAsJester: number
  correctOutlierGuesses: number
  wins: { total: number; byRole: Record<PlayerRole, number> }
  losses: { total: number; byRole: Record<PlayerRole, number> }
}

type SessionState = {
  sessionId: string
  name: string
  createdAt: string
  updatedAt: string
  completedRounds: number
  players: Array<{ id: string; name: string }>
  setup: GameSetupInput
  statsByPlayerId: Record<string, PlayerStats>
  currentGame: GameState | null
}

type SessionRegistry = {
  sessionsById: Record<string, SessionState>
  activeSessionId: string | null
}
```

The exact nesting may be adjusted to match existing style, but role keys must be exhaustive and zero-initialized. Keep `game` and `setup` as active-session projections for existing screen compatibility, while synchronizing them with the selected `SessionState.currentGame` and `setup`. Add a session-scoped `roundId` or equivalent `statsRecorded` marker to `GameState`; do not use the display-only round number as a global deduplication key.

### Domain calculation

Add pure functions in `src/domain/game.ts` (or a focused `src/domain/sessionStats.ts` if the module becomes too large):

1. Normalize private ballot targets from `targetId`/`targetIds` while identifying Group Vote separately.
2. Calculate team outcome from `voteResult.eliminatedPlayerIds` and player roles.
3. Calculate Jester and Outlier outcomes using the existing `calculateSpecialRoleOutcomes` rules.
4. Produce a per-player delta for role count, private-vote correctness, Jester-vote selection, Jester elimination, Outlier word correctness, and win/loss totals.
5. Reject or return a safe error for incomplete state: no final vote result, missing player IDs, or an Outlier-enabled round with an unrecorded required guess. The store must not partially commit a delta.

### Store data flow

- `startGame`: create a new session if none is active; create the round using the session roster IDs; reset session stats only when beginning a new session.
- `createNewSession`: accept a trimmed session name, create a zeroed `SessionState`, make it active, then open the existing lobby for player/setup entry. Do not write a session record until the first valid round is started, or write a draft record that is safely removable if the user cancels.
- `continueSession`: select a saved record; restore its `currentGame` if an unfinished round exists, otherwise open the lobby with that session’s setup and start the next round without clearing its stats.
- `viewSessionStats`: select a saved record for a read-only stats table without starting a round.
- `deleteSession`: require confirmation, remove the selected record and any saved in-progress round, and choose a deterministic next view/selection. If deleting the active record, clear active projections but never delete another session.
- `startGame`: create the first session round using the selected session roster IDs; reset session stats only when beginning a genuinely new session.
- `playAgain`: require a completed current round, retain the session and stats, increment `roundNumber`, create a new round from the same names/settings, and reset only round/transient state.
- final private/Group Vote transition: when `recordVote` produces `GAME_OVER` and no Outlier guess phase remains, compute and commit the round delta atomically, then mark the round accounted.
- final Outlier guess transition: compute and commit after `recordOutlierGuess` produces `GAME_OVER`.
- `returnToLobby` / `changeCategory`: clear only the active round projection and return to the session manager; retain the selected session record and its aggregates. Deletion is the only action that removes a session.
- hydration: restore the registry, selected session, round, and completion guard together; clear pending selections/readiness as today.

### Session manager UX

Add a dedicated manager view opened by clicking the home-page Impostor card:

- `Create new session`: open a name prompt, then the existing setup lobby. The session name and player roster become the persistent record when the first round starts.
- `Continue a session`: list saved session names and metadata; resume an unfinished round, or open that session’s setup for the next round. The selected session’s stats remain intact.
- `View session stats`: open a read-only reusable stats table showing cumulative totals, role counts, wins/losses, and the completed-round count.
- `Delete session`: show a confirmation dialog with the exact session name; after confirmation, delete only that local record and its saved in-progress round.

If no sessions exist, show the create action as the primary empty state. If a session is selected, make its name, player count, completed rounds, and last-played time visible without revealing current-round secrets. Use a reusable `SessionStatsTable` component in both the manager detail view and `GameOverScreen`.

### Result UI

Extend `GameOverScreen` with a “Session stats” section below the round result. Show one row per session player with at minimum:

- wins/losses total;
- current role and role-play counts for Innocent, Impostor, Jester, and Outlier;
- correct/wrong Impostor guesses, Jester votes, voted-out-as-Jester, and correct Outlier guesses.

Use compact labels/tooltips so the complete table remains understandable on mobile. Include the current round delta or a “this round” marker so players can see why totals changed. Do not display stats until the round is complete.

### Security, privacy, and errors

- Persist aggregate stats, session roster names/IDs, setup defaults, timestamps, and the existing recoverable `currentGame` only for an unfinished round. Do not persist raw historical secret words/ballots or unconfirmed inputs solely for stats.
- Keep existing `isRoleVisible`, `pendingVote`, and `pendingOutlierGuess` masking/partialization behavior.
- If a malformed persisted session is detected, discard only the session and current game as needed while retaining normalized editable setup, following the existing fail-closed migration pattern.
- If a stats calculation fails because a completed round is inconsistent, keep the game result visible but do not increment totals; expose a non-secret status message and record a development/test-visible error path.

## 7. Contract, schema, migration, and compatibility changes

### TypeScript contracts

- Add `PlayerStats`, `SessionPlayer`, `SessionState`, `SessionRegistry`, `RoundStatsDelta`, and a typed role-keyed counter shape to `src/domain/types.ts`.
- Add `sessionsById` and `activeSessionId` to `GameStoreState`, preserving `game`/`setup` as active projections, plus the round identity/accounting marker on `GameState`.
- Keep `GameSetupInput` unchanged; stats are session metadata, not a setup rule.
- Keep `VoteRecord` backward-compatible with `targetId` and `targetIds`; Group Vote must remain distinguishable from a private ballot in the calculation path.

### Zustand persistence migration

Bump `src/store/gameStore.ts` persistence from version `3` to `4` and add an explicit migration:

- Missing `sessionsById`/`activeSessionId` defaults to an empty registry. A legacy active `setup`/`game` is wrapped in one named migration session only when its roster and current round pass existing validation; otherwise retain normalized setup and require Create new session.
- Existing active rounds remain recoverable where their current schema is valid; no old round is retroactively counted because historical attribution is unavailable.
- Existing persisted `GAME_OVER` data is not counted automatically; the feature begins accumulating on newly completed rounds.
- Validate session IDs, unique session names within the registry if that UX constraint is chosen, unique roster IDs, player-name strings, setup shape, non-negative integer counters, exhaustive role-counter keys, current-game/session consistency, and the accounting marker.
- Preserve setup normalization, role masking, and transient-input clearing already implemented in `merge`.

### Compatibility matrix

| State | Expected behavior |
|---|---|
| Fresh install | Session manager shows an empty state; Create new session starts a zeroed record. |
| Existing v3 in-progress round | Wrap the recoverable setup/game in one migrated local session with zero stats; if it later completes, that completion is the first counted round. |
| Existing v3 completed round | Preserve the result without retroactive stats; Continue starts a new zeroed session record because the old round has no safe accounting marker. |
| v4 active round reload | Restore registry, selected session, aggregate stats, and unfinished round without exposing pending inputs. |
| Delete session | Remove only the named record and its unfinished round; other sessions and packs remain intact. |
| Malformed session | Drop only the malformed record/game when possible; retain other sessions and normalized setup. |

## 8. Ordered implementation phases with exact owners

### Phase 1 — Lock the stats contract and round rules

**Owners:** `src/domain/types.ts`, new `src/domain/sessionStats.ts` or `src/domain/game.ts`, `src/domain/game.test.ts`

1. Add the typed aggregate/delta contracts and zero-value helpers.
2. Implement private-ballot normalization, Group Vote exclusion, role counts, team win/loss rules, Jester/Outlier outcomes, and multi-target counting.
3. Add table-driven tests for: correct/wrong private targets, skips, multiple targets, Jester voted/not voted, Outlier correct/incorrect, all-skip Impostor win, Impostor elimination Innocent win, ties/multi-elimination, and simultaneous special-role/team outcomes.

### Phase 2 — Local registry, session lifecycle, and exactly-once store commit

**Owners:** `src/store/gameStore.ts`, `src/store/gameStore.test.ts`, `src/domain/types.ts`, `src/App.tsx`

1. Add the local `sessionsById` registry, active-session selection, session naming, stable roster identity, replay continuation, and session-manager actions.
2. Preserve unfinished `currentGame` per session when leaving to the manager, and restore it from Continue.
3. Add the atomic final-transition commit path and completion marker.
4. Add version-4 `merge`/`migrate` validation and migration tests for fresh, v3 active, v3 completed, malformed, deleted, and reloaded v4 states.
5. Verify a result reload followed by `Play again` increments exactly once and switching sessions does not mix stats.

### Phase 3 — Impostor session manager and reusable stats table

**Owners:** `src/App.tsx`, new `src/features/game/SessionManagerScreen.tsx`, new `src/features/game/SessionStatsTable.tsx`, `src/features/game/GameOverScreen.tsx`, `src/styles.css`

1. Change the home Impostor card to open the session manager instead of directly opening setup.
2. Implement Create, Continue, View stats, and Delete actions with empty, populated, and confirmation states.
3. Add an accessible reusable stats table with stable labels and compact mobile layout.
4. Render the same table on `GameOverScreen`, showing cumulative values and current-round contribution without exposing new secret data.
5. Add a clear note for Group Vote attribution if the product wants the omission surfaced.

### Phase 4 — Component and end-to-end coverage

**Owners:** `src/features/game/GameFlow.test.tsx`, new `src/features/game/SessionManagerScreen.test.tsx`, `src/App.test.tsx`, `e2e/game-flow.spec.ts`

1. Click Impostor and assert the four session actions are available.
2. Create a named session, complete two private rounds, and assert cumulative role/win/loss/accuracy counters.
3. Continue a saved session and verify its stats/player roster are reused; switch to a second session and verify isolation.
4. View a session stats table without starting a round.
5. Delete a session, confirm the record disappears, and verify another session remains.
6. Cover Jester and Outlier rounds, including a Jester vote and correct/incorrect Outlier guess.
7. Cover Group Vote and assert team outcome changes while individual vote counters stay unchanged.
8. Reload at `GAME_OVER` and assert no duplicate totals after replay; reload an unfinished round and assert Continue resumes it.
9. Assert leaving to the manager preserves the session and only deleting removes it.

### Phase 5 — Documentation and release verification

**Owners:** `README.md`, this plan’s acceptance checklist, release/test owner

1. Document session manager actions, local persistence, deletion behavior, session lifetime, completed-round semantics, and Group Vote attribution.
2. Run the full verification matrix below.
3. Verify an installed production PWA upgrade from v3 state and a clean install on desktop/mobile Chromium.

## 9. Verification matrix and acceptance criteria

| Area | Verification | Acceptance criterion |
|---|---|---|
| Domain | `npm run test:run`; focused session-stat tests | Every requested metric has deterministic, role-aware deltas; no Group Vote voter is invented. |
| Store | persistence/migration tests | Multiple sessions survive reload; completed round is committed once; transient secret inputs remain absent; deleting one record does not affect another. |
| UI | component tests | Impostor opens the manager; all four actions are accessible; stats tables render all players and cumulative stats with zero values visible and unambiguous. |
| E2E private | create + two-round private journey | First round’s totals carry into Round 2 and role counts/wins/losses match known seeded roles. |
| E2E session lifecycle | manager journey | Continue resumes the correct session, View stats is read-only, and Delete requires confirmation and removes only the chosen record. |
| E2E special roles | Jester/Outlier journey | Jester-voted-out and Outlier word-guess counters update independently of team outcome. |
| E2E Group Vote | collective ballot journey | Team win/loss updates; per-player vote accuracy/Jester-vote counters remain unchanged under the recommended policy. |
| Responsive | desktop/mobile Playwright projects and visual inspection | Stats remain readable and scrollable on the existing result screen. |
| Quality | `npm run lint`, `npm run build`, `npm run e2e` | All commands pass on a clean checkout after implementation. |

### User-visible acceptance criteria

- Clicking Impostor opens a session manager with Create new session, Continue a session, View session stats, and Delete session.
- Creating a new named session creates a zeroed session roster once.
- Clicking `Play again` keeps the same players’ cumulative stats and adds the new completed round.
- Continuing a saved session restores its stats and either resumes its unfinished round or starts its next round.
- Viewing session stats does not start or mutate a round.
- Deleting a session requires confirmation and removes only that session’s local record and unfinished round.
- Each player can see role-play totals, total/per-role wins and losses, vote accuracy, wrong Innocent guesses, Jester votes, Jester eliminations, and correct Outlier guesses.
- A skipped private vote does not count as correct or wrong.
- A Group Vote never credits a specific player with a vote they did not individually cast.
- Reloading the result screen does not duplicate totals.
- Returning to the session manager or changing category preserves the session; creating a new session begins at zero.

## 10. Rollout, rollback, observability, cleanup, and unverified boundaries

### Rollout

Ship as a client-only additive release with Zustand version-4 migration. No backend coordination, account migration, or network capability is required. Test clean storage, multiple local sessions, deletion, and an installed v3 PWA with an active or completed saved round.

### Rollback

Before release, verify how the v3 client handles v4 persisted state. If the older client discards newer state, document that an in-progress session may reset on rollback; never claim historical stats are recoverable. Because stats are aggregates, rollback should not affect packs or the current round’s secret privacy, but it may lose newly accumulated session totals.

### Observability

There is no remote telemetry boundary. Use development-only assertions/tests for invalid delta inputs, duplicate completion, negative counters, and malformed migration. User-visible errors must be generic and must not include secret words or guesses.

### Cleanup

After implementation, remove obsolete compatibility branches only if v3 migration coverage proves they are no longer needed. Do not add completed-round history or raw ballot storage merely to support the aggregate table.

### Unverified boundaries and explicit follow-up decisions

- Whether players expect sessions to survive browser storage clearing, and whether session names must be unique, is not specified.
- Whether player names may be edited after a session is created is not specified; the recommended first release keeps the roster stable and requires a deliberate future edit/merge rule.
- Whether Group Vote should eventually support individual “I agree” acknowledgements is unresolved; that would require a new input contract and should not be inferred from the current collective ballot.
- Whether “wrong guess” means each wrong selected target (recommended) or one wrong ballot per round must be confirmed in product copy; tests should lock whichever wording is chosen.
- Whether a tie that eliminates both an Impostor and a Jester should grant both team and Jester wins is inferred as yes from independent outcome rules and needs product confirmation.

## Self-review record

- Plan-only scope: this artifact is the only intended workspace change.
- Consequential claims are tied to current source symbols, existing feature plans, README behavior, or recorded test/lint output.
- No API, auth, audit, or backend work was invented; those boundaries are explicitly marked absent/inferred.
- The main contract conflict—individual attribution under Group Vote—is stated, resolved by recommendation, and preserved as a follow-up decision.
- Migration, exactly-once accounting, role outcome rules, mobile presentation, rollback, and unverified boundaries are explicitly covered.
