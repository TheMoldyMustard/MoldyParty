# Group Vote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace sequential Absolute Voting with one collective Group Vote, allow private voters to select up to the configured impostor count, and eliminate all selected/tied players.

**Architecture:** Keep role assignment and the existing phase machine, but separate ballot input from result calculation. Private voting records a bounded list of targets per player; Group Vote records one collective list and completes immediately. `VoteResult` becomes plural and all result/special-role consumers read the eliminated set.

**Tech Stack:** React, TypeScript, Zustand, Vitest, Testing Library, Playwright.

**Spec:** `docs/feature-plans/2026-11-03-absolute-voting.md` plus the clarified Group Vote requirement in the active request.

## Global Constraints

- Group Vote is one collective ballot, not one voter at a time.
- Selection limit is `impostorCount` in both private and Group Vote modes.
- A tie votes out all tied leaders; ties must not produce “nobody voted out.”
- Preserve self-vote prevention, skips, Outlier timing, offline persistence, and private role/guess screens.
- Use the label **Group Vote** and explain the selection limit in the UI.

## Review Focus

- One-impostor Group Vote submits exactly one candidate and ends voting immediately; test in `GameFlow.test.tsx`.
- Two-impostor private voting permits two distinct targets but not a third or a self-vote; test in store/domain suites.
- Two-impostor Group Vote eliminates two selected candidates; test domain and full flow.
- A tie returns both tied candidates and renders both as voted out; test domain and result UI.
- Persisted in-progress legacy rounds remain recoverable; test store migration/merge behavior.

### Task 1: Domain ballot and result contracts

**Files:** `src/domain/types.ts`, `src/domain/game.ts`, `src/domain/game.test.ts`

- Add plural target data to `VoteRecord` and `VoteResult` while retaining a compatibility path for old persisted scalar records.
- Add pure validation/counting for target lists, enforce distinct targets and `impostorCount` limits, and reject self-votes.
- Make `calculateVoteResult()` return all selected/tied eliminations in `eliminatedPlayerIds`; preserve counts and top candidates.
- Make `recordVote()` accept a target list for private ballots and a collective Group Vote submission that completes without iterating every player.
- Add failing tests for one/two-impostor selections, Group Vote completion, multi-elimination, ties, skips, invalid counts, and Outlier transition; run them red before implementation, then green.

### Task 2: Store state and persistence

**Files:** `src/store/gameStore.ts`, `src/store/gameStore.test.ts`

- Change `pendingVote` to a bounded target-list state and add a Group Vote submission action/state as needed.
- Preserve private voter progression; Group Vote must bypass `currentVoterIndex` and submit once.
- Update hydration validation/migration to normalize legacy scalar `targetId` and `eliminatedPlayerId` into arrays, clear pending selections, and preserve old rounds.
- Add store tests for selection limits, Group Vote completion, replay mode, and legacy hydration.

### Task 3: Voting UI

**Files:** `src/features/game/VotingScreen.tsx`, `src/features/game/GameFlow.test.tsx`, `src/styles.css`

- Rename user-facing mode to Group Vote.
- In private mode, allow up to `game.impostorCount` candidates per voter, with selected-state toggling, a visible count, and lock-in disabled until a target or skip is chosen.
- In Group Vote mode, render one shared ballot with no voter identity/handoff loop, allow up to `game.impostorCount` candidates, and submit the collective ballot once.
- Keep self-vote prevention for private ballots; Group Vote has no individual voter, so all players are eligible candidates.
- Add component/flow coverage for one- and two-impostor private and Group Vote interactions.

### Task 4: Results, special roles, and documentation

**Files:** `src/features/game/GameOverScreen.tsx`, `src/domain/game.ts`, `src/features/game/GameFlow.test.tsx`, `README.md`, relevant feature plan/report

- Render all eliminated players and pluralized verdicts.
- Update Jester outcome logic to use membership in `eliminatedPlayerIds`; keep Outlier result timing unchanged.
- Replace tie copy with the new elimination behavior.
- Update README and planning/report language from Absolute Voting to Group Vote and document the selection limit.

### Task 5: Verification

- Run `npm run test:run`.
- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run e2e` after the production build.
- Inspect `git diff` and confirm no unrelated files changed.
