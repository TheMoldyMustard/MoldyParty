# Category Bomb: radial and large-group hot-potato word game

**Status:** Planning only  
**Date:** 2026-11-20  
**Feature owner:** New Category Bomb game flow

## 1. Decision summary and feature brief

Add **Category Bomb** as a third, standalone MoldyParty game with two automatic display modes. Groups of 2–12 arrange their names into fixed seats around a full-screen radial board, place the phone flat where everyone can reach it, and follow a center arrow toward the active player's seat. Groups of 13 or more skip radial placement and use **Large group / name-only mode**: the active player's name is shown prominently in the center instead of an arrow or perimeter name tags, and the phone is passed to that named person. Both modes start a round with a category and a secret, randomized deadline. An accepted answer is self-moderated: the active player taps the center bomb, the game selects the next player, and—only when enabled in setup—the deadline receives a randomly sampled bonus from the configured seconds range. The pass-time bonus is off by default. When the hidden deadline expires, or the group calls an invalid/repeated answer, the current player is shown as exploded.

**Recommendation:** implement a pure `categoryBomb` domain plus an isolated persisted Zustand store and feature screens. Reuse only established app-shell, deadline/recovery, sound, haptics, wake-lock, responsive, and test patterns. Do not implement Category Bomb as a Charades mode: Charades advances answer cards and scores fixed turns, while Category Bomb keeps one category, changes players, hides its deadline, and ends on one explosion.

The default turn policy is a shuffled **Fair cycle**: every player appears once before a new shuffled cycle starts. The optional **Chaos** policy can return to a previously selected player before everyone has played, but still excludes the current player so the phone is actually passed. Both policies pick the first player randomly.

## 2. Scope, non-goals, permissions, and assumptions

### In scope

- A third home-screen game card and recoverable app routing for Category Bomb.
- A dedicated setup flow for 2 or more unique, non-empty player names, with a 24-character maximum for legibility.
- Automatic display-mode selection from roster size: **Radial** for 2–12 players and **Large group / name-only** for 13+ players.
- In Radial mode, a placement step with twelve fixed perimeter seats, an arrow preview, automatic initial placement, and tap/drag swapping so the on-screen seating can match the room.
- A radial active board with three player seats on each of four sides. Text faces outward in four directions; each corner contains the endpoint labels from its two adjoining sides.
- In Large group mode, no seating-placement step, perimeter names, or directional arrow. The active player's name is the primary center content and is updated atomically on each accepted answer.
- A built-in offline category-prompt list and a different random category on replay when another category is available.
- A randomized, player-count-relative, hidden wall-clock deadline; an optional per-pass random extension configured as a minimum/maximum seconds range and disabled by default; exact once-only expiry; refresh/background recovery; and no visible or accessibility-exposed countdown.
- Fair-cycle and Chaos turn policies.
- Self-moderation: center bomb tap accepts an answer; a deliberate press-and-hold **Foul** control immediately explodes the current player for a repeat or invalid answer. Hesitation is handled by the hidden timer.
- Generated audio, optional haptics, advisory wake lock, reduced-motion treatment, safe-area layout, keyboard-accessible controls, and offline behavior.
- Domain, store, component, app-shell, responsive, E2E, recovery, and regression verification.

### Non-goals

- No microphone, speech recognition, transcription, semantic answer validation, automatic duplicate detection, AI, or network service.
- No custom category editor, imported Category Bomb packs, answer dictionary, scoring, standings, elimination tournament, teams, or session statistics in v1.
- No changes to Impostor or Charades gameplay contracts.
- No requirement that Screen Orientation, Wake Lock, Web Audio, or Vibration APIs succeed; touch play must remain complete without them.
- No analytics or gameplay telemetry.

### Permissions and privacy

Category Bomb needs no account, server, microphone, camera, location, or sensor permission. Wake lock, vibration, and browser audio are local progressive enhancements. Player names and the active round remain in browser storage, matching the repository's current local-only model.

### Assumptions and explicit product calls

- **Assumption:** “place the name tags” means an in-app seating arrangement step, not physical paper tags. For 2–12 players, the UI auto-places players clockwise, then lets the group swap names into the seats that point toward their real positions. At 13+, the requested name-only mode makes placement irrelevant and skips that step.
- **Assumption:** the app randomly selects a built-in category when the bomb is armed. Setup does not require custom packs in v1.
- **Product call:** minimum players is 2. There is no fixed product maximum in name-only mode; implementation and E2E tests must cover at least 50 players, and setup should virtualize or otherwise optimize only if measured rendering evidence requires it. The existing shared Impostor `PlayerEditor` is not reused unchanged because it assumes a three-player minimum and has no layout-mode threshold or reordering (`src/features/game/PlayerEditor.tsx:7-40`).
- **Product call:** long names are limited to 24 trimmed characters, wrap to at most two lines, and scale with `clamp()`. Full names remain available to assistive technology, in the placement editor for Radial mode, and in the central name display for Large group mode.
- **Product call:** display mode is derived, not user-selectable: `playerCount <= 12` means `radial`; `playerCount >= 13` means `name-only`. This prevents a saved setup from claiming a layout incompatible with its roster.
- **Product call:** Fair cycle prevents an immediate same-player handoff at a cycle boundary while otherwise reshuffling freely. In Chaos mode, any player other than the current player may be next; repeats before full coverage are allowed.
- **Product call:** initial duration is uniformly sampled in whole seconds from `20 + 3 × playerCount` through `30 + 5 × playerCount` (29–45 seconds for 3 players; 56–90 seconds for 12). Pass-time bonus is disabled by default. When enabled, setup defaults to a **0.5–3.0 second** inclusive range, accepts **0.0–10.0 seconds** in 0.1-second increments, requires `minimum <= maximum`, and samples uniformly in integer 100 ms units. The applied total remains capped at **15 seconds per round**.
- **Product call:** “invalid answer detonates the bomb” is represented by a 600 ms press-and-hold Foul action. A normal click does not detonate, and visible hold progress plus cancel-on-pointer-leave reduces accidental fouls.
- **Open product decision, non-blocking for architecture:** final category copy, count, locale mix, and difficulty balance require playtesting. Start with a reviewed built-in list of broad prompts such as Animals, Countries, Foods, Movie Titles, and Things in a Kitchen; do not derive these from existing answer-card pack names.

## 3. Current-state evidence ledger

| Status | Evidence | Consequence |
|---|---|---|
| Confirmed | The app exposes only `impostor` and `charades` through `GameId` (`src/domain/types.ts:3`), persists `activeGameId`, and resolves recovery from explicit and available game state (`src/store/appStore.ts:6-44`). | Add Category Bomb to app-level routing and recovery, with tests for valid, stale, and legacy pointers. |
| Confirmed | `AppContent` owns local view routing, renders active games before setup views, and has one home card per game (`src/App.tsx:19-38`, `src/App.tsx:55-98`). | Add setup view, active-session branch, store selector, exit path, and third home card without changing the router dependency set. |
| Confirmed | `GameId` is also the input discriminator for pack eligibility; every non-Impostor value currently falls through to Charades filtering (`src/domain/packCompatibility.ts:28-44`). | Split app routing IDs from pack-consumer IDs, or explicitly narrow pack APIs. Simply adding `'category-bomb'` to the existing union would silently treat it as Charades. |
| Confirmed | Impostor setup uses `PlayerEditor`, which displays “3 minimum,” allows removing only above three, and has an unbounded Add action (`src/features/game/PlayerEditor.tsx:7-40`). | Build a Category Bomb roster editor or generalize the component with explicit `minPlayers`, `maxNameLength`, mode-threshold copy, and Radial-only reorder behavior; do not inherit current assumptions accidentally. |
| Confirmed | Charades models a pure phase machine with an absolute `deadlineMs`, injected randomness, stale-action tokens, exact expiry, and a persisted store that reconciles on hydration (`src/domain/charades.ts:58-71`, `src/domain/charades.ts:140-166`, `src/domain/charades.ts:186-255`; `src/store/charadesStore.ts:51-105`). | Follow the same deadline/injection/recovery pattern, but create Category Bomb-specific state and transitions. |
| Confirmed | The active Charades screen ticks every 200 ms and reconciles on focus, page show, and visibility changes (`src/features/charades/ActiveRoundScreen.tsx:18-55`). | Reuse the lifecycle pattern, but never derive or render remaining time. Timer callbacks call a store `syncClock(now)` command only. |
| Confirmed | Charades provides generated Web Audio, vibration, wake lock, and local sound/haptics preferences (`src/features/charades/audioSynth.ts:31-116`; `src/features/charades/haptics.ts:7-17`; `src/features/charades/wakeLock.ts:16-48`; `src/store/preferencesStore.ts:5-49`). | Extract or wrap device-agnostic adapters; add accepted-answer and explosion cues without coupling Category Bomb to Charades outcomes or motion controls. |
| Confirmed | Full-screen play already accounts for `100dvh`, safe-area insets, touch manipulation, overflow, long-word wrapping, portrait handling, and reduced motion (`src/styles.css:102-112`, `src/styles.css:358-390`, `src/styles.css:408-413`). | Extend the same CSS system with a square radial board plus a centered large-group name treatment, and test both portrait and landscape; no new layout dependency is required. |
| Confirmed | The PWA manifest allows any orientation and Workbox precaches JS/CSS/HTML/SVG/WOFF2 with an offline navigation fallback (`vite.config.ts:10-35`). | Category Bomb code and styles are included automatically; keep audio synthesized so no media asset/precache changes are needed. |
| Confirmed | README states the app is local-only/offline-first and documents pure-domain, Zustand, Workbox, Vitest, and Playwright ownership (`README.md:1-3`, `README.md:111-122`). | Update documentation and offline/privacy claims only after implementation verification. |
| Confirmed | Read-only baseline on 2026-11-20: `npm run test:run -- --reporter=dot` passed 23 files/200 tests; `npm run lint` passed; `npm run build` passed and generated a 13-entry PWA precache. | Implementation must preserve the green baseline and add focused Category Bomb checks. |
| Unverified | No browser or physical-device layout inspection was performed during planning. | Twelve-seat readability, corner crowding, 13+ central-name readability, large-roster setup performance, hold-to-foul ergonomics, sound/haptic feel, and phone-on-table reach need responsive and physical QA. |
| Unverified | Existing built-in answer packs contain words, not a curated Category Bomb category-prompt corpus (`src/domain/builtInPacks.ts:7-152`). | Category prompts need a new reviewed data owner; pack compatibility and Dexie schemas remain unchanged in v1. |

## 4. End-to-end impact and consumer map

```text
Home card
   ↓
CategoryBombSetupScreen
   ├─ roster (2+, unique, <=24 chars)
   ├─ derive display mode: <=12 radial; >=13 name-only
   ├─ turn policy (fair-cycle | chaos)
   └─ sound/haptics preferences
   ↓ validateCategoryBombSettings
Display-mode branch
   ├─ radial (2..12) → CategoryBombPlacementScreen
   │      ├─ fixed seat map (3 per edge)
   │      ├─ swap/reorder names to match the room
   │      └─ category preview + Arm bomb user gesture
   └─ name-only (13+) → CategoryBombReadyScreen
          └─ rules/category preview + Arm bomb user gesture
   ↓ createCategoryBombRound(settings, optionalSeatAssignments, categories, random, now)
categoryBombStore (persisted absolute deadline and shuffle state)
   ↓
CategoryBombActiveScreen
   ├─ acceptAnswer(token, now, random) → optional sampled bonus (capped) → choose next player
   ├─ callFoul(token, now) ───────────────────────┐
   └─ syncClock(now) on interval/focus/visibility │
                                                   ↓
CategoryBombExplosionScreen ← deadline expiry / foul
   ├─ exploded player + reason
   ├─ New bomb (same roster/layout/policy; new category/deadline)
   └─ Back to setup / exit home
```

| Producer / consumer / boundary | Required impact |
|---|---|
| App identity types | Introduce `AppGameId = 'impostor' | 'charades' | 'category-bomb'` for `appStore`; narrow pack APIs to `PackGameId = 'impostor' | 'charades'`. Preserve or deprecate the ambiguous `GameId` alias intentionally. |
| `appStore` | Resolve three optional active states, validate persisted discriminator on hydration, and keep deterministic legacy fallback ordering. Bump persistence version only if validation/migration is added. |
| `App.tsx` | Add Category Bomb setup, conditional placement/ready views, active session selector/branch, home card, exit/reset behavior, and recovery. Keep Impostor/Charades branches unchanged. |
| Category data | Add a static typed `CategoryBombPrompt[]` module. Prompt IDs, display text, and optional difficulty/tag fields are separate from `WordPack`/Dexie. |
| Domain engine | Own validation, derived display mode, Radial seat assignment validity, duration and pass-bonus sampling, category selection, turn queues, token/race rejection, extension cap, deadline expiry, foul result, and replay construction as pure functions. |
| Store | Inject random/clock/storage, persist the recoverable session under a new key, expose semantic commands, reject corrupt data, and reconcile elapsed deadlines during hydration. |
| Setup/placement UI | Collect settings; enforce player constraints; expose Fair cycle versus Chaos; arrange 2–12 names around the board; automatically replace placement with a ready screen at 13+; explain the active layout and self-moderation; unlock audio/acquire wake lock only from the Arm bomb gesture. |
| Active/result UI | In Radial mode render category, perimeter names, arrow, bomb, Foul hold control, explosion result, and replay/exit actions. In Large group mode render category, current name, bomb, Foul, and results with no arrow or perimeter roster. Never render deadline, remaining seconds, progress, countdown ticks, or hidden timer values in ARIA text. |
| Shared device services | Move truly generic audio/wake-lock pieces to a neutral module or add Category Bomb adapters around them. Preserve Charades public behavior and tests. Category Bomb uses no orientation/motion permission. |
| Preferences | Reuse global `soundEnabled` and `hapticsEnabled`; no new preference migration is needed unless Category Bomb-specific defaults are introduced. |
| CSS/accessibility | Add radial seat geometry, four text orientations, a centered name-only layout, long-name handling, focus states, touch sizes, safe areas, reduced motion, and semantic live announcements on player change/explosion. |
| Tests/docs/release | Add domain/store/component/app/E2E coverage, offline recovery, responsive screenshots/physical matrix, and README instructions. Existing game flows remain regression gates. |
| Backend/auth/API/jobs/audit | Not applicable: no backend or external contract exists. Local persisted state and accessible user feedback are the relevant boundaries. |

## 5. Conflicts, invariants, risks, and design options

### Invariants to preserve

- The timer is authoritative wall-clock state, never a decrementing UI counter.
- The hidden deadline is not shown numerically, graphically, audibly as a countdown, or exposed via accessibility text.
- Once `now >= deadlineMs`, an answer or foul cannot extend or alter the round; expiry wins the race exactly once.
- An action token/round ID prevents a delayed double tap, stale hold completion, or remounted control from changing a later turn/round.
- Fair cycle selects every player exactly once per cycle; a new cycle is reshuffled independently.
- Chaos never chooses the current player but may choose anyone else regardless of prior coverage.
- Every active player ID refers to exactly one current roster entry. Radial players each have one unique valid seat; name-only players have no seat assignment.
- Display mode is derived from roster length on creation, hydration, and roster edits. A 12-player round cannot hydrate as name-only, and a 13+ round cannot hydrate as radial.
- In Radial mode, the arrow derives from the active player's fixed seat geometry; it does not store an independently mutable angle. In Large group mode, no arrow element or angle exists.
- Refresh/background past the deadline resumes directly at the explosion result for the player who was active when time expired.
- Exiting releases intervals, hold timers, audio resources, wake locks, and active session state without touching other games or user packs.

### Main conflicts and risks

- **Speech cannot be validated locally without a new microphone/recognition system.** Self-moderation must be visible in rules and interaction copy; presenting automatic validity would be false.
- **`GameId` currently crosses app routing and pack compatibility.** Expanding it naively changes pack behavior for the new game.
- **Twelve names compete with a center category, arrow, and bomb on small phones.** Fixed three-per-edge geometry, a square board, name limits, wrapping, and physical QA are release gates.
- **Large rosters cannot be represented directionally around one phone.** At 13+, only the current name is rendered during play; rendering a tiny perimeter roster or a meaningless arrow would undermine the requested fallback.
- **An unbounded setup roster can become unwieldy.** Keep stable IDs, avoid quadratic validation/render work, test at least 50 players, and report practical limits from measured device evidence rather than inventing a silent cap.
- **A hidden random deadline is easy to accidentally leak.** Do not reuse Charades countdown UI/cues, CSS urgency state, or accessibility announcements.
- **Configurable deadline extension can make a round effectively endless.** A 10-second per-pass input ceiling, 100 ms sampling, and 15-second total extension cap preserve a bounded explosion window.
- **Foul input can be accidental or socially contentious.** Use hold-to-confirm, show the current player's name in the control copy, and record only a reason—not who called it.
- **Background throttling pauses intervals.** Absolute deadline reconciliation on focus/visibility/hydration is mandatory.
- **Persisted corruption or old app pointers can blank the shell.** Validate both app discriminator and Category Bomb session shape, failing safely to setup/home.

### Feasible designs

1. **Standalone domain/store with derived Radial/Name-only presentation and shared low-level device adapters — recommended.** Category Bomb gets exact concepts and recovery without destabilizing Charades. One turn engine serves both layouts; only placement and active presentation branch.
2. **Add Category Bomb as a fifth Charades mode.** Reuses a store and screens, but `CharadesSession` assumes answer cards, visible duration, correct/pass outcomes, scoring, and turn summaries. Category Bomb would add conditional fields throughout and weaken both engines.
3. **Create a generalized party-game engine first.** Could abstract deadlines, decks, routing, and devices, but no third proven shared contract exists yet. This turns one game into a cross-repository redesign and raises regression/rollback cost.

## 6. Recommended architecture, data flow, security, and error behavior

### Proposed contracts

Create `src/domain/categoryBomb.ts` with contracts equivalent to:

```ts
type CategoryBombPhase = 'PLACEMENT' | 'READY' | 'ACTIVE' | 'EXPLODED'
type CategoryBombTurnPolicy = 'fair-cycle' | 'chaos'
type CategoryBombExplosionReason = 'timer' | 'foul'
type CategoryBombDisplayMode = 'radial' | 'name-only'
type CategoryBombSeat =
  | 'top-left' | 'top-center' | 'top-right'
  | 'right-top' | 'right-center' | 'right-bottom'
  | 'bottom-right' | 'bottom-center' | 'bottom-left'
  | 'left-bottom' | 'left-center' | 'left-top'

interface CategoryBombPlayer { id: string; name: string; seat: CategoryBombSeat | null }
interface CategoryBombSettings {
  players: CategoryBombPlayer[]
  turnPolicy: CategoryBombTurnPolicy
  passTimeBonusEnabled: boolean
  passTimeBonusMinMs: number
  passTimeBonusMaxMs: number
}
interface CategoryBombRound {
  id: string
  phase: CategoryBombPhase
  settings: CategoryBombSettings
  displayMode: CategoryBombDisplayMode
  categoryId: string
  categoryLabel: string
  currentPlayerId: string | null
  remainingCyclePlayerIds: string[]
  deadlineMs: number | null
  extensionGrantedMs: number
  lastAppliedPassBonusMs: number
  actionToken: number
  explodedPlayerId: string | null
  explosionReason: CategoryBombExplosionReason | null
}
```

Keep random sampling and IDs injectable. Derive and validate `displayMode` from `players.length`; it is included in the snapshot only to make rendering explicit and must be rejected or normalized if it disagrees with the roster. Store no displayed countdown. Store the sampled absolute deadline because recovery must preserve the same bomb rather than re-roll it.

### Display, seat, and arrow model

- `deriveCategoryBombDisplayMode(playerCount)` returns `radial` for 2–12 and `name-only` for 13+. The threshold is domain policy, not a CSS media query.
- In Radial mode, define twelve semantic seats in clockwise order, three per side. For fewer players, distribute them across sides with a deterministic “largest angular gap first” policy so two players face opposite sides, three form a balanced triangle, four use side centers, and additional players fill corner-adjacent seats symmetrically.
- Placement may swap players only among the active seats; changing player count recomputes a balanced initial layout.
- Map each seat to a normalized board target `(x, y)` and text rotation. Compute arrow angle with `atan2(targetY - centerY, targetX - centerX)`.
- Top labels rotate 180°, right labels -90°, bottom labels 0°, and left labels 90°, so each name reads from the corresponding side of the table.
- Render the play surface as a centered square sized by `min(100vw, 100dvh)` with safe-area padding. Extra rectangular space may hold Exit/Foul controls, but cannot change seat geometry.
- In Large group mode, set every player `seat` to `null`, skip seat validation/geometry, omit the arrow and perimeter roster from the DOM, and render the current player's full name centrally with responsive wrapping. A short visible instruction such as “Pass to” disambiguates the name from the category.

### Round and turn flow

1. Setup creates stable player IDs, validates names/count/policy, and derives the display mode.
2. Radial mode enters `PLACEMENT`, assigns each player one active seat, and shows a live arrow preview for the selected name. Large group mode sets all seats to `null` and enters `READY` without placement.
3. **Arm bomb** is the required user gesture in either branch: select a category, sample duration, build turn state, unlock sound, request wake lock, and enter `ACTIVE`.
4. In Fair cycle, shuffle all player IDs, shift the first as current, and retain the remainder. On accepted answer, shift again; when empty, reshuffle all IDs and rotate the order if the outgoing current player would be first.
5. In Chaos, sample uniformly from all player IDs except the outgoing current player.
6. `acceptAnswer(round, token, now, random)` first synchronizes expiry. If still active and token matches, sample uniformly from the inclusive configured 100 ms range only when enabled, apply no more than the remaining 15-second cap allowance, record the actual applied value for feedback, select the next player, and increment `actionToken` atomically. Disabled, stale, and late passes consume no bonus random draw.
7. `callFoul(round, token, now)` first synchronizes expiry. If active and current, set `EXPLODED`, retain the current player as exploded, and set reason `foul`.
8. `syncClock(round, now)` sets the current player as exploded with reason `timer` when the absolute deadline is reached.
9. **New bomb** retains names, display mode, Radial seats when applicable, and policy; picks another category when possible; resets extensions/queue/result; samples a new deadline; and starts from another random player without promising exclusion across rounds.

### UI behavior

- **Setup:** player fields, 2 minimum copy, an inline mode notice that changes from “Radial board” to “Large group — current name only” when the thirteenth player is added, Fair cycle default, Chaos alternative, sound/haptics toggles, and concise rules. Removing back to twelve restores Radial mode and generates a fresh balanced seat proposal.
- **Radial placement:** “Place the phone in the center. Move each name so the arrow points toward that person.” Show all active seats and allow tap-select then tap-seat as an accessible fallback to drag. Announce swaps in an `aria-live="polite"` region.
- **Large group ready:** “Pass the phone to the name shown. The arrow and seating board are hidden for large groups.” Show category/rules and Arm bomb; do not show a fake placement preview.
- **Radial active:** show category, central arrow, all 2–12 name tags, and a large semantic button labeled `Accept {name}'s answer and pass`.
- **Large group active:** show `Pass to` plus the current player's name as the largest text, the category, and the same semantic bomb button. Do not render an arrow, angle, empty seat grid, or full roster.
- **Both active layouts:** when enabled and the actual applied bonus is positive, briefly show `+{actualSeconds}s` for at most 300 ms; reveal only the applied award, never remaining time. Show no bonus copy while disabled or after the cap is exhausted.
- **Foul:** separate hold control labeled `Hold to explode {name} for an invalid or repeated answer`. Keyboard users hold Space/Enter for the same duration; Escape/pointer cancellation aborts the hold.
- **Explosion:** generated cue, non-strobing flash, optional distinct vibration, “{name} got exploded,” reason copy, New bomb, Rearrange players, and Exit.
- **Accessibility:** in Radial mode the arrow is decorative and the active player's name is exposed as text/status. All rotated names retain normal DOM reading order and unrotated accessible labels. In Large group mode the central name is the status and focus/announcement target; no hidden arrow description is emitted. Reduced motion removes arrow spin/flash animation but not state text.

### Security, privacy, and error behavior

- Never request microphone access or imply the app heard an answer.
- Category Bomb state stays in a new localStorage key; do not put it in Dexie or transmit it.
- If wake lock, audio, or vibration fails, continue silently with visible feedback. Setup toggles remain preferences, not capability promises.
- If persisted state is malformed, discard only the Category Bomb session and clear a stale active-game pointer; preserve Impostor, Charades, preferences, and packs.
- If the page resumes after deadline, go directly to EXPLODED without replaying queued answer feedback.
- If no audio context can unlock, Arm bomb still starts. If fewer than two category prompts exist because of a development error, validation blocks start with a local error instead of looping during “different category” selection.

## 7. Contract, schema, migration, and compatibility changes

| Area | Planned change | Compatibility behavior |
|---|---|---|
| App game discriminator | Split `GameId` into app and pack scopes; add `'category-bomb'` only to the app scope. | Existing `'impostor'`/`'charades'` values remain valid. Unknown persisted values normalize to `null`. |
| `resolveActiveGame` | Accept Category Bomb availability and explicit pointer; return only when corresponding state exists. | Preserve existing Impostor-then-Charades legacy inference; add Category Bomb after them unless an explicit valid pointer exists. Test simultaneous stale states. |
| Category prompt data | New source-controlled typed array, no `WordPack` changes. | Custom packs and Dexie schema/version are untouched. |
| Category Bomb display contract | Derive `radial` at 2–12 players and `name-only` at 13+; Radial requires unique seats, Name-only requires all seats to be `null`. | Hydration normalizes or rejects snapshots whose mode/seats disagree with roster size. Crossing the threshold during setup recomputes/discards seats before a round starts. |
| Category Bomb store | New version-1 key such as `moldyparty-category-bomb`; persist setup, derived display mode, optional placement, active, and result session. | No migration on first release. Runtime shape guard drops corrupt/unknown future state safely. |
| Preferences | Reuse `soundEnabled` and `hapticsEnabled`. | No version bump required. |
| Device adapters | Add neutral cues/patterns or Category Bomb wrappers. | Existing Charades cue names and behavior remain covered; no audio assets added. |
| PWA | New source modules enter existing JS/CSS precache. | No manifest orientation or Workbox pattern change required. |
| README | Add third game flow and clarify locally stored roster/round state. | Existing game and pack documentation remains valid. |

No backend API, event, job, database migration, auth policy, or external consumer changes exist.

## 8. Ordered implementation phases with exact owners

### Phase 1 — Untangle app identity from pack identity

**Owners:** `src/domain/types.ts`, `src/domain/packCompatibility.ts`, `src/store/appStore.ts`, their tests.

1. Add/narrow `AppGameId` and `PackGameId`; update imports and compile-time consumers.
2. Extend `resolveActiveGame` and persisted-value validation for Category Bomb without changing existing precedence unexpectedly.
3. Add regression tests proving Category Bomb cannot be passed to pack eligibility and stale app pointers recover safely.

### Phase 2 — Category Bomb data and pure domain

**Owners:** new `src/domain/categoryBombCategories.ts`, `src/domain/categoryBomb.ts`, `src/domain/categoryBomb.test.ts`.

1. Define prompts, players, display modes, optional seats, settings, phases, reasons, and validation.
2. Implement the 12/13 display threshold, balanced Radial seat allocation, seat/arrow geometry metadata, Name-only seat clearing, duration sampling, category selection, and replay category avoidance.
3. Implement Fair cycle and Chaos selection with deterministic injected random tests.
4. Implement accept/foul/expiry/replay transitions, enabled/disabled random-bonus behavior, extension/cap arithmetic, action tokens, and exact boundary precedence.

### Phase 3 — Persisted command store and recovery

**Owners:** new `src/store/categoryBombStore.ts`, `src/store/categoryBombStore.test.ts`.

1. Expose setup, Radial placement swap, Name-only ready transition, arm, accept answer, call foul, sync clock, replay, return to the mode-appropriate pre-round screen, and reset commands.
2. Inject clock/random/storage; persist only the session; guard hydration shape.
3. Reconcile expired deadlines on hydration and prove corrupt Category Bomb data does not alter other storage.

### Phase 4 — Setup, Radial placement, and Large group ready experience

**Owners:** new `src/features/category-bomb/CategoryBombSetupScreen.tsx`, `CategoryBombPlacementScreen.tsx`, focused tests, `src/styles.css`.

1. Build roster editing with stable IDs, unique trimmed names, length feedback, add/remove, linear-time validation, and keyboard-accessible Radial reorder/swap.
2. Add the derived Radial/Large group notice, turn-policy and device preference controls, threshold-transition behavior, and mode-specific rule copy.
3. Render balanced seats, four text directions, arrow preview, safe areas, and long-name behavior for 2–12 players.
4. Render a separate 13+ ready screen with no seats or arrow and prove setup remains usable with at least 50 players.
5. Make Arm bomb the explicit audio/wake-lock user gesture; keep capability failures non-blocking.

### Phase 5 — Active board, foul, explosion, and device feedback

**Owners:** new `CategoryBombGame.tsx`, `CategoryBombActiveScreen.tsx`, `CategoryBombExplosionScreen.tsx`, `useCategoryBombDevices.ts`; neutralized/shared device adapters as needed; component tests; `src/styles.css`.

1. Render the full Radial board and a separate Large group central-name board, each with semantic active-player status and no timer leakage.
2. Implement answer tap debounce/token handling, conditional actual-award flash, conditional Radial arrow transition, Name-only live-name update, and 200 ms clock reconciliation plus focus/page-show/visibility listeners.
3. Implement cancelable 600 ms Foul hold for pointer and keyboard, including expiry races.
4. Add accepted/explosion audio and haptic patterns, wake-lock lifecycle, reduced motion, and cleanup.

### Phase 6 — App-shell integration and recovery

**Owners:** `src/App.tsx`, `src/App.test.tsx`, `src/store/appStore.test.ts`, home-card CSS.

1. Add setup, conditional Radial placement/Large group ready views, active-game selector, third card, and explicit exit paths.
2. Ensure refresh routes an active or exploded persisted round back to Category Bomb.
3. Reset only Category Bomb state on exit; preserve the other game stores.

### Phase 7 — End-to-end, offline, and documentation

**Owners:** new `e2e/category-bomb-flow.spec.ts`, existing offline suite as appropriate, `README.md`, release QA notes.

1. Cover setup, the 12-to-13 and 13-to-12 display transition, conditional placement/ready flow, Fair cycle, Chaos repeat-before-coverage, answer extension, foul, hidden expiry, replay, exit, and refresh recovery with deterministic clock/random seams where practical.
2. Exercise 2-, 4-, 8-, and 12-player Radial layouts plus 13- and 50-player Name-only flows at mobile portrait/landscape and desktop viewports; capture/inspect screenshots for overlap and verify no arrow/perimeter roster exists in Name-only DOM output.
3. Verify production build/offline reload, precache, no media/network requests, and regress existing E2E flows.
4. Run physical iOS Safari/PWA and Android Chrome/PWA checks before release; tune only centralized duration/layout constants with corresponding test updates.

## 9. Verification matrix and acceptance criteria

| Requirement | Evidence | Acceptance criterion |
|---|---|---|
| Roster and mode threshold | Domain + setup tests | 2 or more unique, non-empty, trimmed names accepted; 1, duplicates, blanks, and >24 characters rejected. Counts 2–12 derive Radial and 13+ derive Name-only; adding/removing across the boundary changes the pre-round UI and seat state correctly. |
| Radial placement/layout | Domain geometry + component screenshots + physical QA | Every 2–12 player has one unique seat; 2/4/8/12 layouts are balanced; twelve long valid names remain readable and do not cover the bomb/category/Foul controls. |
| Large group/name-only layout | Domain/component/E2E + performance observation | At 13 and 50 players, all seats are null, placement is skipped, current name/category/bomb/Foul remain readable, turn selection includes the full roster, and no arrow, angle, perimeter name tag, or full active roster is rendered. |
| Four directions | Component/style inspection | Top/right/bottom/left names face their side of the table; accessible names are not reversed or lost. |
| Arrow/name accuracy | Pure geometry + component tests + visual QA | In Radial mode every seat angle targets its seat center. In Name-only mode changing player updates the visible/announced central name atomically and never creates an arrow. |
| Fair cycle | Deterministic domain tests | No player repeats until all have appeared once; each new cycle includes everyone exactly once; boundary avoids same-player handoff. |
| Chaos mode | Deterministic domain tests | Current player is excluded; a previous player may recur before full roster coverage. |
| Random duration | Boundary/distribution-seam tests | Sample is inclusive and within formula bounds for 2, 12, 13, and 50 players; invalid random edge values are clamped safely. |
| Hidden timer | DOM/accessibility/component/E2E inspection | No remaining time, deadline, progress, urgency class, or countdown tick is visible or announced during active play. |
| Pass-time bonus | Fake random/clock domain/store/component tests | New setup is disabled with retained 0.5–3.0-second values. Enabled passes sample inclusive 100 ms values, apply only the remaining 15-second cap allowance, show the actual award, and reject malformed ranges and stale/double/late actions. |
| Expiry | Fake clock + hydration tests | `now >= deadlineMs` explodes the current player exactly once; background/refresh produces the same result without re-rolling. |
| Invalid/repeat | Hold-control component tests | Foul fires only after uninterrupted 600 ms, is cancelable, labels the active player, loses to prior timer expiry, and records reason `foul`. |
| Explosion/replay | Domain/component/E2E | Correct player and reason shown; New bomb retains roster/display mode/applicable seats/policy, resets cap/queue, samples a new deadline, and avoids the previous category when possible. |
| Device fallback | Adapter/component/physical QA | Audio/haptics/wake-lock success and failure never block play; preferences apply; resources release on result/exit/unmount. |
| Recovery isolation | Store/app tests | Corrupt Category Bomb data fails safe; valid state recovers; Impostor, Charades, preferences, and packs are unchanged. |
| Offline/privacy | Production build + offline E2E + source/network inspection | Full flow works after offline reload; no microphone prompt, gameplay transmission, audio asset, or new remote request exists. |
| Regression | Existing automated suites | All existing unit/component/E2E tests, lint, TypeScript build, and PWA build remain green. |

Feature acceptance requires all automated rows, clean lint/build, responsive screenshot review, and the physical mobile matrix. A device API failure is acceptable only when touch, text, and visual feedback still complete the game.

## 10. Rollout, rollback, observability, cleanup, and unverified boundaries

### Rollout

1. Land identity-type separation and pure domain/store behind no home-card entry.
2. Add setup/conditional pre-round/active screens and complete automated/offline checks while the card remains unlinked if a feature branch requires staged work.
3. Enable the home card only after 12-player Radial and 13+/50-player Name-only responsive gates plus physical-device checks pass.
4. Tune centralized timer/extension/layout constants from playtest evidence; avoid scattered CSS or UI overrides.

### Rollback

- Remove/hide the Category Bomb home card and app branches, leaving its isolated localStorage key inert.
- Preserve the app/pack ID type split because it fixes a real boundary ambiguity and is backward-compatible.
- Do not delete Category Bomb local state automatically during rollback without separate authorization; it contains player names and a potentially unfinished round but no schema dependency.
- No Dexie downgrade, pack migration, service worker data migration, or server rollback is required.

### Observability

This local-only app has no telemetry. Use deterministic domain/store tests, accessible in-app error/capability states, production offline E2E, screenshot review, and dated physical-device QA notes. Do not add analytics solely for Category Bomb.

### Cleanup requirements

- Clear tick intervals, focus/page-show/visibility listeners, foul hold timers, short feedback timers, audio contexts, and wake locks on phase exit/unmount.
- Keep only one canonical category prompt module and one seat geometry table.
- Do not leave Category Bomb conditions in Charades domain/store types.
- Keep generated `dist`, Playwright reports, screenshots not intended as fixtures, and test results uncommitted.

### Unverified boundaries

1. Twelve-player Radial readability/finger reach and 13+ central-name readability on the smallest supported physical phones are unverified until device testing.
2. The proposed duration formula, default 0.5–3.0-second enabled range, 0.0–10.0 input bounds, 100 ms granularity, 15-second cap, and 600 ms foul hold are reasoned starting values, not playtested balance.
3. Final category prompt content, cultural fit, localization, difficulty spread, and safe-answer breadth are not yet curated.
4. iOS/Android wake-lock, vibration, audio under hardware mute, and installed-PWA behavior remain browser/device dependent.
5. Drag behavior under rotated labels is unverified; tap-select/tap-seat remains the required accessible fallback for Radial mode. Name-only mode has no drag interaction.
6. Practical setup performance for very large rosters is unverified. Fifty players is the required automated/observed baseline, not a claimed browser maximum.
7. The exact minimum supported viewport is not documented in the repository; current Charades CSS declares a 320 px active-screen minimum (`src/styles.css:366`), which should be treated as the initial Category Bomb floor and validated physically.

## 11. Self-review result

- **Unsupported claims:** physical behavior, balance, prompt quality, and browser capabilities remain explicitly unverified.
- **Consumer coverage:** app identity, pack narrowing, routing, domain, store, persistence, preferences, device adapters, UI/CSS, PWA, tests, docs, rollout, and rollback are mapped.
- **Contract safety:** the plan prevents Category Bomb from falling through the Charades pack branch and keeps its schema isolated.
- **Mode safety:** the 12/13 threshold, optional seat contract, conditional pre-round flow, hydration behavior, and no-arrow Name-only DOM invariant are explicit.
- **Race safety:** absolute deadline precedence, action tokens, background reconciliation, hold cancellation, and replay reset are explicit.
- **Scope control:** no speech recognition, custom packs, stats, backend, analytics, dependency, or generalized game-engine redesign is included.
- **Accessibility:** rotated Radial labels retain readable DOM names; arrow state is duplicated in text; Large group uses a central live name with no phantom arrow semantics; Foul has keyboard/cancel behavior; time remains intentionally hidden from every audience.
- **Repository hygiene:** this planning artifact is the only intentional source change and is not committed.

