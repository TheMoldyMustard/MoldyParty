# Forehead Charades / Guess the Word Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline Forehead Charades game in which named players or teams take timed turns, mark words correct or passed with tap or optional tilt controls, review each turn, and reuse the same local word-pack library as Impostor—including custom packs containing 50 or more words.

**Architecture:** Keep Impostor's finite-state machine unchanged and add a separate pure Charades domain plus a separately persisted Zustand store. Extend the shared `WordPack` contract backward-compatibly so a pack may contain word-only items; Charades accepts every valid word, while Impostor continues to show only packs whose items all have usable hints. React screens render the Charades setup, handoff, active turn, round summary, and final scoreboard; sensor input is an optional adapter over the same `correct`/`pass` commands used by tap and keyboard controls.

**Tech Stack:** React 19, TypeScript, Zustand 5, Dexie 4 / IndexedDB, Vite 8 PWA, Vitest, Testing Library, Playwright mobile and desktop Chromium

**Spec:** The feature brief, decisions, contracts, and acceptance criteria are embedded in this document; there is no separate spec artifact.

## Global Constraints

- Planning only: this document is the only repository change authorized by the request.
- The app remains account-free, backend-free, installable, and playable offline after its first successful production load.
- Existing Impostor packs and saved Impostor sessions remain readable without data migration.
- A Charades custom pack has no application-level maximum and must comfortably support at least 50 unique words; the AI helper requests exactly 50 items.
- Existing Impostor packs are selectable in Charades without copying or transforming their stored records.
- Word-only Charades packs must not appear as valid choices in Impostor until every item has a usable hint.
- Default turn duration is 60 seconds; the setup supports 10–600 seconds per player/team.
- Correct-answer bonus and pass penalty are independently optional, default off, and allow 1–30 seconds when enabled.
- A correct answer scores one point; a pass scores zero points. Time changes never directly change score.
- Tap and keyboard controls always work. Tilt controls are progressive enhancement and may never be the only way to play.
- Do not store raw motion/orientation readings or transmit gameplay, pack, or sensor data.
- Existing minimum 48px targets, safe-area handling, focus visibility, and reduced-motion behavior remain intact.

## Review Focus

- A 50+ word bulk entry must remain responsive, preserve line-level validation, and reject blank/duplicate normalized words without losing the user's text (Task 4).
- Legacy packs with one `hint`, packs with `hints[]`, and new word-only packs must round-trip without silently inventing or dropping hints (Tasks 2–3).
- A sensor event and a tap arriving together must resolve only one word, and a held tilt must not repeatedly score until the phone returns to neutral (Tasks 9–10).
- Timer reconciliation must be correct across backgrounding, refresh, correct bonuses, pass penalties, and an event at or after the deadline (Tasks 6–7).
- A denied/unavailable orientation permission must leave visible tap controls usable and must not block a turn (Tasks 9–10).

---

## 1. Decision Summary and Feature Brief

### Recommended product behavior

Add a second launch card, **Forehead Charades**, beside Impostor. Setup asks for:

- participant type (`Players` or `Teams`) and at least two unique names;
- one shared built-in or custom pack;
- seconds per turn (default `60`, allowed `10–600`);
- optional correct-answer bonus (default disabled; `1–30` seconds when enabled);
- optional pass penalty (default disabled; `1–30` seconds when enabled); and
- optional tilt controls (default enabled, but used only after capability/permission checks).

The session flow is:

`SETUP → HANDOFF → ACTIVE_TURN → TURN_SUMMARY → HANDOFF (next participant) → … → FINAL_SCORE`

During `ACTIVE_TURN`, the current word fills the screen. Tapping the right zone, pressing `ArrowRight`, or tilting down marks it correct. Tapping the left zone, pressing `ArrowLeft`, or tilting up passes. Each accepted action records `{word, outcome, timeDeltaSeconds, occurredAtMs}`, advances to the next word, and uses a short input lock so two input sources cannot score the same word. The timer reaching zero ends the turn immediately. The summary lists correct and passed words, the turn score, and time adjustments, then explicitly hands the device to the next participant. After every participant has taken one turn, the final scoreboard ranks by correct answers and preserves ties.

### Word deck policy

Shuffle the selected pack into one session-level queue. Consume words without replacement across all participants for fairness. When every word has been consumed, reshuffle the full pack and continue, ensuring the immediately previous word is not first when the pack has more than one item. This makes existing 12-word built-ins playable while giving 50+ word custom packs substantially fewer repeats. Require at least two usable words to start.

### 50+ custom-pack behavior

Keep the existing row editor for hinted Impostor-compatible packs and add a Charades-focused bulk editor accepting one word per line. Show a live unique-word count, preserve the entered lines on validation failure, allow saving from two words upward, and recommend 50+ without imposing a hard maximum. The AI prompt helper gains a Charades mode that requests exactly 50 unique `{ "word": "…" }` items. Existing Impostor packs are immediately usable in Charades because Charades reads only `item.word`.

## 2. Scope, Non-goals, Permissions, and Assumptions

### In scope

- A second game entry point and complete pass-the-device Charades session.
- Player and team naming using the same runtime model, with copy adjusted by participant type.
- Configurable turn duration and independently toggled time bonus/penalty.
- Tap, keyboard, and optional tilt input.
- Shared local pack library, word-only pack compatibility, bulk 50+ entry, JSON import/export, and AI prompt mode.
- Refresh/background timer reconciliation, offline precaching, unit/component/E2E coverage, and README updates.

### Non-goals

- Speech recognition or automatic answer detection.
- Online multiplayer, accounts, cloud sync, remote AI calls, analytics, or leaderboards.
- Multiple rounds per participant, tournament brackets, team membership rosters, or per-team turn orders in this release.
- Editing built-in packs.
- User-configurable tilt thresholds or gesture remapping in the first version.
- Native-only APIs or a separate iOS/Android application.

### Permissions

- Orientation permission is requested only from the explicit **Start turn** gesture and only when the user enabled tilt controls.
- Denial, dismissal, unsupported hardware, insecure context, or sensor failure downgrades to tap/keyboard controls with a non-blocking status message.
- No pack or session data leaves the browser profile.

### Assumptions

- “Player/team” means the host chooses one label for a session; both use the same ordered participant model and each entry receives one turn.
- “50+” means the editor and persistence layer support at least 50 words comfortably, not that every pack must contain 50 words.
- Correct/pass time changes apply immediately to the current turn only. Bonus time may extend a turn beyond its original duration; penalty is floored at zero.
- The user wants Impostor-to-Charades reuse; Charades-only word packs are intentionally not eligible for Impostor until hints are added.
- A refreshed active turn reconciles against its persisted absolute deadline. If the deadline elapsed, it opens that participant's summary rather than silently starting a new turn.

## 3. Current-state Evidence Ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | `src/App.tsx` owns an in-memory `AppView = 'home' \| 'lobby' \| 'packs'` and routes directly from the Impostor store phase. | A second game needs explicit app-level routing and must not overload Impostor's phase union. |
| Confirmed | `src/domain/types.ts` defines `WordItem { word: string; hint: string; hints?: string[] }` and `WordPack.items: WordItem[]`. | Word-only Charades packs require a backward-compatible contract extension, while existing hinted records remain valid. |
| Confirmed | `src/features/packs/packDb.ts#createPackRepository` stores full `WordPack` records in one Dexie `packs` table keyed by `id`; repository operations are game-agnostic. | Both games can share one durable library without a second database or copied records. |
| Confirmed | `src/features/packs/packParser.ts#normalizeItems` currently rejects an item without `hint`/`hints`, enforces case-insensitive uniqueness, and has no maximum item count. | Capacity already exceeds 50, but parsing and UI must allow word-only items and retain strict duplicate/blank checks. |
| Confirmed | `src/features/packs/PackManager.tsx` uses one React row per word and an Impostor-specific hint field. | Entering 50 words row-by-row is avoidable friction; a bulk word editor is the appropriate Charades path. |
| Confirmed | `src/features/packs/aiPrompt.ts#buildAiPackPrompt` requests 25 items and exactly five hints per item. | Add a game-aware prompt contract; do not weaken the existing Impostor prompt. |
| Confirmed | `src/features/game/LobbyScreen.tsx` loads `[...builtInPacks, ...customPacks]` directly with no compatibility filter. | Before word-only records are saved, Impostor must filter packs through a shared eligibility function. |
| Confirmed | `src/store/gameStore.ts#createGameStore` persists Impostor setup/game under `moldyparty-game`, masks secrets on hydration, and owns discussion timer deadlines. | Charades should use a separate key and store so changes cannot corrupt Impostor recovery. The deadline pattern is reusable. |
| Confirmed | `src/styles.css` already enforces 48px buttons, safe-area insets, focus styles, `touch-action: none` on the reveal pad, and reduced-motion handling. | New full-screen controls should extend these tokens and interaction conventions instead of creating a second visual system. |
| Confirmed | `playwright.config.ts` runs desktop Chromium and Pixel 7 projects. | Tap flows and layout can be covered on both; real sensor behavior still needs device QA because Playwright does not validate physical orientation hardware. |
| Confirmed | `docs/superpowers/specs/2026-11-02-moldyparty-design.md` lists “Multiple game titles in the first release” as a non-goal. | This request intentionally supersedes that original release boundary; the living design document must be updated when the feature ships, while the original implementation plan remains historical. |
| Confirmed | Baseline on 2026-11-02: `npm run test:run` passed 57/57 tests, `npm run lint` passed, `npm run build` passed with 13 precached entries, and `npm run e2e` passed 4/4 tests. | Implementation starts from a clean verified baseline; regressions are attributable to the feature branch. |
| Inferred | No API, auth, server schema, event bus, or telemetry exists in the repository or declared dependencies. | Security and observability work is client-side validation, permission handling, recovery UI, and tests—not backend work. |
| Unverified | Orientation event sign/axis behavior varies with device, browser, portrait lock, and how the phone is held. | Ship fixed conservative defaults plus tap fallback, and require real iOS/Android device QA before calling tilt production-ready. |

## 4. End-to-end Impact and Consumer Map

| Producer / owner | Changed contract | Consumers that must change |
|---|---|---|
| `src/domain/types.ts` | `WordItem.hint` becomes optional; add shared `GameId`/pack-compatibility typing if needed. | `builtInPacks.ts`, `game.ts`, `packParser.ts`, `PackManager.tsx`, `LobbyScreen.tsx`, tests, Charades domain/setup. |
| `packParser.ts` | Canonical items may be `{word}` or `{word, hint}` / `{word, hints}`; serializer preserves the form. | Imports, manual/bulk saves, export, offline E2E, README schema examples. |
| New `packCompatibility.ts` | `getPackCompatibility(pack)` and `isPackUsableFor(pack, game)` are the only eligibility rules. | Impostor category picker, Charades pack picker, pack manager badges, validation tests. |
| `packDb.ts` | Storage remains table version 1; values become structurally broader but keys/indexes do not change. | No Dexie migration expected; repository tests must prove legacy/new records coexist. |
| `PackManager.tsx` / `AiPromptHelper.tsx` | Game-aware editor/prompt mode and 50+ bulk entry. | App pack routing from both setups and existing pack-manager tests. |
| New Charades domain | Setup/session state, queue shuffle, outcomes, score, summary, tie ranking. | Charades store and every Charades screen. |
| New Charades store | Commands and persisted recovery under `moldyparty-charades`. | App routing, timer hook, Charades screens, store/component/E2E tests. |
| New orientation adapter | Emits semantic `correct`/`pass` once per neutral-to-threshold gesture. | Active-turn screen only; domain/store remain sensor-agnostic. |
| `preferencesStore.ts` | Persist `activeGameId: GameId | null` with a version-2 migration. | App routing, both setup start actions, home/exit actions, and refresh recovery. |
| `App.tsx` | Home exposes two launch cards and a route for each setup/library context. | App shell tests, Impostor flow tests, E2E selectors, CSS layout. |
| `vite.config.ts` / service worker | No new runtime dependency; newly emitted chunks are precached by existing patterns. | Build verification and offline Charades E2E. |

## 5. Conflicts, Invariants, Risks, and Design Options

### Intentional invariants

- Impostor requires a usable hint for every selectable word.
- Packs remain local, editable, importable/exportable, and identified by stable IDs.
- Game rules live in pure functions; React issues commands and renders state.
- Pass-the-device transitions are explicit and no secret/private state is exposed during handoff.
- Timers use absolute deadlines for background/refresh correctness rather than decrement-only intervals.

### Avoidable friction to remove

- Fifty row components with hint inputs are an unsuitable primary path for a 50-word Charades deck.
- Requiring hints for Charades-only packs adds irrelevant work.
- Copying Impostor packs into a second store would create drift and duplicate delete/rename behavior.
- Direct sensor logic in the component or store would make scoring race-prone and difficult to test.

### Design options

#### Option A — Recommended: shared flexible pack, filtered eligibility, separate game store

Make hints optional at the shared item level, derive each pack's game compatibility, and keep one Dexie table. Add a separate Charades domain/store and consume the same pack object by ID/snapshot.

Tradeoffs: maximizes reuse and keeps game lifecycles isolated; requires careful filtering so a word-only pack never enters Impostor. A full rollback must retain the compatibility filter while word-only records may exist.

#### Option B — Keep hints mandatory for every custom Charades word

Reuse the current schema unchanged and require every new Charades word to include an Impostor hint.

Tradeoffs: simplest contract and safest rollback, but makes a 50+ word Charades deck needlessly expensive to create and does not match the requested fast custom-word workflow. Rejected.

#### Option C — Separate Charades pack table with “Import from Impostor” copies

Store word-only decks separately and copy words from selected Impostor packs.

Tradeoffs: avoids widening `WordItem`, but rename/delete/edit operations diverge and copied packs become stale. It explicitly loses the “same stored words” synergy. Rejected.

### Highest-impact risks and mitigations

1. **Input races:** funnel tap, keyboard, and tilt through one `submitOutcome(outcome, now)` action with a state/word token guard.
2. **Timer manipulation/errors:** compute remaining time from injected clock and persisted deadline; clamp penalties at zero; reject outcomes at/after expiry.
3. **Sensor variance:** calibrate relative to the starting pose, require dwell and neutral reset, expose status, and retain full tap controls.
4. **Pack compatibility regression:** centralize eligibility and test all legacy/new shapes; never duplicate ad hoc `hint` checks in screens.
5. **Large editor performance:** use one textarea, parse on submit or debounced count, and avoid rendering 50 controlled row pairs.
6. **Rollback with word-only records:** rollback Charades UI/store independently but retain the optional-hint parser/serializer and Impostor eligibility filter until records are migrated or deleted.

## 6. Recommended Architecture, Data Flow, Security, and Error Behavior

### Proposed Charades state

```ts
type CharadesPhase = 'SETUP' | 'HANDOFF' | 'ACTIVE_TURN' | 'TURN_SUMMARY' | 'FINAL_SCORE'
type CharadesOutcome = 'correct' | 'pass'
type ParticipantKind = 'player' | 'team'

interface CharadesSettings {
  participantKind: ParticipantKind
  participantNames: string[]
  pack: WordPack
  turnDurationSeconds: number
  correctBonusSeconds: number | null
  passPenaltySeconds: number | null
  tiltEnabled: boolean
}

interface CharadesTurnEvent {
  word: string
  outcome: CharadesOutcome
  timeDeltaSeconds: number
  occurredAtMs: number
}
```

`CharadesSession` additionally owns phase, ordered participants, current participant index, current word, current word token, remaining shuffled queue, completed queue cycles, active deadline, current events, and completed turn summaries. The persisted store keeps settings and session but not transient interval handles, input locks, sensor samples, or permission objects.

### Command/data flow

1. Setup loads the shared Dexie library and filters with `isPackUsableFor(pack, 'charades')`.
2. `startSession(settings)` validates names, numbers, and at least two usable words, snapshots the selected `WordPack`, shuffles its words with injected randomness, and enters `HANDOFF`.
3. **Start turn** optionally requests orientation permission, then `beginTurn(now)` sets the first word and `deadlineMs = now + turnDurationSeconds * 1000`.
4. Tap/keyboard/tilt call the same `submitOutcome(outcome, wordToken, now)` store action.
5. The action reconciles expiry, computes `+bonus`, `-penalty`, or `0`, records one event, updates deadline, and advances the queue.
6. A 250ms display/input guard prevents accidental double events; the token check is the authoritative race defense.
7. `syncTimer(now)` runs on a short visual interval and on `visibilitychange`, `pageshow`, focus, and hydration. Expiry enters `TURN_SUMMARY` exactly once.
8. Summary advances to the next `HANDOFF` or `FINAL_SCORE` after the last participant.

App-level recovery uses `preferencesStore.activeGameId`. Starting either game sets its ID before creating the session; exiting that game clears the ID. On first hydration from the existing version-1 preferences shape, a non-null persisted Impostor `game` with no active-game preference resumes as Impostor for backward compatibility. If both stores contain sessions, the explicit `activeGameId` wins; an ID that points to no active session returns to home rather than guessing or clearing either store.

### Error behavior

- Invalid setup stays on setup with field-level/summary errors and preserves draft values.
- A selected pack deleted before submit falls back to no selection and asks the user to choose again; it does not silently choose another pack.
- A pack with fewer than two unique usable words cannot start.
- Clipboard/import/database failures display a recoverable status and do not clear user input.
- Permission denial/unsupported sensors set tilt status to `unavailable` or `denied`, announce the fallback once, and continue with tap/keyboard.
- An outcome after expiry ends the turn without recording that word.
- A corrupted persisted Charades payload is discarded through a versioned migration/merge and returns to setup; it must not affect Impostor or packs.

### Security/privacy

- Treat imported JSON as data only; render words as React text and never inject HTML.
- Keep current JSON file acceptance and validation; optionally add a reasonable file-size guard only if repository conventions add one.
- Request sensor permission only in response to a user gesture and never persist sensor readings.
- No network call, remote AI invocation, analytics, or new permission appears in the manifest.

## 7. Contract, Schema, Migration, and Compatibility Changes

### Shared pack contract

Change `WordItem` to:

```ts
interface WordItem {
  word: string
  hint?: string
  hints?: string[]
}
```

Compatibility rules:

- Charades-compatible: at least two unique, nonblank `word` values.
- Impostor-compatible: Charades-compatible and every item has at least one nonblank normalized hint from `hints[]` or `hint`.
- Existing records need no Dexie migration because the table key/index shape is unchanged.
- Existing canonical JSON remains valid. New canonical word-only JSON uses `items: [{ "word": "Example" }]`.
- Fallback `{words, hints}` remains supported for Impostor-compatible imports; add `{words}` only if it maps unambiguously to word-only canonical items and is documented/tested.
- Serialization must omit `hint`/`hints` for a word-only item instead of emitting empty strings.

### Persisted Charades store

- New localStorage key: `moldyparty-charades`.
- Version: `1`.
- Persist settings draft and session snapshot; omit sensor status, interval state, and input lock.
- Hydration recalculates deadline status from `Date.now()` and normalizes the active screen to summary if expired.
- Impostor's `moldyparty-game` and preferences keys are unchanged.

### App routing preference migration

- Keep the existing `moldyparty-preferences` key and migrate its persisted version from `1` to `2`.
- Add `activeGameId: GameId | null`, default `null`.
- Preserve `defaultDiscussionSeconds` and `installPromptDismissed` exactly during migration.
- Existing saved Impostor games without this field resume through the explicit backward-compatibility fallback above.

### No dependency or backend migration

Use browser `DeviceOrientationEvent` feature detection and existing dependencies. Do not add a sensor library, backend schema, auth scope, service worker route, or IndexedDB table unless implementation evidence proves the native adapter insufficient.

## 8. File Ownership Map

### Create

- `src/features/packs/packCompatibility.ts` — centralized game eligibility.
- `src/features/packs/packCompatibility.test.ts` — legacy/new pack matrix.
- `src/features/packs/bulkWords.ts` and `.test.ts` — line parser/count/validation for 50+ entry.
- `src/features/charades/types.ts` — Charades-only contracts.
- `src/features/charades/domain.ts` and `.test.ts` — pure session, queue, scoring, ranking, and timer transitions.
- `src/store/charadesStore.ts` and `.test.ts` — commands, injected clock/randomness, persistence, hydration.
- `src/features/charades/CharadesSetupScreen.tsx`.
- `src/features/charades/CharadesHandoffScreen.tsx`.
- `src/features/charades/CharadesPlayScreen.tsx`.
- `src/features/charades/CharadesTurnSummaryScreen.tsx`.
- `src/features/charades/CharadesFinalScoreScreen.tsx`.
- `src/features/charades/orientationInput.ts` and `.test.ts` — permission/capability and gesture state machine.
- `src/features/charades/CharadesFlow.test.tsx`.
- `e2e/charades-flow.spec.ts`.

### Modify

- `src/domain/types.ts` — optional hint contract and shared game identifier if used.
- `src/domain/game.ts` / `.test.ts` — guard Impostor round creation against ineligible packs.
- `src/features/packs/packParser.ts` / `.test.ts` — word-only canonical parsing and lossless export.
- `src/features/packs/PackManager.tsx` / `.test.tsx` — game-aware editor, compatibility badges, bulk input.
- `src/features/packs/aiPrompt.ts` and `AiPromptHelper.tsx` / tests — Charades prompt mode with 50 words.
- `src/features/game/LobbyScreen.tsx` and `GameFlow.test.tsx` — filter Impostor packs.
- `src/store/preferencesStore.ts` and a new focused test file if required — active-game routing preference and version migration.
- `src/App.tsx` / `App.test.tsx` — second card and route orchestration.
- `src/styles.css` — two-card home, setup, full-screen play zones, summaries, mobile/safe-area states.
- `e2e/offline.spec.ts` — shared word-only pack persistence/offline use.
- `README.md` — game flow, controls, schema, settings, permissions, offline recovery.
- `docs/superpowers/specs/2026-11-02-moldyparty-design.md` — supersede the original single-game non-goal and document the shared-pack/multi-game boundary; leave the historical implementation plan unchanged.

## 9. Ordered Implementation Phases

### Task 1: Lock shared game and pack compatibility contracts

**Files:** Modify `src/domain/types.ts`; create `src/features/packs/packCompatibility.ts` and `src/features/packs/packCompatibility.test.ts`.

**Interfaces:** Produce `type GameId = 'impostor' | 'charades'`, `getUsableHints(item: WordItem): string[]`, `isPackUsableFor(pack: WordPack, game: GameId): boolean`, and an optional display helper returning compatibility badges.

- [ ] **Step 1:** Write failing tests proving legacy single-hint and `hints[]` packs support both games, word-only packs support only Charades, blank/duplicate words fail both, and a one-word pack fails Charades.
- [ ] **Step 2:** Run `npm run test:run -- src/features/packs/packCompatibility.test.ts`; expect failure because the module/types do not exist.
- [ ] **Step 3:** Make `WordItem.hint` optional and implement normalization/eligibility in one module; do not change built-in records.
- [ ] **Step 4:** Run the focused test plus `npm run test:run -- src/domain/game.test.ts`; expect both to pass or expose compile sites that assumed `hint` was required.
- [ ] **Step 5:** Commit the independently reviewable compatibility contract with message `feat: define shared pack compatibility`.

### Task 2: Protect Impostor from word-only packs

**Files:** Modify `src/domain/game.ts`, `src/domain/game.test.ts`, `src/features/game/LobbyScreen.tsx`, and `src/features/game/GameFlow.test.tsx`.

**Interfaces:** `validateSetup(input)` returns a useful error when `input.pack` is not Impostor-compatible; Lobby derives `impostorPacks = packs.filter(isPackUsableFor(...))`.

- [ ] **Step 1:** Add failing domain tests for a word-only pack and a mixed hinted/word-only pack; assert no round is created.
- [ ] **Step 2:** Add a failing component test with a word-only custom pack; assert it is not offered in the Impostor category picker.
- [ ] **Step 3:** Run both focused suites and confirm the new expectations fail against current direct pack use.
- [ ] **Step 4:** Add the centralized validation/filter without duplicating hint checks in the component.
- [ ] **Step 5:** Run `npm run test:run -- src/domain/game.test.ts src/features/game/GameFlow.test.tsx`; expect PASS, then commit `fix: filter packs incompatible with impostor`.

### Task 3: Extend JSON parsing and export without breaking legacy packs

**Files:** Modify `src/features/packs/packParser.ts` and `src/features/packs/packParser.test.ts`.

**Interfaces:** Preserve `parseWordPackJson(text): ParseResult` and `serializeWordPack(pack): string`; extend canonical items to allow `{word}` and preserve optional hints on export.

- [ ] **Step 1:** Add failing tests for 50 word-only canonical items, mixed invalid empty hints, duplicate normalization, legacy fallback arrays, and word-only round-trip serialization.
- [ ] **Step 2:** Run `npm run test:run -- src/features/packs/packParser.test.ts`; expect failures only in new word-only cases.
- [ ] **Step 3:** Refactor `normalizeItems` to validate the word first, normalize only supplied hints, and reject supplied-but-empty hint containers while allowing omitted hints.
- [ ] **Step 4:** Update serialization to omit absent hints and prove existing one-hint/five-hint output remains byte-shape compatible.
- [ ] **Step 5:** Run parser and repository suites; expect PASS, then commit `feat: support word-only shared packs`.

### Task 4: Add performant 50+ bulk-word authoring

**Files:** Create `src/features/packs/bulkWords.ts` and `.test.ts`; modify `PackManager.tsx` and `PackManager.test.tsx`.

**Interfaces:** Produce `parseBulkWords(text): { items: WordItem[]; errors: BulkWordError[] }`; add `purpose: GameId` to `PackManagerProps` with backward-compatible default `'impostor'` if needed during transition.

- [ ] **Step 1:** Write parser tests for CRLF/LF input, trimmed lines, blank lines, case-insensitive duplicates with line numbers, Unicode words, and 60 valid lines.
- [ ] **Step 2:** Write component tests asserting live count, preserved text on error, save of 50 word-only items, edit-in-place ID preservation, and “50+ recommended” copy without a hard limit.
- [ ] **Step 3:** Run the two focused suites and confirm missing bulk-editor failures.
- [ ] **Step 4:** Implement a Charades tab/mode using one textarea; parse on count/update efficiently and reuse `repository.put` for persistence.
- [ ] **Step 5:** Keep the current hinted row editor available for Impostor-compatible packs and allow a word-only pack to be upgraded by adding hints later.
- [ ] **Step 6:** Run focused tests and a component performance sanity check with 200 lines; expect no per-word controlled input rows, then commit `feat: add bulk charades pack editor`.

### Task 5: Make the AI prompt helper game-aware

**Files:** Modify `src/features/packs/aiPrompt.ts`, `AiPromptHelper.tsx`, and `AiPromptHelper.test.tsx`.

**Interfaces:** Replace or overload `buildAiPackPrompt(topic, game: GameId): string`; Impostor output remains 25 items with five hints, Charades output requests exactly 50 unique word-only items.

- [ ] **Step 1:** Add failing prompt tests for both modes, exact item counts in instructions, canonical JSON shapes, no markdown, and topic fallback.
- [ ] **Step 2:** Add a failing component test showing the active game purpose controls copied text.
- [ ] **Step 3:** Run the focused suite and verify the Charades case fails while existing Impostor assertions remain meaningful.
- [ ] **Step 4:** Implement game-specific prompt builders behind one UI, retaining clipboard status/error handling.
- [ ] **Step 5:** Run the focused and full suites; expect PASS, then commit `feat: generate fifty-word charades prompts`.

### Task 6: Define pure Charades setup, queue, scoring, and ranking rules

**Files:** Create `src/features/charades/types.ts`, `domain.ts`, and `domain.test.ts`.

**Interfaces:** Produce `validateCharadesSettings(settings): string[]`, `createCharadesSession(settings, random): CharadesSession`, `beginCharadesTurn(session, now): CharadesSession`, `applyCharadesOutcome(session, outcome, token, now, random): CharadesSession`, `finishCharadesTurn(session, now): CharadesSession`, `advanceAfterSummary(session): CharadesSession`, and `rankParticipants(summaries): RankedParticipant[]`.

- [ ] **Step 1:** Write failing validation tests for two unique names, participant labels, duration bounds, modifier bounds/null state, and at least two compatible words.
- [ ] **Step 2:** Write failing deterministic queue tests for shuffle, no replacement across participants, refill after exhaustion, and no immediate repeat for packs larger than one.
- [ ] **Step 3:** Write failing outcome tests for `+bonus`, `-penalty`, floor at zero, one point only for correct, stale token rejection, and event rejection at/after deadline.
- [ ] **Step 4:** Write failing flow/ranking tests covering every phase, all participants taking one turn, stable tied ranks, and replay setup preservation.
- [ ] **Step 5:** Run the focused suite and confirm module-not-found failures.
- [ ] **Step 6:** Implement immutable pure transitions with injected clock values/randomness and no browser/React imports.
- [ ] **Step 7:** Run the focused suite; expect PASS, then commit `feat: add pure charades game rules`.

### Task 7: Add isolated Charades persistence and deadline recovery

**Files:** Create `src/store/charadesStore.ts` and `src/store/charadesStore.test.ts`.

**Interfaces:** Produce `createCharadesStore(storageName?, random?, storage?, clock?)`, `useCharadesStore(selector)`, and actions `saveDraft`, `startSession`, `beginTurn`, `submitOutcome`, `syncTimer`, `finishTurn`, `continueFromSummary`, `playAgain`, and `returnToSetup`.

- [ ] **Step 1:** Write failing store tests for setup→handoff→active→summary→next participant→final transitions using injected clock/randomness.
- [ ] **Step 2:** Add failing tests proving tap/tilt-equivalent calls with the same word token record one event, and calls after expiry record none.
- [ ] **Step 3:** Add failing persistence tests for separate key/version, active deadline hydration, expired hydration to summary, corrupted payload fallback, and no interaction with `moldyparty-game`.
- [ ] **Step 4:** Run the focused suite and confirm missing-store failures.
- [ ] **Step 5:** Implement a versioned persisted slice that omits transient sensor/input state and reconciles with the injected clock on merge/hydration.
- [ ] **Step 6:** Run store plus existing Impostor store tests; expect PASS, then commit `feat: persist charades sessions safely`.

### Task 8: Build Charades setup and pack-library routing

**Files:** Create `CharadesSetupScreen.tsx`; modify `src/App.tsx`, `App.test.tsx`, `PackManager.tsx`, `src/store/preferencesStore.ts`, its tests, and `src/styles.css`.

**Interfaces:** App routes `home`, `impostor-setup`, `charades-setup`, and `packs` with a remembered pack-library return context; setup consumes Charades store draft/actions and shared pack repository.

- [ ] **Step 1:** Add failing app-shell tests for two launch cards with unique accessible headings/actions.
- [ ] **Step 2:** Add failing setup tests for player/team labels, name editing, duration, independent modifier toggles, tilt toggle, compatible pack selection, and validation preservation.
- [ ] **Step 3:** Add failing preference/navigation tests proving version-1 preferences migrate without data loss, starting either game sets `activeGameId`, and Charades setup → pack manager → back returns to Charades with the draft intact.
- [ ] **Step 4:** Run the focused component tests and confirm missing route/screen failures.
- [ ] **Step 5:** Implement the setup, version-2 active-game preference, and explicit return context; do not reuse Impostor's `LobbyDraft` or mutate the other game's store state.
- [ ] **Step 6:** Extend the existing card/layout styles responsively and run App/Impostor/PackManager tests; expect PASS, then commit `feat: add charades setup entry point`.

### Task 9: Implement and test the orientation gesture adapter

**Files:** Create `src/features/charades/orientationInput.ts` and `.test.ts`.

**Interfaces:** Produce `requestOrientationPermission(): Promise<OrientationPermissionStatus>` and a pure `createTiltRecognizer(config)` that accepts relative samples and emits at most one semantic outcome until neutral reset.

Default recognizer constants: threshold `25°`, neutral band `12°`, dwell `200ms`; down emits `correct`, up emits `pass`. Calibration uses the first stable sample after the active screen begins.

- [ ] **Step 1:** Write failing permission tests for unsupported API, no permission method, granted, denied, rejected promise, and secure-context limitations represented by adapter inputs.
- [ ] **Step 2:** Write failing recognizer tests for calibration, noisy sub-threshold motion, threshold+dwell, correct/pass direction, held-tilt suppression, neutral re-arm, and cleanup.
- [ ] **Step 3:** Run the focused suite and confirm missing-adapter failures.
- [ ] **Step 4:** Implement the browser boundary behind injectable functions/types so tests do not depend on jsdom sensor support.
- [ ] **Step 5:** Run the focused suite; expect PASS, then commit `feat: add optional tilt recognition`.

### Task 10: Build handoff and active-turn controls

**Files:** Create `CharadesHandoffScreen.tsx`, `CharadesPlayScreen.tsx`, and extend `CharadesFlow.test.tsx` / `src/styles.css`.

**Interfaces:** Handoff requests permission from **Start turn** when appropriate. Play screen maps right tap/`ArrowRight`/tilt-down to `correct` and left tap/`ArrowLeft`/tilt-up to `pass`, passing the visible word token to the store.

- [ ] **Step 1:** Write failing interaction tests for handoff copy using player/team labels, permission granted/denied/unavailable, and turn start regardless of sensor outcome.
- [ ] **Step 2:** Write failing tests for left/right tap zones, keyboard arrows, visible word advancement, correct/pass counts, and accessible control names.
- [ ] **Step 3:** Add a failing race test dispatching two inputs for one token; assert one event and one word advance.
- [ ] **Step 4:** Add a failing cleanup test proving orientation listeners are removed on summary/unmount and no further event is recorded.
- [ ] **Step 5:** Implement the full-screen play surface, persistent tap affordances, tilt status, timer visual, safe-area layout, and reduced-motion behavior.
- [ ] **Step 6:** Run Charades flow and existing game flow tests; expect PASS, then commit `feat: add charades handoff and play controls`.

### Task 11: Reconcile the visual timer across background and lifecycle events

**Files:** Modify `CharadesPlayScreen.tsx`, `charadesStore.ts`, their tests, and optionally create a focused `useCharadesTimer.ts` only if it clarifies ownership.

**Interfaces:** UI calls `syncTimer()` on a visual interval and on `visibilitychange`, `pageshow`, and window focus; store/domain remains authoritative for expiry.

- [ ] **Step 1:** Add fake-timer tests for second-boundary display, bonus extension, penalty expiry, background elapsed time, and exactly-once summary transition.
- [ ] **Step 2:** Add a failing component test ensuring the timer is not announced to assistive technology every second while final expiry is announced.
- [ ] **Step 3:** Run focused tests and confirm lifecycle reconciliation gaps.
- [ ] **Step 4:** Implement lifecycle listeners with cleanup and derive display from deadline rather than trusting interval tick counts.
- [ ] **Step 5:** Run store/flow tests; expect PASS, then commit `fix: reconcile charades turn deadlines`.

### Task 12: Build turn summary, next handoff, and final scoreboard

**Files:** Create `CharadesTurnSummaryScreen.tsx`, `CharadesFinalScoreScreen.tsx`, and extend `CharadesFlow.test.tsx` / `src/styles.css`.

**Interfaces:** Summary consumes immutable turn events and exposes only `continueFromSummary`; final score consumes ranked summaries and exposes `playAgain`, `changeSettings`, and `returnHome` routing callbacks.

- [ ] **Step 1:** Write failing summary tests for separated correct/pass lists, empty lists, score, `+N`/`−N` time annotations, and next participant copy.
- [ ] **Step 2:** Write failing final tests for ranking, ties, player/team terminology, total correct/pass counts, and every navigation action.
- [ ] **Step 3:** Run focused tests and confirm missing-screen failures.
- [ ] **Step 4:** Implement semantic lists/tables and explicit pass-device actions; never auto-start the next turn.
- [ ] **Step 5:** Run Charades flow tests; expect PASS, then commit `feat: add charades summaries and scoreboard`.

### Task 13: Complete app orchestration and regression coverage

**Files:** Modify `src/App.tsx`, `App.test.tsx`, `GameFlow.test.tsx`, and `styles.css`.

**Interfaces:** `AppContent` renders exactly one active game phase, preserves each game's setup independently, and returns home without deleting saved packs.

- [ ] **Step 1:** Add a failing integration test completing a two-participant session through final score using taps only.
- [ ] **Step 2:** Add failing regression tests proving a legacy in-progress Impostor game resumes when no active-game preference exists, explicit `activeGameId` wins when both sessions exist, and an ID with no matching session returns home without clearing either store.
- [ ] **Step 3:** Run App, Impostor, and Charades component suites and confirm orchestration failures.
- [ ] **Step 4:** Refactor route selection into a small explicit owner if `App.tsx` becomes ambiguous; avoid merging the two game phase unions.
- [ ] **Step 5:** Run all unit/component tests; expect PASS, then commit `feat: integrate forehead charades`.

### Task 14: Add mobile, offline, and pack-sharing end-to-end journeys

**Files:** Create `e2e/charades-flow.spec.ts`; modify `e2e/offline.spec.ts` and possibly `playwright.config.ts` only for deterministic permission stubs.

**Interfaces:** Verify the shipped production build using tap controls; sensor gesture correctness remains unit-tested and physically QA'd.

- [ ] **Step 1:** Add an E2E journey that creates/imports a 50-word word-only pack, selects it in Charades, completes two timed turns with correct/pass taps, reviews summaries, and reaches final score.
- [ ] **Step 2:** Assert the same word-only pack is absent from Impostor selection while a legacy hinted Impostor pack is present in both games.
- [ ] **Step 3:** Add an offline reload journey proving the shared pack and Charades setup/session remain usable from the service worker cache.
- [ ] **Step 4:** Run `npm run build && npm run e2e`; expect all desktop/mobile Chromium projects to pass.
- [ ] **Step 5:** Commit `test: cover charades mobile and offline flows`.

### Task 15: Document, verify, and prepare rollout

**Files:** Modify `README.md` and `docs/superpowers/specs/2026-11-02-moldyparty-design.md`; verify generated build artifacts without committing `dist/`.

**Interfaces:** Documentation describes both games, shared/word-only schemas, 50+ authoring, settings, tap/keyboard/tilt controls, sensor fallback, recovery, and local-data limitations.

- [ ] **Step 1:** Update README examples for hinted and word-only canonical packs and explain that word-only packs are Charades-only until hints are added.
- [ ] **Step 2:** Document exact settings bounds/defaults, session flow, tilt permission/fallback, and the recommendation of 50+ words.
- [ ] **Step 3:** Update the living design document to replace the single-game non-goal with the shared-pack, isolated-game-state architecture; do not rewrite the historical implementation plan.
- [ ] **Step 4:** Run `npm run lint`; expect exit code 0 with no warnings.
- [ ] **Step 5:** Run `npm run test:run`; expect all old and new tests to pass.
- [ ] **Step 6:** Run `npm run build`; inspect `dist/manifest.webmanifest` and generated service worker output, expecting the existing install metadata and new chunks in precache.
- [ ] **Step 7:** Run `npm run e2e`; expect desktop and mobile projects to pass.
- [ ] **Step 8:** Perform the real-device matrix in Section 11, record results in the pull request/release notes, then commit `docs: explain forehead charades`.

## 10. Verification Matrix and Acceptance Criteria

| Requirement | Automated evidence | Acceptance criterion |
|---|---|---|
| Shared existing Impostor packs | Compatibility unit test + Charades setup component/E2E | Every current built-in/custom hinted pack is selectable without creating a copy. |
| 50+ custom words | Bulk parser/component test at 50 and 200 lines + E2E at 50 | Save, edit, export, reload, and select 50+ unique words; no hard maximum is imposed. |
| Impostor safety | Domain/component compatibility tests | Word-only packs never appear/select in Impostor and cannot create an Impostor round. |
| Per player/team timing | Domain/store/component tests | Each named entry receives one turn using the configured 10–600 second base duration. |
| Optional correct bonus | Domain fake-clock test | Disabled produces `0`; enabled adds configured seconds and records the delta. |
| Optional pass penalty | Domain fake-clock test | Disabled produces `0`; enabled subtracts configured seconds, floors at zero, and may end the turn. |
| Tap controls | Component + mobile/desktop E2E | Right is correct, left is pass, both have accessible labels and work without sensors. |
| Tilt controls | Pure recognizer tests + physical device QA | Down is correct, up is pass, held tilt emits once, neutral re-arms, denial falls back. |
| Timer lifecycle | Store/component fake-clock tests | Background/refresh uses wall-clock time; expired actions are rejected; summary occurs once. |
| Pass-device flow | Component/E2E | Summary never exposes/starts the next word; explicit handoff names the next player/team. |
| Score/final result | Domain/component tests | Correct = 1, pass = 0, all events appear in summary, ties are represented correctly. |
| Offline/local-first | Build + offline E2E | App shell, shared packs, and recovered Charades state work after network is disabled. |
| Impostor regression | Existing 57 tests + updated E2E | Existing setup, reveal, discussion, voting, result, replay, pack CRUD, and offline flows still pass. |

Feature acceptance requires all rows above plus clean lint/build results. Tilt is not accepted for production based on jsdom/Playwright alone; at least one current iOS Safari PWA/browser and one Android Chrome device must pass the physical matrix.

## 11. Rollout, Rollback, Observability, Cleanup, and Unverified Boundaries

### Rollout

1. Land shared optional-hint compatibility and Impostor filtering before enabling word-only creation.
2. Land Charades behind its home card in the same release once unit/component/E2E checks pass.
3. Verify update behavior from the current service worker version so existing installed users receive the new shell cleanly.
4. Run physical QA:
   - Android Chrome browser and installed PWA: permission/capability, portrait forehead posture, tilt directions, background/return, tap fallback.
   - iOS Safari browser and added-to-home-screen mode: permission prompt from Start gesture, denied path, orientation axis, background/return, tap fallback.
   - Desktop Chromium: keyboard/tap path and responsive setup/summary.

### Rollback

- The Charades home card, routes, screens, and `moldyparty-charades` store can be disabled/removed without touching Impostor data.
- Do **not** roll back the optional-hint parser/serializer and Impostor compatibility filter while word-only records may exist. That compatibility slice is the safe forward reader and should remain through rollback.
- No IndexedDB downgrade is needed because the table schema/version is unchanged.
- Leaving the unused `moldyparty-charades` key after rollback is harmless; a later cleanup release may remove it only after explicit product approval.

### Observability

This local-only app has no telemetry. Operational evidence is therefore:

- visible, accessible validation and sensor-status messages;
- deterministic domain/store tests with injected clock/randomness;
- production-build desktop/mobile/offline E2E;
- real-device QA notes for permission/axis behavior; and
- service-worker update/build inspection.

Do not add analytics solely for this feature.

### Cleanup

- Remove any temporary duplicated eligibility checks after all consumers use `packCompatibility.ts`.
- Ensure timers/listeners/object URLs are disposed on unmount.
- Keep `dist/`, Playwright reports, and test results uncommitted.
- Update the original living design document as specified in Task 15, but keep the original implementation plan historical; this feature plan remains the new feature's implementation source of truth.

### Unverified boundaries / explicit implementation decisions

1. **Real sensor axes:** fixed thresholds/directions are recommended but must be confirmed on physical iOS/Android devices. If axes are inconsistent, adjust only the adapter/calibration contract; do not change domain/store commands.
2. **Wake Lock:** not currently requested and browser support/permission behavior is unverified. Keep it out of scope unless physical QA shows screen sleeping is a material failure.
3. **Maximum practical pack size:** the current parser has no cap. Tests cover 200 lines, but multi-thousand-word UX/storage behavior is unverified and not required by “50+.”
4. **Service-worker upgrade from every historical build:** only the current repository build is available for direct verification.
5. **PWA orientation locking:** manifest currently uses `orientation: 'any'`; do not force portrait until forehead and tabletop usage are tested on devices.

## 12. Self-review Result

- **Spec coverage:** Core mechanic, pass-device flow, shared Impostor words, 50+ custom authoring, configurable turn time, optional correct bonus, optional pass penalty, summaries, and player/team language each map to implementation and verification tasks.
- **Unsupported claims:** Sensor behavior and historical service-worker upgrades remain explicitly unverified; no physical behavior is claimed from browser automation.
- **Consumer coverage:** All discovered producers/consumers of `WordItem`/`WordPack` are named, including parser, DB, both lobbies, AI helper, tests, README, and offline flow.
- **Scope control:** No backend, speech recognition, tournament mode, telemetry, or dependency addition is included.
- **Compatibility:** Existing records require no database migration; Impostor filtering lands before word-only writes; rollback retains the forward-compatible reader/filter.
- **Task granularity:** Fifteen reviewable tasks contain more than 50 checkable implementation/verification steps without splitting into cosmetic microtasks.
