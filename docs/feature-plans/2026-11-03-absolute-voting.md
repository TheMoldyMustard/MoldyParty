# Absolute Voting: optional no-handoff voting

**Status:** Planning only  
**Date:** 2026-11-03  
**Feature owner:** Impostor game flow

## 1. Decision summary and feature brief

Add an optional round setting named **Absolute Voting**. When disabled, voting keeps the existing private `PassDeviceMask` handoff. When enabled, the voting screen remains visible to the whole group and records each player's public choice without asking anyone to pass the device. The existing `VoteRecord`, vote counts, skip behavior, self-vote rule, tie behavior, Outlier transition, and result rendering remain authoritative.

Add an **Absolute Voting** action to the post-game result screen as a shortcut for starting the next round with the same setup and this mode enabled. This is assumed to mean “use Absolute Voting for the next round”; it must not re-run or mutate the completed round's result.

**Recommendation:** implement public, no-handoff voting as a presentation/interaction variant over the existing sequential voter index. This is the smallest compatible change and preserves voter identity, self-vote protection, skips, ties, persistence, and Outlier timing. A true simultaneous multi-person ballot would require a different input model and would not be reliably expressible on one shared touchscreen.

## 2. Scope, non-goals, permissions, and assumptions

### In scope

- A boolean round setting in lobby setup, defaulting to off.
- Round state carries the setting so replay and refresh recovery preserve it.
- Absolute Voting removes only the private voting handoff; it does not alter private role reveal or private Outlier guessing.
- The Game Over screen offers an explicit Absolute Voting next-round shortcut.
- Responsive/accessibility copy and focused unit/component coverage.

### Non-goals

- No accounts, network sync, multi-device voting, anonymous ballots, or server/API changes.
- No change to role assignment, vote eligibility, skip semantics, tie semantics, vote result calculation, or winner rules.
- No global preference-store setting unless product later decides the mode should become a persistent default across new rounds. This plan treats it as round setup, retained by the existing setup recovery/replay flow.

### Assumptions and open decisions

- **Assumption:** “vote in unison” means the group can see the same public ballot and make/announce choices together while the app records one named voter at a time. The current single-device UI cannot safely collect several independent simultaneous taps.
- **Open decision:** confirm whether the label should remain “Absolute Voting” or use a clearer secondary description such as “Open vote — no device handoff.” The proposed control label remains the user's requested name.
- **Open decision:** confirm whether the result-screen shortcut should be primary or secondary. Recommendation: secondary action beside Play again, because it changes the next round's voting privacy and should be intentional.

## 3. Current-state evidence ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | `GameSetupInput` currently carries role, hint, pack, and discussion settings but no voting-mode field (`src/domain/types.ts:75-85`). | Add `absoluteVotingEnabled: boolean` to the setup contract; update every fixture and setup consumer. |
| Confirmed | `GameState` snapshots round settings and owns `currentVoterIndex`, `votes`, and `voteResult` (`src/domain/types.ts:52-73`). | Copy the mode into `GameState` at round creation so UI and recovery do not depend on mutable lobby draft state. |
| Confirmed | `createRound()` copies setup settings into the round and initializes voting state (`src/domain/game.ts:65-117`). | Initialize the new flag here with no change to role assignment. |
| Confirmed | `startVoting()` resets the voter index and ballots; `recordVote()` validates the current voter, appends one `VoteRecord`, and transitions after the final voter (`src/domain/game.ts:161-199`). | Keep domain transitions unchanged except for any explicit mode metadata; the public/private distinction belongs to the UI/store presentation. |
| Confirmed | `VotingScreen` always renders `PassDeviceMask` until `isVoteReady`, then renders one ballot for `currentVoterIndex` (`src/features/game/VotingScreen.tsx:1-27`). | Branch only the pre-ballot presentation: absolute mode starts ready/public; private mode keeps the current mask. |
| Confirmed | `GameStoreState` exposes `beginVoting`, `showVote`, `castVote`, and `confirmVote`; the transient pending vote is deliberately cleared after hydration and confirmation (`src/store/gameStore.ts:99-128`, `src/store/gameStore.ts:187-214`, `src/store/gameStore.ts:323-345`). | Absolute mode must still use the same pending/confirm lifecycle so a refresh cannot expose an unfinished choice. |
| Confirmed | Lobby draft/submit owns round controls and constructs `GameSetupInput` (`src/features/game/LobbyScreen.tsx:10-74`, controls at `:86-94`). | Add the toggle to `LobbyDraft`, draft restoration, submit payload, and the rules UI. |
| Confirmed | `GameOverScreen` currently exposes `playAgain`, `Change category`, and `Return to lobby` (`src/features/game/GameOverScreen.tsx:10-71`). | Add a separate next-round action that explicitly overrides the next setup's mode; do not modify completed `game`. |
| Confirmed | Store `playAgain()` rebuilds a round from stored setup and increments the round (`src/store/gameStore.ts:278-296`). | Extend the action with an optional mode override or add a dedicated `playAgainWithAbsoluteVoting()` action, with the latter making intent clearer at the UI boundary. |
| Confirmed | Existing tests cover private vote handoff, vote-domain rules, replay, hydration masking, and full UI flow (`src/store/gameStore.test.ts:41-59`, `src/domain/game.test.ts:283-331`, `src/features/game/GameFlow.test.tsx`). | Add both mode-specific coverage and regression assertions that private voting remains unchanged. |
| Confirmed | The project is offline-first and local-only; `README.md` describes voting as a private pass-device step and the Zustand game store persists recovery. | Update user-facing documentation and migration notes; no network/security integration is needed. |
| Confirmed | Read-only baseline on 2026-11-03: `npm run test:run -- --reporter=dot` passed 9 files/81 tests; `npm run lint` passed; `npm run build` passed. | Implementation should preserve this green baseline and add focused checks. |
| Unverified | No Playwright run was performed during this planning pass. | The no-handoff interaction and responsive result action still require E2E verification during implementation. |

## 4. End-to-end impact and consumer map

```text
Lobby toggle / Game Over shortcut
        ↓
GameSetupInput.absoluteVotingEnabled
        ↓ createRound / playAgain override
GameState.absoluteVotingEnabled
        ↓
App → VotingScreen
        ├─ false: PassDeviceMask → showVote → ballot → confirmVote
        └─ true: public ballot immediately → ballot → confirmVote
        ↓
recordVote → VoteRecord[] → calculateVoteResult
        ↓
OUTLIER_GUESS (still private, if enabled) → GAME_OVER
```

| Consumer/boundary | Change required |
|---|---|
| Domain types/factory | Add and copy the mode flag; validation should require a boolean with a safe false default only at persistence normalization. |
| Lobby draft and UI | Add a controlled toggle with explanatory copy; preserve it when navigating to custom packs and when returning to setup. |
| Game store | Initialize/reset transient voting state as today; start absolute rounds with `isVoteReady` true or make the screen derive readiness from mode. Preserve the pending-vote privacy reset on hydration. |
| Voting screen | Hide the pass mask only in absolute mode; keep the same candidate list, skip button, selection, lock-in, and accessible pressed states. Clearly announce that votes are public. |
| Game Over screen | Add a next-round shortcut that calls the explicit absolute replay action. Keep normal Play again behavior unchanged. |
| Persistence/migration | Bump the game-store persistence version; default missing setup/round flags to `false` so existing saved games remain private. Validate the flag on current round hydration. |
| Tests | Update all `GameSetupInput` fixtures and add domain, store, component/flow, persistence, and shortcut coverage. |
| Docs/release | Update README flow from “always pass for voting” to describe both modes and the result-screen shortcut. |
| Auth/security/audit/ops | No applicable backend, auth, audit, job, or operational boundary exists. Privacy is a UI/state invariant only. |

## 5. Conflicts, invariants, risks, and design options

### Invariants to preserve

- A voter cannot vote for themselves, even in public mode.
- Every player contributes exactly one record, including a skip (`targetId: null`).
- A unique highest count eliminates one player; ties and all-skipped ballots eliminate nobody.
- The final vote still stores `VoteResult` before the optional private Outlier guess.
- Refresh/hydration never restores a pending or visible ballot choice.
- Public voting must not expose roles, the secret word, or the Outlier's guess screen early.

### Main risks

- The phrase “in unison” can imply simultaneous independent input, which this one-device app cannot robustly collect. The selected design must label the mode as public/open and explain the interaction.
- If absolute mode is represented only in the lobby draft, replay and refresh can silently revert to private voting. It must be copied into both setup and round state.
- A Game Over shortcut that mutates the completed round could corrupt displayed results or Outlier outcomes. It must create a fresh round through the existing replay path.
- A boolean added without migration defaults could cause old persisted rounds to be rejected or render a misleading mode. Missing data must normalize to `false`.

### Feasible designs

1. **Public sequential ballot over existing records — recommended.** Skip the mask, keep `currentVoterIndex`, and show a public “Voter X · open ballot” screen. Lowest risk, exact compatibility, still records named votes and enforces current rules. It is not technically simultaneous input.
2. **Aggregate simultaneous vote entry.** Show all candidates and let a host enter vote counts. Better matches “in unison,” but loses voter identity, cannot enforce self-vote prevention, complicates skips and validation, and requires a new aggregate ballot contract. Not recommended for this request.
3. **Separate controls per player on one screen.** Render one control per player and collect a multi-selection. This is ambiguous on touch devices, permits accidental overwrites, creates privacy/identity problems, and still needs a confirmation protocol. Not recommended.

## 6. Recommended architecture, data flow, security, and error behavior

### Contract shape

Add `absoluteVotingEnabled: boolean` to both `GameSetupInput` and `GameState`. Keep `VoteRecord` unchanged. The setting is a round behavior flag, not a player attribute and not a global preference.

### UI behavior

- Lobby: add a switch labeled **Absolute Voting** with helper text such as “Vote openly together; skip the pass-device screen.” Default off.
- Private mode: preserve the existing `PassDeviceMask` and `I’m {name}` action exactly.
- Absolute mode: show a non-secret voting screen immediately. The screen should identify the current voter and say “Open ballot — everyone can see this choice.” Reuse the existing candidate grid, skip option, disabled-until-selection lock-in, and confirmation action.
- Game Over: add **Absolute Voting** as a deliberate next-round shortcut. It should begin a fresh role reveal round using the existing setup and `absoluteVotingEnabled: true`; the result currently on screen remains immutable.
- Outlier: no change. The Outlier still receives the existing private handoff after the final vote.

### Store/domain flow

1. `LobbyScreen` builds the new field in `GameSetupInput`.
2. `createRound()` copies it to `GameState`.
3. `beginVoting()` resets votes and pending state as today.
4. `VotingScreen` derives whether to call `showVote()` from the round flag, or the store initializes `isVoteReady` to true for absolute mode. The UI must not write a ballot before a user selects and confirms it.
5. `recordVote()` remains the sole domain transition for each recorded vote.
6. `playAgain()` remains the normal replay; a new explicit action or optional parameter starts the next round with the override.

### Security/privacy and errors

There is no authentication or server boundary. The relevant security invariant is accidental secret exposure: absolute voting may expose votes by design, but it must not expose roles, the word, pending unconfirmed votes after refresh, or Outlier input. Invalid persisted/malformed mode values should normalize to `false` and preserve the existing recoverable round when possible. Existing invalid-target and self-vote errors remain unchanged.

## 7. Contract, schema, migration, and compatibility changes

| Area | Planned change | Compatibility rule |
|---|---|---|
| `GameSetupInput` | Add required `absoluteVotingEnabled: boolean`. | All source fixtures and setup constructors provide `false` unless explicitly enabled. |
| `GameState` | Add copied `absoluteVotingEnabled: boolean`. | `createRound()` always writes it; old persisted rounds hydrate with `false`. |
| Store persistence | Increment version from `2` to `3`; extend `normalizePersistedSetup()` and migration/merge to default a missing or non-boolean flag to `false`. | Existing rounds remain private and playable. |
| Replay action | Add a clear absolute-replay action or `playAgain({ absoluteVotingEnabled?: boolean })`. | Existing Play again preserves the stored mode; only the new shortcut overrides it. |
| Vote contract | No change to `VoteRecord`, `VoteResult`, or `calculateVoteResult()`. | Existing consumers and result semantics remain valid. |
| Preferences | No change in the first implementation. | If a future request asks for a cross-round default, add a separate versioned preference deliberately. |

## 8. Ordered implementation phases with exact owners

### Phase 1 — Domain and persistence contract

**Owners:** `src/domain/types.ts`, `src/domain/game.ts`, `src/store/gameStore.ts`  

- Add the boolean to setup and round types and copy it in `createRound()`.
- Make persistence normalization/migration default old or malformed values to `false`.
- Keep the recoverability checks and privacy-clearing behavior explicit for both modes.
- Add/adjust domain and store fixtures first so compilation exposes every consumer.

### Phase 2 — Lobby and public voting UI

**Owners:** `src/features/game/LobbyScreen.tsx`, `src/features/game/VotingScreen.tsx`, `src/styles.css`  

- Add the lobby switch and helper copy.
- Implement the absolute-mode public ballot branch without changing candidate filtering or lock-in rules.
- Ensure private mode renders the existing mask and wording unchanged.
- Add responsive styles for the open-vote status/copy and preserve keyboard/focus/aria behavior.

### Phase 3 — Result shortcut and replay semantics

**Owners:** `src/features/game/GameOverScreen.tsx`, `src/store/gameStore.ts`, `src/App.tsx` only if callback plumbing is needed  

- Add the **Absolute Voting** result action.
- Start a new round via the existing replay path with an explicit mode override.
- Verify round number, word selection, role reassignment, setup retention, and completed-result immutability.

### Phase 4 — Tests and documentation

**Owners:** `src/domain/game.test.ts`, `src/store/gameStore.test.ts`, `src/features/game/GameFlow.test.tsx`, `README.md`  

- Add focused tests from the verification matrix below.
- Update README step 5 and the architecture/privacy notes to describe private and Absolute Voting.
- Run lint, unit/component tests, build, and Playwright E2E after implementation.

## 9. Verification matrix and acceptance criteria

| Scenario | Verification | Acceptance criteria |
|---|---|---|
| Default setup | Lobby component test | Absolute Voting is off by default; submitted setup contains `false`. |
| Enable in setup | Lobby/component test | Toggle persists through pack-manager navigation and starts a round with the flag true. |
| Private regression | Existing full flow + store test | Private mode still shows `Pass to {name}`, masks pending votes, and completes the existing 3-player journey. |
| Public ballot | Component/flow test | Absolute mode skips the pass mask, shows an explicit public/open-vote label, and still requires a selected target/skip before lock-in. |
| Rules | Domain tests | Self-vote rejection, invalid target rejection, skip, tie, all-skip, and final-voter transitions are unchanged. |
| Outlier | Domain/store/flow test | Absolute voting is followed by the same private Outlier handoff and correct result timing. |
| Result shortcut | Component/store test | Clicking Absolute Voting on Game Over starts round N+1 with the same setup and flag true; the previous result does not change. |
| Normal replay | Store/component test | Play again retains the current mode rather than silently switching it. |
| Hydration | Store migration test | Version-2 setup/round data missing the new field defaults to private mode; pending selections remain cleared. |
| Accessibility/responsive | Component assertions plus browser QA | Public/private labels are discoverable, buttons remain keyboard reachable, and the result action/layout work at mobile and desktop widths. |
| Regression | `npm run test:run`, `npm run lint`, `npm run build`, `npm run e2e` | All pass; E2E covers both private and Absolute Voting paths. |

Acceptance is met only when the user can select Absolute Voting in setup, run a no-handoff public ballot with unchanged vote rules, and use the result-screen shortcut for the next round without exposing secret role/word state or breaking recovery.

## 10. Rollout, rollback, observability, cleanup, and unverified boundaries

### Rollout

Ship as a local/offline UI feature with the default off. No feature flag service or backend rollout is needed. Existing persisted rounds migrate conservatively to private voting.

### Rollback

If public-mode behavior is unsafe or confusing, remove the new UI entry points and keep the migration default false. Existing data remains compatible because the new field is additive and false is the legacy behavior. Do not roll back by deleting local storage or resetting active rounds.

### Observability

There is no remote telemetry by design. Verification is local test coverage plus manual/E2E checks. Any future analytics would require an explicit privacy decision because gameplay data currently stays on-device.

### Cleanup

After implementation, remove no existing vote fields or private-flow code. Revisit the public sequential assumption only if product decides that true simultaneous input is required; that would be a separate feature with a new ballot model.

### Unverified boundaries

- Exact product meaning of “in unison” remains an open UX decision; this plan recommends public sequential recording on one shared device.
- The visual affordance and mobile layout of the new result action have not been browser-tested in this planning pass.
- Playwright/E2E was not run for the baseline, so the implementation must establish that baseline before claiming end-to-end compatibility.

