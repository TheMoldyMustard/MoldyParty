# Group Vote and Multi-Impostor Elimination — Feature Isolation Analysis

Date: 2026-11-03  
Scope assumption: “manual voting” means the private pass-device ballot. Clarified product rule: Group Vote is one collective ballot, not one voter at a time. That ballot selects one candidate when `impostorCount` is one, or the configured number of candidates when there are multiple impostors, and those selected candidates are voted out together. The private/manual ballot separately allows each voter to select the configured number of candidates. The persisted field remains `absoluteVotingEnabled` for compatibility.

## Executive verdict

The feature owner is the Impostor game flow. The prior Absolute Voting implementation changed presentation only; Group Vote now skips the handoff mask and records one collective selection. The private and group paths share the same result calculator, Outlier transition, and result screen, while their ballot input contracts differ.

The manual two-impostor defect is confirmed: `pendingVote` is a single `string | null | undefined`, `VoteRecord.targetId` is scalar, and `VotingScreen` renders one selected candidate. The current result contract is also single-elimination: `VoteResult.eliminatedPlayerId` is one ID or `null`.

Changing ties to eliminate both leaders and adding multi-impostor elimination are contract changes with wider coupling. Group Vote has a separate collective-ballot input path; private/manual voting has a bounded multi-target selection per voter. Recommendation: implement domain-owned `eliminatedPlayerIds`, with legacy `eliminatedPlayerId` retained as a compatibility alias. Do not implement by making React infer eliminations.

## Feature anatomy

Current flow:

```text
Lobby / Game Over shortcut
  → GameSetupInput.absoluteVotingEnabled
  → createRound() → GameState.absoluteVotingEnabled
  → beginVoting() → currentVoterIndex + votes[]
  → VotingScreen / PassDeviceMask
  → castVote(targetId | null) → pendingVote
  → confirmVote() → recordVote()
  → calculateVoteResult()
  → optional OUTLIER_GUESS
  → GameOverScreen
```

Group Vote is implemented as the required single collective ballot: it collects one shared selection of up to `impostorCount` candidates, calculates the result immediately, and does not advance through `currentVoterIndex`. The private/manual path collects one ballot per player and allows up to `impostorCount` distinct targets. The current game model now uses `impostorCount` for candidate selection and elimination as well as role assignment.

## Cascade map

| Edge | Provider → interface → consumer | Effect / risk | Confidence | Evidence | Disposition |
|---|---|---|---|---|---|
| AV-1 | `LobbyScreen` → `GameSetupInput.absoluteVotingEnabled` → `createRound` / store | Direct; mode is already round-scoped and persisted. | Confirmed | `src/features/game/LobbyScreen.tsx:10-131`; `src/domain/types.ts:76-85`; `src/domain/game.ts:65-110` | Preserve; no new setting needed for elimination rules. |
| AV-2 | `GameState.currentVoterIndex` + `votes` → `recordVote` → private voting UI | Stateful; private mode requires one ballot per player, with up to `impostorCount` distinct targets per ballot. | Confirmed | `src/domain/types.ts:67-74`; `src/domain/game.ts:175-200` | Extend the private ballot contract; retain voter identity and skip semantics. |
| AV-3 | `VotingScreen` → `pendingVote` scalar → `castVote` / `confirmVote` | Direct defect: private/manual mode only selects one candidate, regardless of `impostorCount`. | Confirmed | `src/features/game/VotingScreen.tsx:4-36`; `src/store/gameStore.ts:100-119,205-225` | Replace scalar pending state with a bounded distinct-selection list for private mode. |
| AV-4 | `VoteRecord.targetId` → `calculateVoteResult` → `VoteResult` | Contract boundary; current counting assumes one target per voter and returns one eliminable ID. Group Vote needs a separate collective selection contract. | Confirmed | `src/domain/types.ts:27-37`; `src/domain/game.ts:140-159` | Add a collective Group Vote ballot plus multi-target private records, then return `eliminatedPlayerIds`. |
| AV-5 | `impostorCount` → role assignment only | Dormant coupling: the configured count must become the absolute ballot selection limit and private ballot limit. | Confirmed | `src/domain/game.ts:78-100`; `src/domain/types.ts:56,78` | Make `impostorCount` an explicit voting rule input. |
| AV-6 | `VoteResult.isTie` + `eliminatedPlayerId` → `GameOverScreen` | Direct behavior conflict: ties currently eliminate nobody and display singular language/roster marking. | Confirmed | `src/features/game/GameOverScreen.tsx:13-35,51-58`; `src/domain/game.test.ts:267-280` | Update heading, verdict, roster, special-role calculation, and tests. |
| AV-7 | `VoteResult` → `calculateSpecialRoleOutcomes` | Transitive role-policy coupling: Jester currently wins only when its single ID equals `eliminatedPlayerId`. | Confirmed | `src/domain/game.ts:230-247`; `docs/feature-plans/2026-11-02-impostor-jester-outlier-roles.md:17,218` | Define whether Jester wins when included in a multi-elimination set; preserve Outlier independence. |
| AV-8 | persisted `GameState` → store `isValidVoteResult` / migration | Operational compatibility risk: old saved rounds contain a scalar result and may hydrate while new results need arrays. | Confirmed | `src/store/gameStore.ts:20-27,50-96,338-387` | Version/migrate or accept a backward-compatible result shape; test active-round recovery. |
| AV-9 | README/design/feature plan → user-visible rules and tests | Documentation currently asserts unique leader, tie = nobody, and unchanged tie semantics. | Confirmed | `README.md:40-42,68`; `docs/superpowers/specs/2026-11-02-moldyparty-design.md:46-48`; `docs/feature-plans/2026-11-03-absolute-voting.md:1-3,128` | Update after the rule contract is approved. |
| AV-10 | domain/component/store tests → acceptance behavior | Regression boundary; current suite encodes scalar votes and no-elimination ties. | Confirmed | `src/domain/game.test.ts:240-331`; `src/store/gameStore.test.ts`; `src/features/game/GameFlow.test.tsx:333-353` | Add two-impostor, tie, absolute, recovery, Jester, and UI coverage. |

## Isolation / disassembly plan

1. **Separate the two ballot contracts (AV-2, AV-3, AV-4, AV-5).** Group Vote is one collective ballot containing up to `impostorCount` distinct candidates; private/manual voting is one ballot per player containing up to `impostorCount` distinct candidates. The private ballot needs a list/set target contract, duplicate prevention, skip semantics, and an explicit selection limit UI. Group Vote should not use the current voter-index loop.
2. **Make the domain result authoritative (AV-4, AV-6).** Introduce plural eliminated IDs and define: an absolute ballot with fewer than the configured selections, private all-skipped ballots, exact ties at the cutoff, and ties among all top candidates. For the explicit request “a tie means both are voted out,” the tied candidates should be included in the eliminated set, not represented as `null`.
3. **Update policy consumers (AV-6, AV-7).** Render all eliminated players, pluralize result copy, and change Jester outcome logic to membership in the eliminated set. Outlier guessing remains after the final ballot and is unaffected by being eliminated.
4. **Migrate persisted rounds (AV-8).** Keep old scalar results readable, or migrate them to a one-element ID array. Clear transient pending selections as today. Validate every eliminated ID belongs to the round and is unique.
5. **Update user-facing contracts and tests (AV-9, AV-10).** Replace “unique vote leader” and “no one leaves after a tie.” Add focused domain tests first, then store hydration and full-flow tests, including two impostors in both private and absolute modes.

Validation per phase: `npm run test:run`, `npm run lint`, `npm run build`, then `npm run e2e`. Rollback is additive: retain the old result field during migration, default missing plural data to the legacy single result, and avoid deleting persisted rounds.

## Improvements

Required decoupling: represent elimination as a collection owned by the domain, not a UI-derived singular player. Keep ballot input and result output separate so the product can choose scalar nomination/top-N or multi-target nomination without changing `GameOverScreen` again.

Optional evidence-backed enhancements:

- Add a pure `getEliminatedPlayerIds(players, votes, impostorCount)` helper with explicit cutoff/tie tests.
- Show the configured elimination count in voting copy so “choose up to two” is not implicit.
- Use a shared candidate-selection component for private and absolute modes to prevent mode drift.
- Add a persisted-state fixture for an in-progress two-impostor ballot.

## Uncertainty and coverage boundary

- The collective Group Vote allows fewer than `impostorCount` selections at the domain boundary, although the UI requires at least one selection; whether the product should require exactly the configured count remains unspecified.
- “Tie means both are voted out” is clear for a two-player top tie, but ties that produce more candidates than `impostorCount` need an explicit cutoff rule.
- Jester semantics under multiple eliminations are not specified; current docs define only the unique-vote-out case.
- No additional dependency was found within the inspected scope. Coverage is limited to source, existing planning/design docs, README, and the passing unit/component suite; no browser E2E run was performed.
