# Category Bomb and Forehead Charades saved sessions and statistics — feature impact plan

## 1. Decision summary and feature brief

### Decision

Add named, reusable, local-only saved sessions to Category Bomb and Forehead Charades, matching the established Impostor lifecycle: create a named session, define a stable roster, continue or resume it, view cumulative statistics, rename it, and delete it with confirmation.

Keep a separate session registry inside each existing game store. Extract the reusable presentation and accessibility behavior from the Impostor session manager, but do not move the three games into a universal polymorphic store. Each game's domain owns its own round facts, exactly-once statistics calculation, persistence validation, and recovery.

For Charades, add a stable flat player roster for every mode. Classic, Henyo, and One-Word rotate the active holder through that roster. Team Relay assigns the same stable player IDs to two teams instead of treating comma-separated names as unrelated strings. A completed Charades turn is the unit that commits player performance statistics; a completed relay game additionally commits win/loss/tie results.

For Category Bomb, keep the existing roster and stable IDs for the life of the saved session. A bomb that reaches `EXPLODED` is the completed unit. Accepted-answer events are attributed to the player who held the turn before the pass; the exploded player and timer/foul cause are committed exactly once.

### Feature brief

The home cards for Category Bomb and Forehead Charades open game-specific saved-session managers rather than opening setup directly. Their manager behavior should feel like `SessionManagerScreen`: saved cards sorted by update time; create, continue, rename, stats, and delete actions; explicit destructive confirmation; and recovery of an unfinished game.

The initial statistics set should favor facts the app can observe reliably:

#### Category Bomb

| Level | Recommended statistic | Definition |
|---|---|---|
| Player | Bombs played | Completed bombs in the session while the player was on the locked roster. |
| Player | Successful answers | Accepted-answer taps attributed to that player before the turn passed. This is not objective answer accuracy. |
| Player | Explosions | Bombs ending on that player. |
| Player | Timer explosions | Explosions caused by the hidden fuse. |
| Player | Foul explosions | Explosions caused by the held foul control. |
| Player | Survival rate | `(bombs played - explosions) / bombs played`, derived for display and shown as unavailable before the first completed bomb. |
| Player | Best bomb | Most successful answers by that player within one bomb. |
| Session | Completed bombs | Number of exactly-once committed bombs. |
| Session | Answers per bomb | `total successful answers / completed bombs`, derived for display. |
| Session | Longest bomb | Highest total accepted-answer count in one completed bomb. |
| Session | Explosion split | Timer versus foul totals. |
| Session | Category history | Completed-bomb count and explosion count by stable `categoryId`; the UI may surface each player's most frequent explosion category as a “nemesis” only after enough data exists. |

Do not label accepted answers as “correct,” because the group self-moderates validity. Do not rank response time, awarded pass-bonus time, or hidden fuse duration as skill: the current interaction includes device-passing delay and randomized timing.

#### Forehead Charades

| Level | Recommended statistic | Definition |
|---|---|---|
| Player | Turns played | Completed turns held by that player. |
| Player | Correct | Card events recorded with outcome `correct`. |
| Player | Passes | Card events recorded with outcome `pass`. |
| Player | Accuracy | `correct / (correct + passes)`, derived for display. |
| Player | Correct per minute | Correct answers divided by actual completed active-turn time; unavailable when tracked active time is zero. |
| Player | Best turn | Highest correct score in one completed turn. |
| Player | Longest correct streak | Longest consecutive `correct` card-event run within a completed turn. |
| Player | Henyo fouls | Number of five-second foul events during that player's completed Henyo turns. |
| Player | Mode breakdown | Turns, correct, and passes keyed by Classic, Henyo, One-Word, and Team Relay. |
| Player | Category breakdown | Correct and attempted cards keyed by the existing seven Charades categories. |
| Relay | Results | Relay games won, lost, or tied for each participating player. |
| Relay | Contribution | Correct answers scored by the player during relay turns; do not invent credit for clue-givers because the app cannot identify them. |
| Session | Completed turns/games | Committed turns plus completed Team Relay games. |
| Session | Group totals | Correct, passes, fouls, accuracy, mode usage, and category performance derived from player or committed-game aggregates. |

The phone holder receives card-performance credit. Other clue-givers are intentionally unattributed because the app does not observe who spoke.

## 2. Scope, non-goals, permissions, and assumptions

### In scope

- Separate named session registries for Category Bomb and Charades, modeled after Impostor's local saved sessions.
- Stable player IDs and locked rosters after the first game begins.
- Charades roster entry and deterministic holder rotation in non-relay modes.
- Team Relay assignments that reference stable session player IDs.
- Exactly-once completed-bomb, completed-turn, and completed-relay-game accounting.
- Game-specific cumulative statistics views from the manager and appropriate completed-round screens.
- Continue/resume, return-to-sessions, rename, delete, and abort/discard-current-game behavior.
- Versioned migration of the current Charades and Category Bomb persisted states without affecting Impostor, packs, preferences, or no-repeat history.
- Domain, store, component, app-routing, migration, E2E, offline, accessibility, and documentation coverage.

### Non-goals

- A cross-game “Friday Crew” record or combined all-games leaderboard.
- Accounts, cloud sync, remote analytics, telemetry, sharing, export/import, or cross-device identity.
- Changing Category Bomb validity rules, fuse sampling, fair-cycle/chaos selection, or hidden-timer behavior.
- Crediting Category Bomb answer quality beyond an accepted pass.
- Identifying or scoring Charades clue-givers, speech, or individual Henyo helper-button users.
- Reconstructing historical statistics that were never recorded by released store versions.
- Editable membership after a session begins. Roster editing can be a later feature with explicit identity and stat-retention rules.

### Permissions and privacy

All names, current-game state, and statistics remain in browser-local storage. No new network, authentication, or authorization boundary is introduced. Session deletion permanently removes that game's saved record after a confirmation naming the session. Clearing site data retains its existing destructive effect.

### Assumptions and builder calls

1. The user's “like Impostor” choice means each game gets its own named saved-session manager and stable group history, not one cross-game session.
2. Session names may repeat; session IDs are the identity. Blank names use the same safe fallback convention as Impostor.
3. The roster becomes immutable when the first valid game starts, matching Impostor's locked-session roster. Setup controls may change game rules, packs, filters, and teams without changing player IDs.
4. Non-relay Charades rotates holders in roster order and resumes that rotation across completed turns and app restarts. Aborted turns do not advance the rotation.
5. Team Relay requires every session player to be assigned to exactly one of two non-empty teams for that game. Team membership may change before the next relay game without rewriting historical player stats.
6. Only terminal facts count: Category Bomb at `EXPLODED`; Charades at `ROUND_SUMMARY`; relay result at `SESSION_SUMMARY`. In-progress or aborted units never add statistics.
7. Returning from a completed result preserves committed statistics and clears only the current terminal game snapshot when the user chooses to start fresh.
8. Existing no-repeat history remains pack-scoped, not session-scoped, unless a later product decision changes it.

## 3. Current-state evidence ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | `src/domain/types.ts:128-138` defines Impostor `SessionRecord` with stable players, cumulative stats, setup, timestamps, and `currentGame`. | Reuse the lifecycle and vocabulary while keeping game-specific record types. |
| Confirmed | `src/store/gameStore.ts:335-359` calculates a completed-round delta and marks `statsRecorded`; `src/store/gameStore.ts:416-459` owns create/continue/rename/delete. | Category Bomb and Charades need equivalent pure delta functions and store-owned exactly-once commit paths. |
| Confirmed | `src/features/game/SessionManagerScreen.tsx:143-200` implements local stats, sorted session cards, rename/delete dialogs, focus restoration, and confirmation copy, but imports `useGameStore` directly and hardcodes Impostor. | Extract reusable presentation primitives or a callback-driven manager shell; keep per-game adapters and stats views. |
| Confirmed | `src/App.tsx:23,84-103,123-147` has only an Impostor sessions route; Charades and Category Bomb open setup directly. | Add distinct session-manager/setup/stats routing for both games and preserve the existing home cards. |
| Confirmed | `src/domain/charades.ts:58-71` calls one active play run `CharadesSession`; it has cards, turn summaries, and relay counters but no saved-session identity or cumulative stats. | Rename or clearly separate the active-game type from a new persisted `CharadesSessionRecord` to avoid semantic collisions. |
| Confirmed | `src/domain/charades.ts:169-176` returns `Next player` outside Team Relay; `CharadesSetupScreen.tsx:84-91` accepts named members only for relay. | All modes need a stable roster and a player-ID-based current-holder contract before individual stats are credible. |
| Confirmed | `src/domain/charades.ts:199-218` finalizes a turn with holder name, score, and ordered events; `:286-292` derives team scores. | Existing facts support correct/pass/foul/streak/category metrics, but summaries must carry stable holder IDs and tracked active duration. |
| Confirmed | `src/features/charades/CharadesGame.tsx:31-35` resets the entire active Charades state on exit. | Replace silent deletion with saved-session navigation and explicit abort semantics for unfinished turns. |
| Confirmed | `src/store/charadesStore.ts:51-105` persists exactly one `session` at version 1 and performs shallow recovery validation. | Upgrade to a registry plus active-session pointer and strengthen nested validation/migration. |
| Confirmed | `src/domain/categoryBomb.ts:27-41` stores one round, current player, category, action token, exploded player, and reason, but no accepted-answer history. | Add bounded round facts that attribute accepted answers before the current-player pointer changes. |
| Confirmed | `src/domain/categoryBomb.ts:237-255` accepts an answer and switches the current player; `:225-267` resolves timer and foul explosions. | Capture the answering player in an ordered or counted round fact before applying `nextPlayer`, then commit on the single terminal transition. |
| Confirmed | `src/domain/categoryBomb.ts:270-292` replays by replacing terminal facts with a newly armed round; `CategoryBombExplosionScreen.tsx:17-19` offers replay, rules, or home. | Commit statistics before replay replaces the completed round and change the terminal navigation target to the game session manager. |
| Confirmed | `src/store/categoryBombStore.ts:130-200` persists exactly one `round` at version 1, including deadline recovery and legacy pass-bonus migration. | Introduce a versioned registry migration without regressing timer reconciliation or old pass-bonus compatibility. |
| Confirmed | `src/store/appStore.ts:43-55` resolves a single active game from persisted game presence, and the game ID union already includes all three games. | Keep the active-game ID contract; adapt “has game” inputs to each store's validated active saved session/current game. |
| Confirmed | Focused baseline command `npm run test:run -- src/store/charadesStore.test.ts src/store/categoryBombStore.test.ts src/App.test.tsx src/domain/charades.test.ts src/domain/categoryBomb.test.ts` passed 49 tests in 5 files on 2026-11-24. | The implementation must retain these behaviors while adding session coverage. |
| Inferred | The existing Impostor UI can be visually reused, but direct store coupling prevents safely sharing the entire current component. | Prefer a store-agnostic manager shell and game-specific adapters instead of conditional hooks inside one component. |
| Unverified | No deployed production build or historical local-storage samples were available in this planning pass. | Migration fixtures must cover all repository-known v1 shapes; real upgrade verification remains a release boundary. |

## 4. End-to-end impact and consumer map

### Shared session presentation

- **Producer:** a new callback-driven manager shell and session-card/dialog primitives extracted from `src/features/game/SessionManagerScreen.tsx`.
- **Consumers:** the existing Impostor manager adapter, a Category Bomb manager, and a Charades manager.
- **Invariant:** extracting UI must not change Impostor record ownership, statistics, focus behavior, or copy semantics unexpectedly.
- **Styles:** existing `.session-*` rules in `src/styles.css` should be reused; add only game-specific stat layouts and responsive adjustments.

### Category Bomb flow

1. `App.tsx` opens `CategoryBombSessionManagerScreen` from the home card.
2. Create stores a pending session name, then setup captures the initial roster and rules.
3. `categoryBombStore.startSetup` materializes a `CategoryBombSessionRecord` with stable players or starts the next round for the active record.
4. `acceptCategoryBombAnswer` appends/increments attributable round facts before selecting the next holder.
5. Timer reconciliation or foul transitions the round to `EXPLODED`; the store applies one pure round delta and sets `statsRecorded` atomically.
6. Explosion UI can show the round result plus a compact session snapshot, start a new bomb, review rules, or return to sessions.
7. Continue restores `currentRound`, including wall-clock expiry reconciliation; abort clears only the unfinished round and retains the session/statistics.
8. Session manager statistics consume only cumulative record data, not the live React tree.

### Charades flow

1. `App.tsx` opens `CharadesSessionManagerScreen` from the home card.
2. Create stores a pending session name, then setup captures the flat roster alongside mode/pack/rules. Continuing a record keeps the roster locked.
3. `CharadesSettings` references session player IDs. Non-relay state tracks the next holder by stable ID/index; relay teams reference player IDs.
4. Get Ready and summaries resolve names from the session roster; the active-game state and turn summary carry `holderPlayerId`.
5. Turn start records `startedAtMs`; turn finalization records active duration and ordered events.
6. The store commits the completed-turn delta exactly once when entering `ROUND_SUMMARY`. `advanceFromSummary` cannot double count.
7. When relay reaches `SESSION_SUMMARY`, a separate `relayResultRecorded` guard commits win/loss/tie once to participating players.
8. Finish returns to the saved-session manager without deleting cumulative data. Abort during Get Ready/active play discards only the unfinished turn.
9. Existing pack compatibility, no-repeat history, device adapters, and preferences remain consumers of the current game settings and are not moved into session statistics.

### Contracts and consumers touched

- `src/domain/charades.ts` and tests: active-game naming, stable holder IDs, timing facts, pure statistics derivation.
- `src/domain/categoryBomb.ts` and tests: round attribution facts and pure statistics derivation.
- New game-specific session-stat modules and tests under `src/domain`.
- `src/store/charadesStore.ts`, `src/store/categoryBombStore.ts`, and tests: registries, commands, migrations, validation, exact commit, recovery.
- `src/App.tsx`, `src/App.test.tsx`, and `src/store/appStore.test.ts`: routes, active-game recovery, manager navigation.
- Charades setup/Get Ready/round/session summary and flow tests.
- Category Bomb setup/explosion/active flow and tests.
- Session manager, stats tables, dialogs, styles, and accessibility tests.
- `e2e/charades-flow.spec.ts`, `e2e/category-bomb.spec.ts`, offline scenarios, and README behavior/privacy text.

No API, backend, Dexie schema, service-worker manifest, dependency, permission, or network contract changes are expected.

## 5. Conflicts, invariants, risks, and design options

### Design options considered

1. **Separate game registries with shared UI primitives — selected.** This matches existing store isolation, contains migrations, and lets each game define truthful stats. It duplicates a small amount of lifecycle code but avoids a polymorphic persistence schema.
2. **One universal cross-game session registry.** This would make one group span all games, but requires migrating Impostor and defining cross-game roster/setup/current-game unions. It exceeds the request and increases recovery blast radius.
3. **Automatic recent history without named sessions.** This preserves quick-start flow but cannot provide the Impostor-like reusable group identity the user selected and leaves non-relay Charades attribution ambiguous.

### Intentional invariants

- Games remain playable fully offline and do not emit gameplay/stat data.
- Only one game is active through `appStore.activeGameId`.
- Wall-clock deadlines, not interval counts, resolve Category Bomb and Charades expiry.
- Category Bomb's timer remains hidden; statistics must not reveal the sampled fuse before or during a bomb.
- Current action/card tokens continue rejecting duplicate or late input.
- Charades no-repeat history stays independent from session deletion.
- Impostor session behavior and storage stay backward-compatible.
- Session stats are updated from domain facts, never parsed from rendered labels.

### Conflicts and risks

1. **“CharadesSession” naming collision:** it currently means one active run. Introduce `CharadesSessionRecord` and rename the active type to `CharadesGameState` (or consistently use an equally explicit name) in one mechanical refactor before adding the registry.
2. **Non-relay attribution:** current code has no person identity. A flat roster and deterministic rotation are required; simply adding names to summaries would be unstable across reloads.
3. **Relay identity:** current team members are strings. Convert team membership to player IDs and resolve display names from the session roster.
4. **Double counting:** recovery, repeated sync calls, replay, and summary advancement can revisit terminal states. Persist `statsRecorded`/`relayResultRecorded` within the same atomic store write that updates aggregates.
5. **Category answer semantics:** an accepted tap means “the group allowed the answer,” not verified correctness. Use “successful answers” or “accepted passes” consistently.
6. **Legacy active data:** existing v1 stores may contain a recoverable game but no named registry and, for non-relay Charades, no holder identity. Preserve gameplay without fabricating personal history; see migration policy below.
7. **Large records:** avoid storing an unbounded lifetime event ledger. Keep ordered events only in the current completed game as already needed for recap; commit bounded cumulative counters and fixed-key breakdowns.
8. **Roster lock discoverability:** manager/setup copy must explain that a saved session keeps the same players. Do not silently disable names without an explanation.
9. **Abort semantics:** both games currently allow leaving more casually than Impostor. An active timed unit needs confirmation so users do not accidentally discard it; completed facts remain safe.

## 6. Recommended architecture, data flow, security, and error behavior

### Shared UI, separate domain ownership

Create a store-agnostic saved-session manager shell accepting normalized card metadata and callbacks for create, continue, rename, stats, and delete. The existing Impostor component becomes a thin adapter. Category Bomb and Charades supply their own records and stats detail components. Do not introduce a shared persisted `SessionRecord` union.

### Category Bomb model

Add game-specific types equivalent to:

```ts
interface CategoryBombSessionRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  completedBombs: number
  players: SessionPlayer[]
  setup: CategoryBombSessionSetup
  statsByPlayerId: Record<string, CategoryBombPlayerStats>
  categoryStatsById: Record<string, CategoryBombCategoryStats>
  currentRound: CategoryBombRound | null
}
```

Extend `CategoryBombRound` with `acceptedAnswerPlayerIds: string[]`, `startedAtMs`, and `statsRecorded`. Append the current player ID only when an answer is actually accepted by the action-token/deadline guards. `calculateCategoryBombRoundStats(round, roster)` returns a pure per-player/session delta only for a valid exploded round.

On expiry/foul, the store must use the post-transition round, compute the delta, set `statsRecorded: true`, increment `completedBombs`, and persist both the terminal round and aggregates in one `set` call. Replay and return-to-rules act only after this commit.

### Charades model

Add a saved record with stable `players`, setup defaults, cumulative player stats, an active `CharadesGameState`, completed turn count, completed relay-game count, and timestamps. The active game should contain stable `holderPlayerId` in each summary, `startedAtMs`, a turn-level `statsRecorded` guard, and a relay-level result guard.

Represent relay teams as `{ id, name, memberPlayerIds }`. Validation rejects unknown IDs, duplicates across teams, empty teams, and unassigned roster members. Non-relay `getCurrentHolder` resolves the next player from the saved record's rotation counter. A completed turn advances rotation exactly once after its stats commit.

`calculateCharadesTurnStats(summary, mode)` derives attempts, correct, passes, actual active duration, best turn, streak, fouls, and fixed-key mode/category counters. `calculateRelayResult(game)` derives winner/tie facts only when both teams completed the configured turns. The store combines deltas; React only renders them.

### Error and recovery behavior

- Unknown/deleted session IDs return to that game's manager with a local recovery notice rather than a blank screen.
- Invalid nested records are dropped individually; one corrupt session must not erase other valid sessions or other games' storage.
- A corrupt active game is cleared from its otherwise valid session, preserving roster and cumulative stats.
- Missing custom packs on continuation keep the session and stats, clear the unusable current setup/game if necessary, and route to setup with an actionable pack-selection message.
- Late Category Bomb/Charades input resolves the deadline first and cannot mutate statistics twice.
- Device permission, sound, haptics, orientation, and wake-lock failures remain non-blocking and do not affect stats.
- Division-by-zero values display as `—`, never `NaN` or `Infinity`.

### Security and privacy

Persist only the same local gameplay facts already visible after a round plus names and cumulative counters. Do not add telemetry or cross-origin calls. Delete confirmation must identify the session and state that its stats and unfinished game will be permanently removed from this browser. Do not expose hidden Category Bomb deadline values in the UI or statistics.

## 7. Contract, schema, migration, and compatibility changes

### Contract changes

- Add game-specific session records and stats types; do not reuse Impostor `PlayerStats` because the metric semantics differ.
- Add stable player IDs to all Charades holder/team/summary contracts.
- Add bounded Category Bomb accepted-answer attribution and terminal commit guard.
- Add explicit active-session IDs, pending session names, and lifecycle commands to both stores.
- Adapt `App.tsx` routes and `resolveActiveGame` inputs to validated current games inside active saved sessions.
- Preserve the existing `AppGameId` values and external pack/preferences contracts.

### Persistence versions

- Upgrade `moldyparty-charades` from version 1 to version 2 with `sessionsById`, `activeSessionId`, `pendingSessionName`, and validated current-game state.
- Upgrade `moldyparty-category-bomb` from version 1 to version 2 with the equivalent game-specific registry.
- Leave `moldyparty-game` (Impostor), `moldyparty-app`, pack IndexedDB, preferences, and no-repeat history versions unchanged unless implementation evidence proves a separate need.

### Migration policy

1. **Category Bomb v1 setup/active round:** synthesize a named `Recovered Category Bomb` record from the existing roster/settings, preserving IDs, seats, action token, queue, and deadline. Initialize cumulative stats to zero. If the recovered round has not exploded, allow its eventual explosion to become the first tracked bomb.
2. **Category Bomb v1 already exploded:** preserve the result screen but mark it recorded without adding retroactive counters, because previous versions had no commit marker and migration may be retried.
3. **Charades v1 Team Relay:** stable player IDs may be synthesized deterministically from the stored team/member order. Preserve the active game, but do not backfill already displayed historical summaries; start cumulative tracking at the next unrecorded turn.
4. **Charades v1 non-relay:** preserve the current run in a `Recovered Charades` session with tracking disabled for the legacy current/completed turn because no holder identity exists. After the result/abort, require roster setup before the next tracked turn. Do not attribute legacy performance to a fabricated person.
5. Migration must be idempotent and fixture-tested for `GET_READY`, `ACTIVE`, `ROUND_SUMMARY`, `SESSION_SUMMARY`, Category Bomb placement/ready/active/exploded, expired deadlines, malformed nested values, and unrelated storage preservation.
6. No historical statistics are reconstructed beyond the explicit safe cases above. Manager copy should state when tracking begins after a recovered legacy game.

### Compatibility

Current home-card labels, packs, feedback preferences, device fallbacks, hidden Category Bomb timer, no-repeat history, and offline cache behavior remain compatible. Existing tests are regression obligations, not disposable snapshots. If active-type renaming touches many imports, perform it as a behavior-neutral phase with passing tests before schema work.

## 8. Ordered implementation phases with exact owners

Every phase starts with failing tests for its new contract and ends with the focused verification named below.

### Phase 0 — Lock naming and baseline

**Owners:** `src/domain/charades.ts`, all Charades imports/tests, current test suite.

1. Record full unit/lint/build baseline.
2. Rename the active Charades run type to `CharadesGameState` (or the chosen explicit equivalent) without behavior changes.
3. Confirm all focused and full tests remain green before schema changes.

### Phase 1 — Reusable session-manager presentation

**Owners:** `src/features/game/SessionManagerScreen.tsx`, new shared session UI components, `src/styles.css`, Impostor component/app tests.

1. Extract callback-driven cards, create form, rename dialog, delete dialog, focus restoration, and empty state.
2. Keep the Impostor adapter and `SessionStatsTable` behavior unchanged.
3. Test keyboard focus trapping/restoration, cancel/confirm, duplicate display names, and sorted timestamps.

### Phase 2 — Category Bomb domain and saved store

**Owners:** `src/domain/categoryBomb.ts`, new Category Bomb stats module, `src/store/categoryBombStore.ts`, their tests.

1. Add session/player/stats contracts and ordered accepted-answer attribution.
2. Test deadline/action-token races, foul/timer splits, per-player counts, derived rates, best/longest bomb, and pure delta behavior.
3. Add registry commands, exact terminal commit, stable roster/setup reuse, abort, and individual-record validation.
4. Add v1-to-v2 migrations and corruption isolation fixtures.
5. Prove replay, recovery, and repeated sync cannot double count.

### Phase 3 — Charades identity and statistics domain

**Owners:** `src/domain/charades.ts`, new Charades stats module, domain tests.

1. Add a stable flat roster and ID-based team membership/holder summaries.
2. Test non-relay rotation, relay assignments, reload continuation, aborted-turn rotation, and validation failures.
3. Add start/end timing and pure turn-stat derivation for correct/pass/rate/best/streak/foul/mode/category metrics.
4. Add pure relay result derivation for win/loss/tie and player contribution.

### Phase 4 — Charades saved store and migration

**Owners:** `src/store/charadesStore.ts`, no-repeat history integration boundary, store tests.

1. Add registry lifecycle, pending name, active-session pointer, setup reuse, exact turn/result commit, and abort.
2. Preserve pack-scoped no-repeat writes exactly once.
3. Add v1 migration, tracking-disabled legacy recovery, missing-pack behavior, and nested-record isolation.
4. Prove repeated deadline sync, summary advancement, reload, and relay completion cannot double count.

### Phase 5 — Category Bomb UI and routing

**Owners:** `App.tsx`, Category Bomb manager/setup/game/explosion screens, abort dialog, stats view, styles, component/app tests.

1. Route the home card through the game-specific manager.
2. Implement create/continue/rename/stats/delete and locked-roster setup copy.
3. Add compact result stats plus New bomb, Review rules, and Return to sessions.
4. Confirm active abort and terminal navigation retain completed statistics.
5. Preserve radial/name-only layouts and large-roster ergonomics.

### Phase 6 — Charades UI and routing

**Owners:** `App.tsx`, Charades manager/setup/Get Ready/summary screens, stats view, styles, component/app tests.

1. Route the home card through the manager and add named roster setup for every mode.
2. Replace relay free-text member identity with accessible assignment controls over the stable roster.
3. Show the named holder for every Get Ready and recap screen.
4. Add session stats and compact turn/relay result snapshots.
5. Change Finish/abort/navigation so cumulative stats survive while unfinished turns do not count.

### Phase 7 — Integration, migration, offline, and documentation

**Owners:** app store/routing tests, `e2e/charades-flow.spec.ts`, `e2e/category-bomb.spec.ts`, offline production tests, `README.md`.

1. Cover create, continue, resume, rename, stats, delete, abort, replay, return, reload, and corrupt-session recovery for both games.
2. Verify session isolation across all three games and active-game recovery after reload.
3. Verify production-build offline creation, completion, stats viewing, and continuation.
4. Run full unit tests, lint, build, E2E, and service-worker inspection.
5. Update README only after behavior and migration are verified.

## 9. Verification matrix and acceptance criteria

| Requirement | Verification | Acceptance criterion |
|---|---|---|
| Impostor-like lifecycle | Shared UI/component/app/E2E tests | Both games support named create, continue/resume, rename, stats, confirmed delete, and stable roster behavior. |
| Session isolation | Store/app tests | Mutating or deleting one game/session cannot modify another session, another game, packs, preferences, or history. |
| Category attribution | Domain/store tests | Every accepted answer credits the holder before the pass; late/duplicate taps credit nobody. |
| Category completion | Fake clock/store/migration tests | Timer/foul explosion commits one bomb exactly once, including hydration after expiry. |
| Category stats truthfulness | Domain/UI tests | UI says successful/accepted answer, never objective correctness; rates handle zero safely; hidden deadline is never exposed. |
| Charades stable identity | Domain/setup/recovery tests | Every mode resolves a stable holder ID/name; relay membership uses known unique IDs; rotation survives reload. |
| Charades turn stats | Ordered-event/fake-clock tests | Correct, pass, accuracy, rate, best, streak, foul, mode, and category counters match the completed turn exactly once. |
| Relay results | Domain/store/E2E tests | Win/loss/tie commits once after both teams complete configured turns; contributions follow actual holders. |
| Abort behavior | Component/store/E2E tests | Active unit requires confirmation, adds no stats, and leaves prior completed stats intact. |
| Terminal navigation | Component/E2E tests | Replay/next turn/finish/return cannot erase or duplicate committed stats. |
| Migration | Versioned fixture tests | All known v1 phases recover as documented; no personal stats are fabricated; corrupt records are isolated. |
| Missing pack | Store/app tests | Session/stats survive and user is routed to choose a valid pack with actionable copy. |
| Accessibility | Testing Library + keyboard E2E | Dialog focus is trapped/restored, actions have specific labels, tables have captions, and stats are not conveyed by color alone. |
| Responsive layouts | Mobile/desktop E2E | Manager/stats/roster/team assignment work at existing mobile targets without regressing Category Bomb play layouts. |
| Offline/privacy | Production build + offline E2E + source review | Entire lifecycle works after first load and no gameplay/stat network transmission is added. |
| Regression | Existing suites + full commands | Current 49-test focused baseline and the full repository suite, lint, build, and E2E all pass. |

Feature acceptance requires all applicable rows, clean lint/build, and no unreviewed loss of v1 recoverable gameplay. Derived percentages/rates must be tested at zero, one, and multiple completed units.

## 10. Rollout, rollback, observability, cleanup, and unverified boundaries

### Rollout

1. Land the behavior-neutral Charades type rename and shared Impostor manager extraction first.
2. Land game-specific domain/stat/store work with managers still unlinked until migration and exact-count tests pass.
3. Enable Category Bomb sessions, then Charades sessions, so migration and UI failures are isolated.
4. Run upgrade tests from repository-known v1 payloads and production offline verification before release.

### Rollback

- If UI rollout fails before users create v2 data, restore direct setup routes while leaving new code unreachable.
- Once v2 records exist, do not downgrade writers to v1 or delete registries. A rollback build must retain a forward reader or hide the feature while preserving data.
- Never clear another game's storage as part of repair. Session deletion remains an explicit user action.

### Observability

This remains a telemetry-free local app. Evidence comes from deterministic injected clocks/randomness, migration fixtures, store invariants, accessible recovery notices, E2E flows, production-build offline checks, and manual inspection of persisted payloads during QA. Do not add analytics for this feature.

### Cleanup

- Remove transitional duplicated manager markup after all three adapters use the shared presentation.
- Centralize each game's record validation and delta addition; do not leave UI-side stat arithmetic.
- Keep event detail only where recap/recovery requires it; cumulative records use bounded counters and fixed-key maps.
- Update living README/privacy text and keep generated `dist`, Playwright reports, and test results uncommitted.

### Unverified boundaries and open decisions

1. Real installed-user v1 payloads and service-worker upgrade behavior were not available; release QA must validate against the latest deployed build if one exists.
2. The exact visual density of wide per-player stat tables needs mobile design/QA; the data contract should not be reduced solely to fit one table.
3. The minimum Charades roster size is not established by current behavior. Recommend at least two named players for an Impostor-like group session, but product may permit a one-player practice session without changing persistence architecture.
4. Whether session roster editing should ever preserve or archive old player stats is intentionally deferred.
5. “Nemesis category” display needs a minimum-sample threshold. Recommend not showing it until a player has at least three explosions; the underlying fixed-key counts may still be stored from the first bomb.

## 11. Self-review result

- **Unsupported claims:** device/deployment upgrade behavior is labeled unverified; current behavior claims cite files, symbols, lines, or the focused test command.
- **Consumer coverage:** domain, stores, routing, setup, active play, results, shared manager UI, persistence, migration, no-repeat boundary, tests, offline behavior, and documentation are included.
- **Conflict resolution:** the selected Impostor-like behavior is implemented as per-game registries with shared UI, not an accidental universal session model.
- **Metric integrity:** Category Bomb does not claim objective correctness or timing skill; Charades does not credit unidentified clue-givers.
- **Exactly-once safety:** every terminal unit has a persisted guard and store-owned atomic aggregate update.
- **Compatibility:** v1 active games are preserved without fabricating personal statistics; unrelated storage and existing Impostor sessions remain isolated.
- **Scope control:** no backend, account, telemetry, dependency, pack schema, or PWA manifest expansion is planned.
- **Repository hygiene:** this planning artifact is the only authorized change and is not committed.
