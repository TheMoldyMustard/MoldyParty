# Impostor Jester and Outlier Roles — Feature Impact Plan

**Date:** 2026-11-02  
**Status:** Decision-ready; planning only  
**Canonical scope:** Add optional Jester and Outlier roles to Impostor, give Outlier an optional hint and a private word-guess flow, and reveal every player's role at round end.

## 1. Decision summary and feature brief

### Recommendation

Model Jester and Outlier as first-class optional singleton roles in the existing pure game domain. Add a dedicated `OUTLIER_GUESS` phase between the final ballot and public results when Outlier is enabled. Keep Jester and Outlier disabled by default, keep Outlier hints disabled by default, and preserve the current voting flow for every player.

The public result screen should retain the vote result and secret word, add any special-role win/loss result, and replace the impostor-only identity summary with a roster showing every player's name and role. This keeps assignment, transitions, guess validation, and outcome calculation deterministic and testable outside React.

### Feature brief

- **Jester:** does not receive the secret word or hint. The Jester wins only when they are the uniquely voted-out player. A tie, skipped result, or another eliminated player means the Jester loses.
- **Outlier:** does not receive the secret word. By default they receive no hint; setup can enable the same round hint currently selected from the word item. After all votes are locked, the device is privately passed to the Outlier for one free-text word guess. A correct guess is their only win condition; whether they were voted out is irrelevant.
- **End-of-round reveal:** show the role of every player, including Innocent, Impostor, Jester, and Outlier.

No product code, configuration, dependencies, or git history are changed by this document.

## 2. Scope, non-goals, permissions, and assumptions

### In scope

- Optional Jester and Outlier controls in Impostor setup.
- A conditional `Give Outlier a hint` control, off by default.
- Deterministic, mutually exclusive assignment of the enabled special roles.
- Role-specific private reveal content.
- A private Outlier guess step after voting and before public results.
- Domain-owned Jester and Outlier win/loss calculation.
- A public final roster revealing every player's role.
- Replay, category-change, return-to-lobby, refresh recovery, documentation, accessibility, unit/component, and end-to-end coverage for the new flow.
- A local-persistence migration for existing version-1 state.

### Non-goals

- Multiple Jesters or multiple Outliers in one round.
- A generic plug-in role engine or user-authored roles.
- Changing word-pack schemas, pack import/export, hint selection, vote counting, self-vote prevention, or tie behavior.
- Adding accounts, a server, telemetry, or remote multiplayer.
- Defining new team-win semantics for Innocents and Impostors; the current caught/not-caught vote verdict remains intact.
- Fuzzy, semantic, or AI-assisted grading of Outlier guesses.

### Permissions and constraints

- This plan is the only authorized write for this planning task.
- The application is an offline-first, shared-device React application; secrets must remain masked during hand-offs and after hydration.
- Existing uncommitted changes in `src/domain/builtInPacks.ts` and `src/domain/game.test.ts` belong to the user and must be preserved during implementation.

### Planning assumptions

These calls make the plan executable without silently broadening the requested rule set:

1. Jester and Outlier are each setup toggles (zero or one of each), while Impostor remains a numeric count.
2. At least one Innocent must remain so at least one participant knows the word during discussion. Therefore `impostorCount + enabledJester + enabledOutlier < playerCount`.
3. Jester receives only their role and goal; they do not receive the word or hint.
4. Outlier receives only their role and goal, plus the selected broad hint when its dedicated setting is enabled.
5. The Outlier submits one private guess after all votes and before any public result is shown, even if the vote eliminated that Outlier.
6. Guess matching trims surrounding whitespace and compares with locale-insensitive case folding. It does not ignore punctuation, correct spelling, or accept synonyms.
7. All roles participate in discussion and secret voting under the current rules.
8. The final roster is public because it appears only after all private actions are complete.

## 3. Current-state evidence ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | `src/domain/types.ts:1-2` defines five phases and only `INNOCENT \| IMPOSTOR`; `Player.role` consumes that union at `src/domain/types.ts:4-8`. | Both the phase machine and role contract must expand. |
| Confirmed | `validateSetup` in `src/domain/game.ts:12-40` validates player names, Impostor count, pack contents, and timer only. | Special-role capacity and default rules belong in the same domain validator. |
| Confirmed | `createRound` in `src/domain/game.ts:51-95` chooses the word/hint and assigns only shuffled Impostor indexes. | Assignment must reserve distinct indexes for enabled singleton roles while retaining injected randomness. |
| Confirmed | `recordVote` in `src/domain/game.ts:146-169` sends the last voter directly to `GAME_OVER` and calculates only `VoteResult`. | Outlier guessing requires an intermediate phase and a separate special-role outcome model. |
| Confirmed | `LobbyDraft`, `draftFromSetup`, and `submit` in `src/features/game/LobbyScreen.tsx:10-74` carry Impostor count and one hint flag; controls render at `src/features/game/LobbyScreen.tsx:86-94`. | Draft, setup construction, capacity clamping, validation errors, and setup UI are all consumers of new settings. |
| Confirmed | `RoleRevealScreen` uses a binary conditional at `src/features/game/RoleRevealScreen.tsx:54-57`. | Rendering must become exhaustive by `PlayerRole`; a fall-through Innocent branch would leak the word to new roles. |
| Confirmed | `AppContent` dispatches screens directly by phase at `src/App.tsx:20-28`. | The new phase needs a dedicated screen route. |
| Confirmed | `GameOverScreen` derives only eliminated player and Impostors at `src/features/game/GameOverScreen.tsx:11-24`. | It must consume special outcomes and render a complete role roster. |
| Confirmed | `createGameStore` persists setup/game and forcibly masks role/ballot UI at `src/store/gameStore.ts:186-205`; persistence is version 1. | Confirmed guesses may persist, but unconfirmed text/readiness must remain transient; migration is required. |
| Confirmed | `playAgain` rebuilds the round from stored setup at `src/store/gameStore.ts:145-166`. | New settings naturally replay only if they are part of `GameSetupInput` and migrated setup state. |
| Confirmed | Store refresh tests cover role and ballot secrecy at `src/store/gameStore.test.ts:90-126`. | Equivalent recovery tests are required for the Outlier hand-off and pending guess. |
| Confirmed | The full UI path is covered through public result/replay at `src/features/game/GameFlow.test.tsx:76-126`, and Playwright covers the standard flow in `e2e/game-flow.spec.ts:14-40`. | Existing no-special-role behavior must remain a regression path; a special-role path must be added. |
| Confirmed | `README.md:37-41,67-68` documents current setup, result, domain ownership, and phase lifecycle. | User-facing rules and architecture documentation must be updated. |
| Confirmed | Read-only baseline on 2026-11-02: `npm run test:run -- --reporter=dot` passed 9 files / 58 tests; `npm run build` completed TypeScript and Vite/PWA output successfully. | Implementation starts from a green unit/component/build baseline. End-to-end tests were not run during planning. |
| Inferred | No API, auth, audit, or server boundary exists in the discovered source; round state is local Zustand persistence and packs use Dexie. | No network contract or database migration is expected, but local-storage compatibility is material. |

## 4. End-to-end impact and consumer map

### Settings contract

`LobbyScreen.LobbyDraft`  
→ `LobbyScreen.submit()`  
→ `GameSetupInput`  
→ `validateSetup()` / `createRound()`  
→ `GameStoreState.setup` persistence  
→ `playAgain()`  
→ `draftFromSetup()` when returning to setup

New fields at this boundary:

- `jesterEnabled: boolean`
- `outlierEnabled: boolean`
- `outlierHintsEnabled: boolean`

Owners: `src/features/game/LobbyScreen.tsx`, `src/domain/types.ts`, `src/domain/game.ts`, `src/store/gameStore.ts`, and their tests.

### Role and result flow

`createRound()` assigns roles  
→ `RoleRevealScreen` privately renders role knowledge  
→ `DiscussionScreen` remains role-agnostic  
→ `VotingScreen` remains role-agnostic  
→ `recordVote()` stores the final `VoteResult`  
→ optional `OUTLIER_GUESS` hand-off and `recordOutlierGuess()`  
→ special-role outcomes are derived  
→ `GameOverScreen` publicly renders vote verdict, word, special outcomes, and all player roles

Owners: `src/domain/types.ts`, `src/domain/game.ts`, `src/store/gameStore.ts`, new `src/features/game/OutlierGuessScreen.tsx`, `src/features/game/RoleRevealScreen.tsx`, `src/features/game/GameOverScreen.tsx`, `src/App.tsx`, and `src/styles.css`.

### Persisted state consumers

- Producer: Zustand `partialize` in `src/store/gameStore.ts`.
- Consumers: hydration `merge`, every phase screen selected by `src/App.tsx`, `playAgain`, `changeCategory`, `returnToLobby`, and store tests.
- Persisted: confirmed game state, including `VoteResult`, current Outlier index, and confirmed guess record.
- Never persisted: role visibility, Outlier ready/unmasked state, or unconfirmed guess text.

### Unaffected boundaries

- `WordItem`/`WordPack`, built-in/custom packs, Dexie schemas, pack parser/import/export, PWA manifest, and install/update prompts do not need contract changes.
- Voting eligibility, ballot shape, candidate list, vote counts, ties, and skipped votes remain unchanged.

## 5. Conflicts, invariants, risks, and design options

### Intentional invariants

- One shared device and a neutral hand-off before private content.
- A player cannot vote for themselves; skipped ballots and ties keep their current meaning.
- The selected word and hint stay internal even when a role is not shown either value.
- Role assignment remains deterministic under injected randomness for tests.
- Replay keeps setup and reshuffles all roles.
- Refresh recovery must not reveal a role, ballot, or unconfirmed Outlier guess.

### Conflicts and risks

1. **Binary role assumptions:** the reveal screen's current ternary would incorrectly treat any non-Impostor as Innocent and expose the word.
2. **Terminal transition:** the final vote currently makes results public immediately, leaving no private time for an Outlier guess.
3. **No winner model:** `VoteResult` records elimination only; Jester and Outlier need outcome rules that must not be inferred ad hoc by React.
4. **Role capacity:** independent controls could allocate all players to non-Innocent roles, undermining discussion and word knowledge.
5. **Persistence privacy:** putting pending guess text in the persisted store could expose it after reload or to the next holder.
6. **Backward compatibility:** version-1 saved setup/game objects lack all new fields. TypeScript defaults do not repair already serialized data.
7. **Result density:** revealing every role plus the word, vote verdict, and special outcomes can overflow small screens; the existing centered result layout must become scroll-safe.
8. **Concurrent user work:** current edits to built-in packs and their tests overlap a domain test file that this feature will also need to extend.

### Design options

#### Option A — First-class singleton roles plus a dedicated guess phase (recommended)

Add explicit setup booleans, role union members, a new phase, one confirmed guess record, and domain-owned outcome helpers.

- **Pros:** matches the requested rules directly; prevents public result leakage; keeps state transitions explicit; is straightforward to test and migrate.
- **Cons:** expands the finite-state machine and store actions; later support for multiple Jesters/Outliers needs a contract change.

#### Option B — Collect the Outlier guess on the result screen

Enter `GAME_OVER` after voting but hide the public result until a guess is submitted.

- **Pros:** avoids a new `GamePhase` union member.
- **Cons:** makes `GAME_OVER` mean both secret incomplete work and public completion, complicates privacy, hydration, screen logic, and accessibility. It creates more conditional state than it removes.

#### Option C — Introduce a generic role registry and rule engine

Represent each role with assignment limits, reveal content, phase hooks, and win predicates.

- **Pros:** maximizes extensibility for future roles.
- **Cons:** materially larger abstraction, migration, and test surface than two known singleton roles require; risks obscuring current simple rules.

**Selected recommendation:** Option A. It is the smallest design that gives the Outlier a genuinely private post-discussion guess and gives both roles explicit, testable outcomes.

## 6. Recommended architecture, data flow, security, and error behavior

### Domain types

In `src/domain/types.ts`:

- Extend `PlayerRole` with `'JESTER' | 'OUTLIER'`.
- Extend `GamePhase` with `'OUTLIER_GUESS'`.
- Add the three setup booleans listed in section 4.
- Add `OutlierGuessRecord { playerId: string; guess: string; isCorrect: boolean }`.
- Add GameState fields for copied setup flags, current Outlier guess index, and confirmed `outlierGuesses` (an array keeps the transition shape future-safe even though setup permits one).
- Add `SpecialRoleOutcome { playerId; role: 'JESTER' | 'OUTLIER'; won; reason }`, returned by a pure resolver rather than persisted redundantly.

Do not add role-specific optional fields to `Player`; the role union plus round settings/records already owns that state and avoids partially valid player objects.

### Validation and assignment

In `src/domain/game.ts`:

- `validateSetup()` rejects non-boolean new flags and rejects configurations where reserved non-Innocent seats are greater than or equal to player count.
- It normalizes `outlierHintsEnabled` to meaningful only when Outlier is enabled; the UI should switch it off when Outlier is disabled, while domain creation should defensively treat it as false.
- `createRound()` uses one shuffled index list, consumes the requested Impostor seats first, then Jester and Outlier seats, and assigns remaining players as Innocent. Do not shuffle independently per role because that permits collisions.
- Store the selected word/hint exactly as today.

### Role knowledge

Refactor `RoleRevealScreen` to an exhaustive role-to-content mapping:

- Innocent: secret word and existing goal text.
- Impostor: current configured Impostor hint behavior.
- Jester: role name plus “Get yourself voted out”; no word or hint.
- Outlier: role name plus “Guess the secret word after voting”; show `Hint: …` only when `outlierHintsEnabled`, otherwise “No hint.”

The existing hold-to-reveal, blur, pointer-leave, visibility-change, and confirmation protections remain mandatory for every role.

### Vote-to-guess transition

- On the final ballot, `recordVote()` always calculates and stores `VoteResult`.
- If an Outlier exists, transition to `OUTLIER_GUESS`; otherwise transition to `GAME_OVER` exactly as today.
- Add pure `recordOutlierGuess(state, guess)` that only accepts the guess in `OUTLIER_GUESS`, rejects blank input, validates the active player has the Outlier role, records the trimmed submitted value and correctness, then transitions to `GAME_OVER` after the configured Outlier has guessed.
- Add pure `calculateSpecialRoleOutcomes(state)`:
  - Jester wins only when `voteResult.eliminatedPlayerId === jester.id`.
  - Outlier wins only when their confirmed record is correct.
  - The vote target is deliberately not part of the Outlier predicate.

### Store and private UI

In `src/store/gameStore.ts` add transient `isOutlierGuessReady` and `pendingOutlierGuess`, plus `showOutlierGuess`, `setOutlierGuess`, and `confirmOutlierGuess` actions.

Create `OutlierGuessScreen.tsx` using `PassDeviceMask` before showing the text input. The screen must:

- name the Outlier only on the neutral pass screen;
- show no word or vote result;
- require non-blank input before confirmation;
- clear the input and remask after confirmation;
- remask/clear on refresh, tab hiding, and navigation just as role reveal does.

Confirmed guesses belong to `GameState` and can survive refresh; readiness and draft text must be excluded from `partialize` and reset by hydration `merge`.

### Public result screen

Update `GameOverScreen` to render, in order:

1. Existing vote heading and caught/innocent/tie verdict.
2. Secret word.
3. Jester and Outlier win/loss callouts when those roles were enabled, including the Outlier's submitted guess.
4. A responsive roster containing every player name and exact role, with a marker on the eliminated player.
5. Existing replay/category/lobby actions.

Use an exhaustive role-label/style map rather than `role.toLowerCase()` as the only behavioral branch. Make the page vertically scrollable on small screens and retain semantic headings/list markup.

### Error behavior

- Invalid special-role capacity blocks starting the round with a setup-level message explaining that one Innocent must remain.
- A blank Outlier guess keeps the confirm action disabled and is also rejected by the domain function.
- Guess submission outside `OUTLIER_GUESS`, a missing Outlier, or a duplicate confirmed guess returns the unchanged state or throws a stable programmer-facing error consistent with existing domain command handling; tests must lock the chosen behavior.
- A malformed legacy persisted phase or player role should fail closed to a fresh lobby during migration rather than display secret or inconsistent state.

## 7. Contract, schema, migration, and compatibility changes

### TypeScript contracts

| Contract | Change | Consumers to update |
|---|---|---|
| `GamePhase` | Add `OUTLIER_GUESS` | `App.tsx`, domain transitions/tests, store tests, README lifecycle. |
| `PlayerRole` | Add `JESTER`, `OUTLIER` | Assignment, reveal screen, result screen, test fixtures, CSS role styles. |
| `GameSetupInput` | Add three booleans | Lobby draft/submit, all setup fixtures, replay, persistence migration. |
| `GameState` | Add copied role settings and Outlier guess progress/records | Domain factories/transitions, store persistence, screens, fixtures. |
| Store interface | Add Outlier guess transient state/actions | New screen, store initialization/reset/hydration, store tests. |

### Local persistence migration

Bump the `moldyparty-game` Zustand persistence version from 1 to 2 and provide an explicit `migrate` function:

- Default absent setup/game `jesterEnabled`, `outlierEnabled`, and `outlierHintsEnabled` to `false`.
- Default absent confirmed guess records to `[]` and guess index to `0`.
- Preserve valid version-1 player roles, word, hint, votes, timer, and phase.
- Always force `isRoleVisible`, `isVoteReady`, `isOutlierGuessReady`, pending ballot, and pending guess to their masked/empty values after hydration.
- If the persisted shape cannot be safely normalized, discard the in-progress `game` while retaining a normalized setup where possible.

No Dexie or word-pack migration is needed. Existing version-1 rounds continue under the old two-role defaults, so the change is backward-compatible after migration.

## 8. Ordered implementation phases with exact owners

### Phase 1 — Lock domain rules with tests

**Owners:** `src/domain/game.test.ts`, `src/domain/types.ts`, `src/domain/game.ts`

1. Extend shared test fixtures with disabled-role defaults without overwriting the user's current built-in-pack assertions.
2. Add failing tests for special-role capacity, mutually exclusive deterministic assignment, no-special-role compatibility, role reshuffling, Outlier hint flags, final-vote branching, guess normalization/rejection, Jester outcome, and Outlier outcome independent of elimination.
3. Add the new types and implement the smallest pure functions needed to pass those tests.

### Phase 2 — Store commands and persistence migration

**Owners:** `src/store/gameStore.test.ts`, `src/store/gameStore.ts`

1. Add failing store-flow tests for final ballot → Outlier hand-off → confirmed guess → game over.
2. Add migration tests using a literal version-1 persisted payload.
3. Add privacy tests proving refresh discards a visible/pending guess while preserving a confirmed guess.
4. Implement store state/actions, reset paths, replay behavior, version bump, migration, `partialize`, and `merge` changes.

### Phase 3 — Setup and private role UI

**Owners:** `src/features/game/GameFlow.test.tsx`, `src/features/game/LobbyScreen.tsx`, `src/features/game/RoleRevealScreen.tsx`, `src/styles.css`

1. Add Jester and Outlier switches under Round rules and a conditional Outlier hint switch.
2. Update player-count changes so impossible special-role combinations show validation rather than silently reassigning a selected role.
3. Replace binary reveal rendering with exhaustive role content and add accessible role-specific styling.
4. Test defaults, conditional hint setting, invalid capacity, and secret reveal content for all four roles.

### Phase 4 — Outlier guess screen and app routing

**Owners:** new `src/features/game/OutlierGuessScreen.tsx`, `src/App.tsx`, `src/features/game/GameFlow.test.tsx`, `src/styles.css`

1. Route `OUTLIER_GUESS` before `GAME_OVER`.
2. Build the masked pass-device and private input states.
3. Test blank submission, secret masking, correct/incorrect guesses, and both eliminated/not-eliminated Outlier paths.

### Phase 5 — Complete result reveal

**Owners:** `src/features/game/GameOverScreen.tsx`, `src/features/game/GameFlow.test.tsx`, `src/styles.css`

1. Render special outcomes from the domain resolver.
2. Render all players and roles, with elimination and win/loss markers separated so the Outlier's vote status cannot be mistaken for their outcome.
3. Test Innocent, Impostor, Jester, and Outlier labels; tie/no-elimination; special wins/losses; small-screen scrollability; and unchanged result actions.

### Phase 6 — End-to-end and documentation

**Owners:** `e2e/game-flow.spec.ts`, `README.md`

1. Keep the existing standard round as the backward-compatible E2E path.
2. Add a deterministic special-role E2E path that configures both roles, completes the Outlier guess, and asserts the full role roster.
3. Document role goals, defaults, guess timing/matching, final role reveal, lifecycle, and refresh privacy.

## 9. Verification matrix and acceptance criteria

| Area | Verification | Acceptance |
|---|---|---|
| Setup defaults | Component and domain tests | Jester off, Outlier off, Outlier hint off; an ordinary round behaves exactly as before. |
| Capacity | Domain/component tests for 3+ players and boundary combinations | Round cannot start unless at least one Innocent remains; no player receives two roles. |
| Assignment | Injected-random domain tests | Enabled singleton roles appear exactly once and replay reshuffles them. |
| Reveal secrecy | Component tests for pointer, keyboard, blur, visibility change | Jester/Outlier never see the word; Outlier sees a hint only when explicitly enabled. |
| Voting | Existing plus new domain/store tests | Every role votes; vote counting, skip, tie, and self-vote rules are unchanged. |
| Guess flow | Domain/store/component tests | Final ballot enters private guess only when Outlier exists; one non-blank guess is recorded. |
| Outcomes | Table-driven pure-domain tests | Jester depends only on unique elimination; Outlier depends only on normalized word equality, regardless of elimination. |
| Result roster | Component/E2E assertions | Every player appears exactly once with the correct role; secret word and vote verdict remain visible. |
| Refresh recovery | Version-1 migration and phase hydration tests | Old rounds load with roles off; no visible role, pending ballot, ready guess, or draft guess leaks after hydration. |
| Replay/navigation | Store/component tests | Play Again keeps role settings and reassigns; Change Category retains editable setup; Return to Lobby clears the round. |
| Accessibility/responsive UI | Testing Library roles/labels plus manual narrow viewport check | Controls have labels, hand-offs are announced, outcome list uses semantics, and result actions remain reachable without horizontal overflow. |
| Regression | `npm run test:run`, `npm run build`, `npm run lint`, `npm run e2e` | All commands pass after implementation; standard no-special-role E2E remains green. |

### User-visible acceptance criteria

1. Setup displays optional Jester and Outlier roles; Outlier hints are independently configurable and off by default.
2. Starting a valid round assigns enabled roles to distinct players and leaves at least one Innocent.
3. Jester and Outlier private reveals never show the secret word.
4. After voting, an enabled Outlier privately guesses before anyone sees the result.
5. The Jester is marked as winning only when voted out; the Outlier is marked as winning only for a correct guess, whether or not voted out.
6. The final screen publicly lists every player and their role.
7. A round without Jester or Outlier follows the current flow without an extra screen.
8. Refreshing during a private step never exposes secret content or an unfinished guess.

## 10. Rollout, rollback, observability, cleanup, and unverified boundaries

### Rollout

- Ship as a single backward-compatible client release with both new roles opt-in and disabled for migrated setups.
- Run the full verification matrix before release; manually exercise at least 3-player and larger configurations on a narrow mobile viewport.
- Because this is offline/PWA software, verify an update from an installed version-1 build as well as a clean install so the service worker and persisted-state migration are exercised together.

### Rollback

- Code rollback is safe only if version-2 persisted data is tolerated by the older client. Before release, verify Zustand's older version behavior; if it discards newer state, document that an in-progress special-role round may reset after rollback.
- If preserving downgrade compatibility is required, keep the serialized additions optional and avoid destructive mutation of version-1 fields.
- No server or Dexie rollback is required.

### Observability

- No analytics system exists and adding one is out of scope.
- Treat domain/store/component/E2E assertions and reproducible migration fixtures as the operational signal.
- Keep user-facing validation specific enough to diagnose invalid seat allocation without logging the secret word or guesses.

### Cleanup

- Remove the impostor-only result summary if the all-role roster makes it redundant; do not maintain two identity sources that can drift.
- Centralize role labels/reveal copy/styles in exhaustive maps where practical.
- Update all test setup literals so disabled defaults are explicit and future role additions fail compilation at meaningful consumers.

### Unverified boundaries and explicit follow-up decisions

- **Unverified:** Exact desired Jester knowledge was not stated. This plan selects no word/no hint because that makes voting manipulation, not word knowledge, the role's defining mechanic.
- **Unverified:** Exact Outlier guess timing was not stated. This plan selects a private post-vote/pre-result step because it permits discussion-informed guessing without leaking the result.
- **Unverified:** Guess tolerance was not stated. This plan selects trim + case-insensitive exact equality; punctuation variants, aliases, and typos lose.
- **Unverified:** Whether future rounds should allow multiple Jesters/Outliers was not stated. This plan deliberately supports one of each; count controls require a later contract decision.
- **Unverified:** The end-to-end suite and installed-PWA upgrade path were not run during planning.
- **No blocker:** None of these boundaries prevents implementation under the documented assumptions; changing any of the first four changes product rules and should update this canonical plan before coding.

## Self-review record

- Consequential current-state claims are tied to source symbols/lines or command output.
- Producer/consumer coverage includes setup, domain, store, persistence, phase routing, private screens, result UI, replay/navigation, tests, documentation, and release behavior.
- The plan does not alter word packs, Dexie, dependencies, server contracts, or unrelated features.
- Special-role outcomes are not conflated with the existing vote verdict.
- User-owned uncommitted changes are explicitly protected.
- Open product semantics are resolved as named assumptions rather than left as placeholders.
