# Forehead Charades Feature Impact and Implementation Plan

**Status:** Planning only

**Created:** 2026-11-02

**Last updated:** 2026-11-13
**Goal:** Add an offline-first Forehead Charades game with Classic, Henyo, One-Word, and Team Relay modes; reliable tap and calibrated tilt controls; mobile/PWA lifecycle handling; sensory feedback; shared Impostor word packs; and tagged, no-repeat decks.

This document is the canonical plan for the feature. It supersedes the simpler Charades scope previously recorded at this path. No product code, configuration, dependency, database, or git-history change is authorized by this planning task.

## 1. Decision Summary and Feature Brief

### Recommendation

Add **Forehead Charades** as a second first-class game on the MoldyParty home screen. Build one isolated Charades domain/store and one shared timed-card engine, with a policy object for each sub-mode:

| Mode | Timer and flow | Mode-specific behavior |
|---|---|---|
| Classic | Selectable 60, 75, or 90 seconds; one holder per round | Freeform clues, acting, and impressions; rapid correct/pass cycling. |
| Henyo | Fixed 2:00 active timer | Bilingual category badge; strict `Oo / Hindi / Pwede` (`Yes / No / Maybe`) helper buttons; optional synthesized chimes; manual `Foul (-5s)` without changing the card. |
| One-Word | Selectable 60, 75, or 90 seconds; one holder per round | Rule banner states that each clue-giver may say only one word per card. The app records outcomes but does not pretend to police speech. |
| Team Relay | Two named teams; 3–5 rounds; each team gets one turn per round | Alternate teams, rotate through each team's ordered member list, and maintain cumulative team scores. Three rounds therefore means six timed turns. |

The active-round screen uses two full-height semantic tap buttons: left = **Pass**, right = **Correct**. They can be visually quiet but must remain keyboard- and screen-reader-operable. Optional orientation input emits the same semantic commands after a one-second neutral-pose calibration during a three-second **Get Ready** countdown. Every input path passes through one token-guarded command so a tap and tilt cannot score the same card twice.

Use a best-effort device lifecycle layer during Get Ready and active play:

- request/resume Web Audio from the Start gesture;
- request orientation permission only when motion is enabled;
- calibrate for one second, then arm tilt recognition with deadzone, dwell, hysteresis, and neutral reset;
- acquire a screen wake lock while visible and reacquire after returning to the page;
- request landscape orientation when allowed, otherwise show a non-blocking rotate prompt and continue in a portrait-safe layout;
- release listeners, wake lock, orientation lock, timers, and audio scheduling on summary, exit, or unmount.

All device APIs are progressive enhancements. Tap controls, timer completion, scoring, and summaries must work when every optional API is missing or denied.

### Shared pack decision

Keep one Dexie pack library. Extend each `WordItem` with optional Charades metadata rather than creating a second pack type or copying Impostor records. Eligibility is computed per item, not per pack:

- Charades accepts every nonblank word.
- Impostor accepts an item only when it is not `charadesOnly` and has at least one usable hint.
- A pack is shown in a game only when enough eligible items remain for that game's start rule.
- Filtering by category/vibe happens before the Charades deck is created, and setup displays the resulting eligible count.

This allows mixed packs: hinted words remain usable in both games, while word-only or explicitly `charadesOnly` entries remain Charades-only without hiding the rest of the pack from Impostor.

### Scope

In scope:

- A second game card and complete setup → Get Ready → active turn → round recap → session summary flow.
- Four mode policies, with cumulative Team Relay scheduling and holder rotation.
- Correct/pass tap zones, desktop keyboard fallback, calibrated tilt input, wake lock, and best-effort landscape handling.
- Zero-asset Web Audio cues, vibration, color flashes, and ten-second countdown ticks, each safely no-oping when unavailable.
- Henyo category badges, optional answer buttons/chimes, and a manual five-second foul penalty.
- Per-card category and vibe metadata, filter pills, mixed-pack compatibility, game-aware AI prompt generation, and a no-repeat local history.
- Recovery from refresh/backgrounding, local-only persistence, offline production behavior, and automated plus real-device verification.

Non-goals:

- Speech recognition, microphone access, automatic enforcement of Henyo/One-Word speech rules, or voice-command scoring.
- Online multiplayer, accounts, cloud sync, remote AI calls, analytics, leaderboards, or a backend.
- More than two teams, tournament brackets, remote phones, casting, or synchronized companion screens.
- Full application localization. Henyo's category and answer labels are bilingual; the rest of the UI remains in the current app language.
- Forcing fullscreen or blocking play until the device rotates. Orientation lock is not dependable enough to be a hard prerequisite.
- Editing built-in packs, storing raw sensor samples, or adding audio assets/dependencies.

### Permissions and privacy

- Orientation permission is requested only from the explicit Start/Ready gesture and only when motion controls are enabled.
- No raw `alpha`, `beta`, or `gamma` samples are persisted, logged, exported, or transmitted.
- Wake lock, orientation lock, vibration, and audio are capability-checked and never gate the round.
- Packs, no-repeat history, game state, and score remain in the browser profile. Existing offline/privacy guarantees remain unchanged.
- Hydrated local state is treated as untrusted input and normalized before use; local players can edit browser storage, so this is a party-game integrity boundary, not anti-cheat security.

### Assumptions made for planning

- A Team Relay “round” completes after both teams have taken one turn; 3–5 rounds means 6–10 turns.
- Each relay team has a team name and one or more ordered member names. The next holder is `members[teamTurnCount % members.length]`.
- Classic and One-Word default to 60 seconds; Henyo is fixed at 120 seconds; setup offers 60/75/90 only where the mode permits it.
- A correct answer scores one point; a pass and a foul score zero. A foul only subtracts five seconds and may end the turn at zero.
- The no-repeat cache is enabled by default, is scoped to the pack, and can be cleared from setup. When an eligible filtered subset is exhausted, only that subset is released for a new cycle.
- Existing untagged words remain usable. Their Henyo category is derived from a known pack category when possible, otherwise displayed as `Other / Iba`.
- Feedback defaults to enabled when supported, with separate Sound and Haptics toggles persisted as preferences. Visual correct/pass state and text are always present, so feedback never relies on color, sound, or vibration alone.

## 2. Current-State Evidence Ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | `src/App.tsx:15-20` owns an in-memory `AppView`, and `src/App.tsx:64-76` renders only the Impostor launch card. | Charades needs explicit app orchestration and a persisted active-game discriminator; its phases must not be added to Impostor's union. |
| Confirmed | `src/domain/types.ts:11-24` requires `WordItem.hint` and gives only the pack a `category`. | Per-item optional hints, category, vibe, and `charadesOnly` are backward-compatible structural additions, but all hint consumers must be filtered first. |
| Confirmed | `src/domain/game.ts:65-78` selects directly from `input.pack.items` and assumes a hint pool exists. | Impostor must receive or derive an eligible-item view before random selection; widening the type first without this guard would create a runtime failure. |
| Confirmed | `src/features/game/LobbyScreen.tsx:53-55,88` merges every built-in/custom pack and passes the selected pack unchanged. | The Impostor picker and submit path both need centralized compatibility filtering; UI filtering alone is insufficient. |
| Confirmed | `src/features/packs/packParser.ts:13-51` rejects missing hints and enforces normalized word uniqueness; `serializeWordPack` at lines 116-123 emits only word/hint data. | Parsing/serialization must preserve optional Charades metadata and legacy hint shapes without inventing values. |
| Confirmed | `src/features/packs/packDb.ts:4-10,20-34` stores complete `WordPack` values in one Dexie v1 table with no item-level indexes. | Optional item fields need no Dexie schema migration; repository coexistence tests are still required. |
| Confirmed | `src/features/packs/PackManager.tsx:55-77` converts manual rows to hinted JSON; import/export already passes through the shared parser. | Add a Charades-aware bulk/metadata path without weakening the existing Impostor editor. |
| Confirmed | `src/features/packs/aiPrompt.ts:1-28` is a local prompt builder requesting 25 hinted Impostor items; `AiPromptHelper.tsx:9-23` only copies the result. | “AI hooks” should remain local prompt generation: add game/mode/schema options, not a network integration. |
| Confirmed | `src/store/gameStore.ts:362-364,400,717-720,760-793` uses a versioned persisted Zustand store and localStorage; its timer uses an absolute deadline at lines 620-641. | Use a separate versioned Charades key/store, reuse the absolute-deadline pattern, and validate migrations independently. |
| Confirmed | `src/store/preferencesStore.ts:4-18` persists only discussion defaults and install-prompt dismissal. | Feedback preferences may extend this store; active-game routing belongs in a small dedicated app store rather than overloading preferences. |
| Confirmed | `vite.config.ts` sets manifest orientation to `any`, precaches emitted JS/CSS/HTML/SVG/WOFF2, and adds no media assets. | Keep setup/summary orientation flexible; request landscape only during active play. Synthesized audio adds no cache rule or asset. |
| Confirmed | `src/styles.css:29-31,40,102,181` already provides minimum button height, focus styles, safe areas, reduced-motion handling, and a touch-action precedent. | Charades should extend the same accessibility and safe-area system; active controls need explicit pointer-event ownership and reduced-effects behavior. |
| Confirmed | `playwright.config.ts:13-15` runs Desktop Chrome and Pixel 7 Chromium projects. | Core flow and mocked capability branches can be automated, but physical iOS/Android sensor behavior remains a release gate. |
| Confirmed | `docs/superpowers/specs/2026-11-02-moldyparty-design.md:17-24` originally excluded multiple titles while requiring installable offline use. | This feature intentionally supersedes the single-title boundary while preserving the offline/no-backend invariants. |
| Confirmed | Read-only baseline on 2026-11-13: `npm run test:run -- --reporter=dot` passed 124/124 tests in 10 files; `npm run lint` exited cleanly. | Implementation should preserve this baseline; the earlier plan's 57-test count is stale. |
| Confirmed | W3C Screen Wake Lock requires a visible, fully active document and permits automatic release; W3C Screen Orientation allows user-agent preconditions and accessibility exceptions. | Wake lock must be reacquired after visibility changes, and orientation lock must be advisory with a portrait fallback. See standards references below. |
| Inferred | No API, auth, event bus, telemetry, or server dependency exists in source/dependencies. | Security, observability, and rollback stay client-side; no backend contract or migration is expected. |
| Unverified | Actual tilt axis/sign, orientation-lock availability, vibration support, and wake-lock behavior vary across browser/OS/device posture. | Do not encode production confidence from jsdom/Chromium mocks; run the physical-device matrix before rollout. |

Standards references checked 2026-11-13:

- [W3C Screen Wake Lock](https://www.w3.org/TR/screen-wake-lock/)
- [W3C Screen Orientation](https://www.w3.org/TR/screen-orientation/)
- [W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/)
- [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

## 3. End-to-End Impact and Consumer Map

| Producer / owner | Contract change | Direct consumers and required response |
|---|---|---|
| `src/domain/types.ts` | `WordItem.hint` becomes optional; add `charadesOnly?`, `category?`, and `vibes?`. | `builtInPacks.ts`, `game.ts`, pack parser/manager/DB tests, both game pickers, Charades filters, README schema. |
| New `src/domain/packCompatibility.ts` | Central `eligibleItems(pack, game, filters?)` and `isPackUsableFor(...)`. | Impostor lobby and `createRound`, Charades setup/deck builder, Pack Manager badges/counts, import validation, tests. |
| `src/features/packs/packParser.ts` | Accept and preserve hinted, hintless, mixed, tagged, and legacy formats. | JSON paste/upload, manual/bulk save, export, AI-generated packs, offline E2E. |
| `src/features/packs/packDb.ts` | Value type broadens; Dexie schema/indexes stay v1. | No migration expected; repository tests prove old/new records coexist and round-trip. |
| `src/features/packs/PackManager.tsx` | Game compatibility badges; Charades bulk entry/default metadata; tagged item editing or JSON guidance. | Existing pack CRUD tests, Impostor editor behavior, Charades setup return path. |
| `src/features/packs/aiPrompt.ts` | Prompt options for Impostor vs Charades/Henyo; Charades requests 50 unique tagged items. | `AiPromptHelper.tsx`, prompt tests, README examples; no remote service consumer. |
| New `src/domain/charades.ts` | Pure mode policies, validation, team schedule, deck/history rules, scoring, timer/foul transitions, ranking. | Charades store and all Charades screens; no browser APIs inside domain. |
| New `src/store/charadesStore.ts` | Persisted setup/session snapshot and semantic commands under `moldyparty-charades`. | App router, Get Ready, active round, recap/scoreboard, recovery tests. |
| New `src/store/appStore.ts` | Persist `activeGameId: 'impostor' | 'charades' | null` under `moldyparty-app`. | `App.tsx`, both start/exit flows, legacy Impostor recovery. |
| `src/store/preferencesStore.ts` | Add sound/haptics preferences and a versioned migration/defaults. | Charades setup/device feedback only; existing discussion preference remains unchanged. |
| New input adapters | Orientation recognizer emits `correct`/`pass`; keyboard/tap emit the same commands. | Active-round controller; adapters never mutate score directly. |
| New device services | Wake lock, orientation lock/prompt, Web Audio synth, vibration, and visibility lifecycle. | Get Ready/active controller; status HUD; cleanup tests. |
| New no-repeat repository | Bounded localStorage history keyed by pack plus normalized words. | Deck builder, setup Reset action, hydration corruption tests. It does not change Dexie packs. |
| `src/App.tsx` | Add launch card, Charades routes, pack-manager return context, and active-game precedence. | App tests, existing Impostor flow, offline navigation, CSS. |
| `src/styles.css` | Landscape active-round layout, tap halves, flashes, category/answer controls, safe areas. | Mobile/desktop responsive tests and reduced-effects checks. |
| PWA build | No dependency or manifest-wide landscape change; emitted code is precached by existing patterns. | Build/offline E2E and installed-PWA physical QA. |

No backend, API, authentication, authorization, audit-log, server schema, job, or remote event consumer was discovered.

## 4. Conflicts, Invariants, Risks, and Design Options

### Intentional invariants

- Impostor receives only words with usable hints and must behave exactly as it does today for legacy packs.
- Packs remain local, importable/exportable, and stored once by stable pack ID.
- Game rules and score transitions are pure; React and browser adapters issue commands and render state.
- Timers use absolute deadlines and reconcile on visibility/focus/hydration, rather than trusting interval ticks.
- Pass-device transitions explicitly identify the next holder; a new word is not exposed before Get Ready completes.
- Tap input is always available; motion and device APIs are optional enhancements.
- Offline play, safe-area layout, visible focus, minimum target sizing, and reduced-effects behavior remain intact.

### Design alternatives

#### Option A — Recommended: one engine with explicit mode policies

Create one Charades session model and store. A `MODE_POLICIES` table defines duration choices, whether Henyo helpers exist, whether teams are required, number of turns, and summary behavior. Browser input/feedback adapters sit outside the store and send semantic commands.

Tradeoff: the shared state model is broader, but invariants, recovery, scoring, and device cleanup are implemented once. A policy cannot silently invent behavior because each mode has focused tests.

#### Option B — Separate flow/store for every mode

Each mode gets its own screens and persisted state.

Tradeoff: initially straightforward, but duplicates deck selection, deadline recovery, tap/tilt races, recap UI, and device lifecycle four times. Fixes would drift, especially between Classic and One-Word. Rejected.

#### Option C — One highly configurable active component with conditional branches

Keep a minimal store and place mode decisions inside a single React screen.

Tradeoff: fewer files, but domain rules, browser effects, rendering, and scoring become coupled and hard to test. Refresh/background recovery and relay scheduling would depend on component lifecycle. Rejected.

### Pack alternatives

- **Recommended:** optional per-item metadata plus computed per-game eligibility. Mixed packs work without copies.
- **Rejected:** require hints on every Charades word. This keeps today's type but makes Charades-only creation needlessly expensive and defeats `charadesOnly`.
- **Rejected:** create a second Charades pack table. Copies drift on rename/edit/delete and violate the unified-library goal.

### Highest-impact conflicts and mitigations

1. **Widening `WordItem` can break Impostor.** Land `packCompatibility.ts`, domain filtering, and regression tests before any UI can write hintless items.
2. **Tap/tilt/helper-button races can double-score.** Every card has a monotonically changing token. `submitOutcome(outcome, token, now)` is the only score/advance command and rejects stale tokens, non-active phases, input lockout, and `now >= deadlineMs`.
3. **Henyo helper buttons sit inside full-screen tap zones.** Buttons stop pointer propagation and invoke only their own audio/penalty action. Tests must prove answer/foul taps never score or pass a card.
4. **Calibration can encode a bad pose.** Collect valid samples for one second, use a median baseline, require a minimum sample count/stability, and fail open to tap with a visible status. Never begin the active timer before calibration/countdown finishes.
5. **Orientation axes change with screen rotation.** Normalize beta/gamma using `screen.orientation.angle`, then apply relative thresholds. Keep sign/threshold constants isolated and require physical QA in portrait/landscape and browser/PWA modes.
6. **Wake/orientation APIs can be rejected or auto-released.** Treat them as advisory; reacquire wake lock only when visible and active, catch every promise rejection, unlock/release on exit, and never pause gameplay on failure.
7. **Audio autoplay policies can suppress cues.** Create/resume `AudioContext` from Start, expose Sound off, and keep visual/text feedback authoritative.
8. **Timer/background races can accept late outcomes.** Reconcile from the absolute deadline inside every command and lifecycle callback; the first expiry transition wins exactly once.
9. **No-repeat filters can starve a small subset.** Select unseen eligible words first; when none remain, clear only the current eligible subset, avoid placing the immediately previous word first when possible, and continue.
10. **Color flashes can be inaccessible or uncomfortable.** Use short single-state overlays, icons/text/ARIA announcements, no strobing, and reduced-effects CSS. Color is never the sole signal.
11. **Relay holder rotation can desynchronize after refresh.** Persist team turn counts and derive the next member; do not persist a duplicate mutable holder index.
12. **Rollback after hintless data exists.** A UI rollback must retain the optional-hint reader and Impostor eligibility filter until those records are explicitly migrated or deleted.

## 5. Recommended Architecture and Data Flow

### Domain contracts

```ts
type GameId = 'impostor' | 'charades'
type CharadesMode = 'classic' | 'henyo' | 'one-word' | 'team-relay'
type CharadesPhase = 'SETUP' | 'GET_READY' | 'ACTIVE' | 'ROUND_SUMMARY' | 'SESSION_SUMMARY'
type CharadesOutcome = 'correct' | 'pass'
type CharadesCategory = 'person' | 'place' | 'object' | 'animal' | 'food' | 'pop-culture' | 'other'
type CharadesVibe = 'casual' | 'pop-culture-local' | 'chaos-hard'

interface WordItem {
  word: string
  hint?: string
  hints?: string[]
  charadesOnly?: boolean
  category?: CharadesCategory
  vibes?: CharadesVibe[]
}

interface CharadesSettings {
  mode: CharadesMode
  packId: string
  durationSeconds: 60 | 75 | 90 | 120
  categories: CharadesCategory[]
  vibes: CharadesVibe[]
  motionEnabled: boolean
  henyoTapAnswersEnabled: boolean
  noRepeatEnabled: boolean
  teams?: [CharadesTeam, CharadesTeam]
  relayRounds?: 3 | 4 | 5
}
```

`CharadesSession` owns a sanitized settings snapshot, filtered card snapshot, shuffled remaining deck, previous card key, current card/token, phase, active deadline, accepted card events, foul events, completed turn summaries, team turn counts, and completed relay rounds. It does **not** persist interval handles, audio nodes, sensor samples, permission objects, wake-lock sentinels, flash state, or DOM orientation state.

### Pack eligibility and metadata

`eligibleItems(pack, 'impostor')` returns items with a nonblank word, `charadesOnly !== true`, and at least one nonblank hint from `hints[]` or legacy `hint`. `eligibleItems(pack, 'charades', filters)` returns nonblank words matching active category/vibe filters.

For category display only, derive a fallback without mutating storage:

- `Animals` → `animal / hayop`
- `Places` → `place / lugar`
- `Objects` → `object / bagay`
- otherwise → `other / iba`

Built-in items should receive explicit metadata where the answer is known; custom legacy packs continue through the fallback. Vibe-less items appear when no vibe filter is selected, but do not silently match a selected vibe. Setup shows counts and prevents start when fewer than two Charades cards remain.

Canonical JSON remains a `WordPack` object. Item metadata is optional:

```json
{
  "packName": "Pinoy Party",
  "category": "Mixed",
  "items": [
    {
      "word": "Adobo",
      "hint": "Ulam",
      "category": "food",
      "vibes": ["casual", "pop-culture-local"]
    },
    {
      "word": "Balut",
      "charadesOnly": true,
      "category": "food",
      "vibes": ["chaos-hard"]
    }
  ]
}
```

The parser preserves the legacy single `hint`, modern `hints[]`, word-only, and mixed shapes. `charadesOnly: true` forces Impostor exclusion even if a hint exists. A missing hint implicitly makes that item Charades-only for eligibility but does not cause the serializer to invent `charadesOnly`.

### Round and session data flow

1. Setup loads shared packs, computes compatibility/counts, applies category/vibe pills, validates mode-specific settings, and snapshots eligible items.
2. Starting a session sets `activeGameId = 'charades'`, builds a randomized unseen deck, derives the first holder/team, and enters `GET_READY`.
3. The Start gesture initializes/resumes audio, requests orientation permission when enabled, requests wake/orientation services, and begins a three-second countdown. The first second collects calibration samples.
4. On countdown completion, `beginTurn(now)` assigns the first card/token and sets `deadlineMs = now + durationSeconds * 1000`.
5. Tap, keyboard, or tilt calls `submitOutcome(outcome, token, now)`. The store reconciles expiry, records one card event, updates score, records the word in no-repeat history, and advances to a new token/card.
6. Henyo answer buttons call `playHenyoAnswer(answer)` outside the scoring domain. `applyFoul(now)` reconciles time, records a penalty event, subtracts 5000 ms, and keeps the current card/token unless time reaches zero.
7. A visual interval derives remaining seconds from the deadline. `visibilitychange`, focus, `pageshow`, and hydration call `syncClock(now)`. Zero moves to `ROUND_SUMMARY` exactly once.
8. Summary lists every card in order: green/check for correct, muted/struck for pass, plus foul entries and score. Selecting a row expands/reveals the word without changing its result.
9. Non-relay modes may start another holder round or exit. Relay advances to the other team/derived member; after both teams complete the configured number of rounds, it enters `SESSION_SUMMARY` with cumulative scores and ties preserved.

### Input recognizer

Implement a pure state machine independent of React:

- Calibration: collect finite normalized tilt samples for 1000 ms; require a minimum count and acceptable spread; baseline is the median.
- Armed: ignore deltas inside the deadzone. A correct/pass threshold must be held for a short dwell before one event emits.
- Latched: emit nothing while held. Re-arm only after returning inside a smaller neutral threshold for the configured dwell/cooldown.
- Rotation: convert beta/gamma to a screen-relative forward/back delta using the current orientation angle. Reset and recalibrate after a screen-orientation change during Get Ready; during an active turn, disable motion with a status instead of recalibrating over live play.
- Failure: permission denied, missing samples, unstable calibration, or unsupported API leaves tap/keyboard active and displays the reason.

Thresholds, dwell times, and direction signs stay in one configuration object so physical QA can tune the adapter without touching score/domain code.

### Device services and feedback

- `wakeLock.ts`: `acquire`, `release`, and visible-active reacquisition; hold at most one sentinel.
- `orientationLock.ts`: attempt `screen.orientation.lock('landscape')`; on rejection show a rotate hint and continue. Call `unlock()` on exit. Do not change the manifest from `orientation: 'any'` because setup/recap must support portrait and the standard permits user-agent preconditions.
- `audioSynth.ts`: lazily own one `AudioContext`; synthesize distinct correct, pass, yes, no, maybe, foul, and countdown envelopes with Oscillator/Gain nodes; schedule nothing after cleanup.
- `haptics.ts`: guarded `navigator.vibrate(35)` for correct and `[30, 45, 30]` for pass; no-op when disabled/unsupported.
- visual overlay: one short non-strobing state (`correct` or `pass`) plus live text/icon; clear on timer/unmount and respect reduced-effects styling.
- countdown audio: emit once per integer transition from 10 through 1, not on every render/interval tick.

### Persistence, migration, and recovery

- New `moldyparty-charades` Zustand key, version 1. Persist only validated serializable setup/session state.
- New `moldyparty-app` key, version 1, for `activeGameId`. If it is absent and a legacy active Impostor game exists, infer Impostor. If it points to no recoverable game, return home with a recovery notice; never delete the other store automatically.
- Extend `moldyparty-preferences` to version 2 with sound/haptics defaults while preserving `defaultDiscussionSeconds` and `installPromptDismissed`.
- New `moldyparty-charades-history` localStorage value, version 1. Normalize and bound entries per pack; ignore corrupt/unknown values; provide Reset.
- No Dexie version change: optional fields are inside stored values and are not indexed.
- On active-turn recovery, reconcile the absolute deadline immediately. If expired, show the saved round summary. Never restart a full timer silently.

### Error behavior

- Invalid setup remains in place with field/summary errors and preserved draft data.
- A deleted/changed pack invalidates selection and asks for a new choice; it never silently switches packs.
- Fewer than two eligible filtered words disables Start and shows which filters caused the shortage.
- Optional API errors become non-blocking status text; tap controls remain visible and active.
- An outcome at/after deadline is rejected and the round ends. A stale token or non-active phase is a no-op.
- A foul at five seconds or less ends the round with zero remaining; it never makes time negative.
- Audio/vibration exceptions are swallowed after updating capability status; they cannot interrupt scoring.
- Corrupt persisted Charades data is quarantined to a safe setup/home state without modifying Impostor sessions or packs.

## 6. Contract, Schema, Migration, and Compatibility Changes

### Modified contracts

- `WordItem.hint: string` → `hint?: string`.
- Add optional `charadesOnly`, `category`, and `vibes` to `WordItem`.
- Add `GameId` and Charades-specific types, preferably in new focused files rather than expanding all Impostor types in `types.ts`.
- `buildAiPackPrompt(topic)` becomes an options-based API while retaining an Impostor-default overload or updating every discovered caller/test atomically.
- Pack selection accepts a `gameId`/eligibility result instead of assuming all pack items are usable.

### Compatibility rules

- Existing built-in and custom hinted packs remain byte-shape compatible and usable by both games.
- Existing single-hint and multi-hint imports remain valid.
- Word-only items become valid Charades data but are excluded from Impostor.
- Mixed packs are filtered per item; do not reject the whole pack because one entry is Charades-only.
- Existing Dexie data needs no migration. Parser/serializer and runtime normalizers are forward readers for new optional fields.
- Import rejects unknown category/vibe values with item-indexed errors rather than silently dropping metadata.
- Export omits absent optional fields and preserves present arrays/flags.

### Rollback constraint

Once any hintless/Charades-only item is written, the optional-hint reader and Impostor eligibility filter are durable compatibility infrastructure. They must survive a UI rollback until affected records are migrated or removed with explicit user consent.

## 7. File Ownership Map

Create:

- `src/domain/packCompatibility.ts` and `.test.ts` — per-item eligibility, category fallback, filter counts.
- `src/domain/charades.ts` and `.test.ts` — policies, validation, deck, schedule, scoring, deadline/foul transitions, summaries.
- `src/store/appStore.ts` and `.test.ts` — active-game persistence and legacy inference.
- `src/store/charadesStore.ts` and `.test.ts` — commands, persistence, migration, recovery, injected clock/randomness/history.
- `src/features/charades/CharadesSetupScreen.tsx` and test — mode/cards/filters/team settings/capability copy.
- `src/features/charades/GetReadyScreen.tsx` and test — holder handoff, permission gesture, countdown, calibration/status.
- `src/features/charades/ActiveRoundScreen.tsx` and test — word/category/HUD/tap zones/Henyo helpers/foul/feedback.
- `src/features/charades/RoundSummaryScreen.tsx`, `SessionSummaryScreen.tsx`, and tests — recap and relay totals/ties.
- `src/features/charades/orientationInput.ts` and test — pure calibration/recognizer/axis normalization.
- `src/features/charades/useCharadesDevices.ts` and test — lifecycle orchestration and cleanup.
- `src/features/charades/wakeLock.ts`, `orientationLock.ts`, `audioSynth.ts`, `haptics.ts`, and tests — guarded browser adapters.
- `src/features/charades/noRepeatHistory.ts` and test — bounded versioned local history.
- `e2e/charades-flow.spec.ts` — desktop/mobile/offline and mocked capability journeys.

Modify:

- `src/domain/types.ts`, `builtInPacks.ts`, `game.ts`, and their tests — shared metadata and safe Impostor selection.
- `src/features/game/LobbyScreen.tsx` and `CategoryPicker.tsx` tests — Impostor compatibility counts/filtering.
- `src/features/packs/packParser.ts`, `PackManager.tsx`, `aiPrompt.ts`, `AiPromptHelper.tsx`, and tests — mixed schema, authoring, import/export, prompt modes.
- `src/features/packs/packDb.test.ts` — old/new record coexistence; no schema version change.
- `src/store/preferencesStore.ts` and tests — feedback preference migration.
- `src/App.tsx`, `App.test.tsx`, and `styles.css` — routing, launch card, active screens, mobile layouts, feedback.
- `e2e/offline.spec.ts` — shared pack and recovered Charades offline path.
- `README.md` and the living product design — new game, schema, controls, permissions, offline behavior.

Do not modify `vite.config.ts` unless implementation evidence proves a manifest/build change is necessary. The current precache glob covers generated code, and `orientation: 'any'` is intentional outside active play.

## 8. Ordered Implementation Phases

Each phase begins with failing tests for its contract and ends with the named focused tests. Do not enable hintless writes before Phase 1 is complete.

### Phase 0 — Reconfirm baseline and lock decisions

**Owners:** current test suite, this plan, product acceptance criteria.

1. Run `npm run test:run` and `npm run lint`; record current counts.
2. Confirm no product/schema changes landed since this plan's evidence lines.
3. Preserve the assumptions in Section 1 unless product explicitly changes relay round semantics, duration choices, or feedback defaults.

### Phase 1 — Shared pack safety before new writers

**Owners:** `types.ts`, `packCompatibility.ts`, `game.ts`, Impostor lobby/category picker, their tests.

1. Add mixed-pack fixtures: legacy hint, `hints[]`, hintless, explicitly Charades-only with hint, tagged, invalid metadata.
2. Implement compatibility helpers and test per-item filtering/counts.
3. Update `createRound` and validation so Impostor selects only eligible items and returns a user error when none remain.
4. Filter/count packs in the Impostor picker and revalidate at submit time.
5. Run domain, lobby, game-store, and full Impostor regression tests.

### Phase 2 — Parser, storage, authoring, and AI prompt contracts

**Owners:** pack parser/serializer, Pack Manager, Dexie repository tests, prompt helper, README schema.

1. Test round-trip preservation for every legacy/new/mixed item shape and item-indexed invalid metadata.
2. Accept optional metadata and hintless items; omit absent fields on export.
3. Add compatibility badges/counts and a Charades bulk-entry path with default category/vibes/`charadesOnly`; retain the hinted Impostor editor.
4. Add AI prompt options: Impostor keeps 25 hinted items; Charades requests exactly 50 unique items with valid categories/vibes; Henyo emphasizes concrete nouns and categories.
5. Prove Dexie v1 stores and lists old/new packs without an upgrade.

### Phase 3 — Pure Charades engine and no-repeat policy

**Owners:** `charades.ts`, `noRepeatHistory.ts`, unit tests.

1. Test every mode policy/default/validation branch.
2. Test filtered deck construction, deterministic shuffle, no-repeat selection, subset exhaustion, previous-word avoidance, corruption, Reset, and history bounds.
3. Test Classic/One-Word/Henyo round transitions, deadline rejection, correct/pass events, five-second foul, and summary order.
4. Test Team Relay alternation, derived holder rotation, 3/4/5 round completion, cumulative scores, and ties.
5. Keep all browser globals out of the pure domain.

### Phase 4 — Persisted stores and app routing

**Owners:** `charadesStore.ts`, `appStore.ts`, `preferencesStore.ts`, `App.tsx`, store/app tests.

1. Implement injected clock/random/history dependencies and the token-guarded command surface.
2. Test active deadline hydration before/during/after expiry and exactly-once summary transition.
3. Add active-game routing, legacy Impostor inference, invalid-pointer recovery, and explicit exit behavior.
4. Migrate feedback preferences without losing existing values.
5. Prove Charades state mutations cannot modify Impostor sessions and vice versa.

### Phase 5 — Input and device adapters

**Owners:** orientation recognizer, wake/orientation services, audio synth, haptics, device hook, unit tests.

1. Test calibration sample quality, median baseline, 0/90/180/270-degree normalization, both gestures, deadzone, dwell, latch, neutral re-arm, and rotation failure.
2. Test permission granted/denied/unsupported and listener cleanup.
3. Test wake lock single-sentinel behavior, visible-active reacquisition, automatic release, rejection, and cleanup.
4. Test orientation lock rejection/fallback and unlock.
5. Test user-gesture AudioContext initialization, distinct cue scheduling, 10-to-1 deduplication, Sound off, cleanup, and exceptions.
6. Test haptic patterns and unsupported/disabled no-ops.

### Phase 6 — Screens and mobile ergonomics

**Owners:** Charades setup/Get Ready/active/summary screens and `styles.css`.

1. Build setup with mode cards, compatible pack counts, category/vibe pills, duration options, motion/no-repeat/feedback controls, and relay team/member editor.
2. Build Get Ready with named holder/team, Start gesture, 3-second countdown, first-second calibration, device status, and tap-fallback message.
3. Build edge-to-edge active UI with `clamp()` word sizing, safe areas, timer/category HUD, semantic left/right buttons, keyboard mapping, and non-blocking portrait prompt.
4. Add Henyo bilingual answer buttons/chimes and foul control with propagation tests.
5. Add correct/pass overlays, haptics/audio calls, and accessible live text without color-only meaning.
6. Build ordered round recap and relay scoreboard; word rows expand on tap without mutating results.
7. Test long multi-word phrases, reduced effects, focus order, screen-reader labels, and 320px portrait fallback.

### Phase 7 — Integration, offline behavior, and regression

**Owners:** `App.tsx`, PWA/offline flow, E2E suites, README/design docs.

1. Add the home card and context-aware pack manager return routes.
2. Add desktop/mobile E2E for each mode, mixed packs, filters, tap fallback, relay completion, recap, refresh recovery, and mocked denied capabilities.
3. Extend offline E2E: install/build once, disable network, open Charades, use an existing/shared custom pack, recover state, and finish a round.
4. Run `npm run test:run`, `npm run lint`, `npm run build`, then `npm run e2e`.
5. Inspect the generated service worker/precache and verify no MP3/media assets or unexpected dependency chunks were introduced.
6. Update README and the living product design only after behavior is verified.

### Phase 8 — Physical-device release gate

**Owners:** release QA notes; no automated substitute.

1. Run the matrix in Section 10 on current iOS Safari/browser and added-to-home-screen mode, plus Android Chrome/browser and installed PWA.
2. Tune only isolated orientation thresholds/sign mappings if evidence requires it; rerun recognizer tests.
3. Record unsupported capabilities and fallback behavior in release notes.
4. Do not call motion/orientation production-ready until the physical matrix passes; tap-only release remains viable.

## 9. Verification Matrix and Acceptance Criteria

| Requirement | Evidence | Acceptance criterion |
|---|---|---|
| Four modes | Policy/domain/component/E2E tests | Each mode exposes only its valid setup, rules, helpers, timers, and summary behavior. |
| Classic timing | Fake clock + E2E | 60/75/90 seconds work; correct/pass advance rapidly and late inputs are rejected. |
| Henyo | Domain/component/E2E | Fixed 2:00; category always visible; answer buttons play distinct cues; foul removes exactly 5s and never advances the card. |
| One-Word | Component/E2E | One-word rule is clearly displayed during Get Ready/active play; core scoring remains identical to Classic. |
| Team Relay | Domain/store/E2E | Exactly two teams alternate, members rotate deterministically, both teams play each configured round, totals/ties are correct after refresh. |
| Tap/keyboard fallback | Component + desktop/mobile E2E | Left/ArrowLeft passes; right/ArrowRight scores; controls work with all optional APIs denied. |
| Tilt/calibration | Pure recognizer + mocked component + physical QA | One-second stable baseline; down/up emit intended commands once; held tilt does not repeat; neutral re-arms; bad calibration falls back. |
| Wake lock | Adapter tests + physical QA | Requested only during ready/active play, reacquired after visible return, released on exit, and failure is non-blocking. |
| Landscape/typography | Responsive tests + physical QA | Best-effort lock; clear rotate hint on failure; active play still usable in portrait; long phrases remain legible in landscape. |
| Audio | Adapter/component tests + physical QA | No asset/network request; user-gesture unlock; distinct cues; countdown ticks once per second from 10; Sound off works. |
| Haptics/flash | Adapter/component tests + physical QA | Correct single pulse, pass double pulse when supported; short non-strobing overlays; text/icon duplicate the state. |
| Recap | Domain/component/E2E | Every played word appears once and in order; correct is positive, pass is muted/struck; tapping reveals/expands without changing score. |
| Shared packs | Compatibility/parser/DB/E2E | Existing hinted packs work in both games without copies; mixed items filter correctly; word-only entries never reach Impostor. |
| Categories/vibes | Parser/filter/setup tests | Valid metadata round-trips; filter counts are accurate; Henyo fallback category is deterministic; unknown values produce indexed errors. |
| AI hook | Prompt unit tests | Impostor prompt remains compatible; Charades/Henyo prompt requests valid 50-item tagged JSON; no remote call occurs. |
| No repeats | Domain/history/store tests | No eligible word repeats until its active subset is exhausted; history survives reload, is bounded/resettable, and corrupt data fails safe. |
| Timer lifecycle | Fake clock/store/component tests | Background/refresh uses wall-clock deadline; outcome/foul expiry races resolve once; no negative time. |
| Offline/local privacy | Production build + offline E2E + source review | Full flow works offline after first load; no gameplay/sensor/pack network transmission or audio asset. |
| Impostor regression | Existing and new tests/E2E | Current session, role, voting, statistics, pack CRUD, abort, and offline flows remain unchanged. |

Feature acceptance requires every automated row, clean lint/build, and the physical capability matrix. A tap-only fallback may ship if motion is explicitly labeled unavailable and all non-motion criteria pass; a broken or misleading tilt path may not.

## 10. Rollout, Rollback, Observability, and Unverified Boundaries

### Rollout order

1. Ship/readiness-review shared optional metadata plus Impostor eligibility protection before exposing hintless creation.
2. Land the pure Charades engine/store behind the unlinked route or feature branch until device-independent tests pass.
3. Enable the home card when all automated checks and offline production checks pass.
4. Enable motion by default only after physical QA; otherwise default it off while retaining the tested tap game.

### Physical matrix

For iOS Safari browser and added-to-home-screen mode, and Android Chrome browser and installed PWA, verify:

- Start-gesture permission granted, denied, dismissed, and previously decided;
- one-second forehead-posture calibration and unstable-pose failure;
- landscape-left and landscape-right correct/pass direction, neutral re-arm, and no held-repeat;
- screen orientation changes before/during a round;
- wake behavior during a full two-minute Henyo turn, page hide/return, low-power rejection where reproducible;
- audio unlock and all Henyo/countdown cues; hardware mute expectations noted;
- correct/pass vibration when supported and graceful absence when not;
- helper buttons do not trigger tap zones;
- background past deadline opens exactly one summary;
- tap-only completion in every denied/unsupported case.

Desktop Chromium verifies keyboard/tap, responsive setup/summary, and unsupported-device messaging.

### Rollback

- Hide/remove the Charades home card and routes; leave the isolated Charades/app/history keys inert.
- Retain the optional metadata parser/serializer and Impostor eligibility filter while any new-format records may exist.
- No Dexie downgrade is required because the table version/index schema is unchanged.
- Do not delete user packs, history, or session state during rollback without separate explicit authorization.

### Observability

This local-only app has no telemetry. Evidence comes from:

- accessible in-app capability/calibration/error status;
- deterministic domain/store/adapter tests with injected clock/randomness/APIs;
- desktop/mobile/offline E2E against the production build;
- build/service-worker inspection; and
- dated physical-device QA notes with browser/OS/PWA mode.

Do not add analytics solely for this feature.

### Cleanup

- Remove listeners, intervals, scheduled audio, wake sentinels, and flash timers on every phase exit/unmount.
- Centralize eligibility; remove temporary direct hint checks after all consumers migrate.
- Keep generated `dist`, Playwright reports, and test results uncommitted.
- Bound/prune history lazily and remove a deleted pack's entry when practical; failure to clean history must never block pack deletion.
- Update living docs after implementation; keep this plan as the decision/implementation source of truth.

### Unverified boundaries

1. Device/browser-specific tilt signs and usable thresholds remain unverified until physical QA.
2. Screen Orientation support/preconditions and Wake Lock/Vibration behavior remain implementation-dependent; standards permit rejection or release.
3. iOS/browser/PWA audio behavior under hardware mute and power-saving modes needs physical observation.
4. Multi-thousand-item pack performance is outside acceptance; automated authoring/filter tests should cover at least 200 items, while the AI prompt target is 50.
5. Upgrade behavior from every historical service-worker build cannot be proven from the current checkout; verify from the currently deployed/previous production build if one exists.
6. Full Filipino localization is not planned; only the Henyo gameplay vocabulary/category labels are bilingual.

## 11. Self-Review Result

- **Unsupported claims:** Variable browser/device behavior is labeled unverified and tied to a physical gate; no mock test is presented as sensor proof.
- **Consumer coverage:** Every discovered producer/consumer of `WordItem`/`WordPack`, game routing, persistence, PWA lifecycle, and tests is named.
- **Contract safety:** Impostor filtering lands before hintless writers; runtime validation backs up picker filtering; rollback retains the forward reader.
- **Mode clarity:** Durations, relay-round semantics, holder rotation, Henyo foul behavior, and non-enforceable speech rules are explicit rather than placeholders.
- **Scope control:** No backend, microphone, remote AI, telemetry, extra team modes, dependencies, or global orientation lock was added.
- **Accessibility:** Tap zones remain semantic controls; portrait fallback exists; feedback is redundant; orientation is not mandatory; reduced effects and safe areas are preserved.
- **Operational completeness:** Recovery, offline use, cleanup, rollback, build inspection, automated tests, and physical-device QA each have an owner and acceptance evidence.
- **Repository hygiene:** This planning artifact is the only authorized change and is not committed.
