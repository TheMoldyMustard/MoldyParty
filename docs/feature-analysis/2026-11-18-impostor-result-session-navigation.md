# Impostor result navigation and session-card isolation analysis

## 1. Executive verdict

**Scope assumption.** This analysis covers two connected Impostor experiences: (1) the completed-round actions that should open category selection or leave the active session, and (2) the saved-session manager interaction where the session card itself continues play and secondary actions live on that card as icons. “Edit” is not assumed to mean roster mutation because the repository has no edit-session contract and deliberately locks saved rosters.

**Owners.** App-level view routing is owned by `src/App.tsx`; result actions by `src/features/game/GameOverScreen.tsx`; session selection and secondary actions by `src/features/game/SessionManagerScreen.tsx`; setup/category presentation by `src/features/game/{LobbyScreen,CategoryPicker,PlayerEditor}.tsx`; session identity, completed-round cleanup, and persistence by `src/store/gameStore.ts` and `src/domain/types.ts`.

**Verdict.** The requested UX is feasible with moderate UI work, but the category path is coupled to persisted session identity and cannot safely be fixed by changing `setView('sessions')` to `setView('lobby')` alone. `changeCategory()` currently clears `activeSessionId`, while `startGame()` creates a new session whenever no active session exists. A view-only redirect would therefore split later statistics into a second session. In addition, the stored `lobbyIntent: 'category'` has no UI consumer, and App-local `lobbyDraft` can override the store’s newest setup when the lobby remounts.

The session-card change is mostly presentational: card selection and the global Continue/View/Delete action strip can be replaced by a primary card surface plus sibling icon actions. The card cannot remain a `<button>` containing icon buttons, because nested interactive controls are invalid and unreliable for keyboard/screen-reader users. Use a non-interactive card container, one large labeled continue button, and sibling icon buttons with accessible names.

**Coupling and risk.** Coupling is moderate-high at the completed-round/store boundary and low-moderate in the session-card UI. The main risks are accidental new-session creation, stale setup restoration, player-stat identity corruption if “edit” changes the roster, invalid nested controls, and regressions in delete-dialog focus restoration and existing test selectors.

**Recommendation.** First separate “continue this session in category setup” from “leave this session for the manager.” Preserve `activeSessionId` for category changes, clear only the completed `currentGame`, reset App’s draft projection, navigate to the lobby, and consume the category intent by focusing/scrolling the category section. Then refactor each session card into a primary continue surface with per-card View stats and Delete icon buttons. Do not add an Edit icon until its meaning is fixed; a safe first edit contract is session-name rename only. Roster editing requires an explicit statistics/identity policy.

## 2. Feature anatomy

### Current flows

1. `GameOverScreen` renders Play again, Group Vote, Change category, and Return to lobby. Only the last two delegate to `AppContent` (`src/features/game/GameOverScreen.tsx:73-78`).
2. Both App callbacks invoke a store action and then set the top-level view to `sessions`, so both visibly land on the session manager (`src/App.tsx:40-43`). The end-to-end suite locks this in for Return to lobby (`e2e/game-flow.spec.ts:214-217`).
3. `changeCategory()` and `returnToLobby()` both clear a completed session’s `currentGame`, clear `activeSessionId`, and clear transient round state. Their only semantic difference is `lobbyIntent` (`category` versus `default`) (`src/store/gameStore.ts:679-715`).
4. `LobbyScreen` restores from App-local `savedDraft` before store `setup`, renders players before categories, and never reads `lobbyIntent` (`src/features/game/LobbyScreen.tsx:35-53,109-143`). Consequently, the category intent is persisted but dormant.
5. `startGame()` updates an existing record only when `activeSessionId` resolves to a saved session; otherwise it creates a new `SessionRecord` with zeroed statistics (`src/store/gameStore.ts:469-499`).
6. The session manager sorts sessions by `updatedAt`, selects the first by default, makes each card update `selectedId`, and renders Continue/View/Delete for the selected record in a separate action strip (`src/features/game/SessionManagerScreen.tsx:14-28,84-106`).
7. Continue selects the session in the store, then App either resumes its `currentGame` or opens the setup lobby (`src/App.tsx:55-61`; `src/store/gameStore.ts:423-433`). Saved-session setup locks the roster (`src/App.tsx:63`; `src/features/game/PlayerEditor.tsx:7-40`).
8. Stats are a local read-only subview. Delete is persistent, destructive, confirmed by a modal, and restores focus to the one global delete trigger (`src/features/game/SessionManagerScreen.tsx:30-78,113-118`).

### State, persistence, and side effects

- `SessionRecord` owns the session name, stable player identities, setup, cumulative stats, and optional current game (`src/domain/types.ts:121-136`).
- The Zustand persistence slice stores `sessionsById`, `activeSessionId`, `setup`, `game`, and `lobbyIntent`; hydration derives the active setup/game from the validated active session (`src/store/gameStore.ts:720-758`). There is no server, job, event bus, audit sink, or external integration in this path.
- Completed statistics are already recorded before the result actions are used. Category navigation must clear the completed `currentGame` without altering `completedRounds` or `statsByPlayerId`.
- `lobbyDraft` is a second setup projection owned by `AppContent`. Because `LobbyScreen` prefers it over store setup, result-to-category navigation should reset it before mounting the lobby (`src/App.tsx:22-24,57,63`; `src/features/game/LobbyScreen.tsx:50-53`).
- The focused baseline passed: `npm run test:run -- src/App.test.tsx src/store/gameStore.test.ts --reporter=dot` (2 files, 45 tests) on 2026-11-18.

## 3. Cascade map

| Edge | Provider | Interface | Consumer | Effect | Risk | Confidence | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|
| E1 | Result UI | `onChangeCategory`, `onReturnToLobby` | `AppContent` callbacks | Direct navigation request after a completed round | Medium | Confirmed | `src/features/game/GameOverScreen.tsx:6-11,73-78` | Keep callbacks; give destinations distinct semantics |
| E2 | App router | store action + `setView('sessions')` | Session manager | Direct cause of both result exits landing on Sessions | High | Confirmed | `src/App.tsx:40-43` | Change category to Lobby; retain an explicit Sessions exit |
| E3 | Game store | `changeCategory()` | registry, active projection, intent | Directly clears completed `currentGame`, `activeSessionId`, game/transients; sets category intent | High | Confirmed | `src/store/gameStore.ts:679-696` | Preserve active session for category continuation |
| E4 | Game store | `returnToLobby()` | registry, active projection, intent | Directly clears completed `currentGame`, active session, game/transients | Medium | Confirmed | `src/store/gameStore.ts:698-715` | Rename/reframe as return to Sessions to match actual destination |
| E5 | Store persistence | `partialize` / `merge` | reload recovery | Persisted session, setup, game, active ID, and intent; active session is canonical on hydration | High | Confirmed | `src/store/gameStore.ts:720-758` | Preserve schema compatibility; validate reload from category setup |
| E6 | App draft state | `lobbyDraft` prop | `LobbyScreen` initialization | Transitive stale-draft risk because saved draft wins over store setup | High | Confirmed | `src/App.tsx:22-24,63`; `src/features/game/LobbyScreen.tsx:50-53` | Clear/rebuild draft on result-to-category transition |
| E7 | Lobby | `previousSetup`, `startGame()` | Game store | Directly resumes an existing session only when `activeSessionId` is retained | High | Confirmed | `src/features/game/LobbyScreen.tsx:51-53,91-107`; `src/store/gameStore.ts:469-499` | Treat active session preservation as an invariant |
| E8 | Category intent | `lobbyIntent: 'category'` | No production UI consumer | Dormant persisted signal; currently produces no focus/scroll behavior | Medium | Confirmed | producer/search: `src/store/gameStore.ts:256,695,732`; only tests otherwise at `src/store/gameStore.test.ts:437-448` | Consume at lobby/category boundary or remove in a later cleanup |
| E9 | Session registry | `sessionsById` sorted by `updatedAt` | Session cards | Direct card list and initial selection | Low | Confirmed | `src/features/game/SessionManagerScreen.tsx:12-28` | Keep ordering; selection state becomes unnecessary for primary flow |
| E10 | Session card | `setSelectedId()` | global action strip | Direct two-step card → Continue/View/Delete interaction | Medium | Confirmed | `src/features/game/SessionManagerScreen.tsx:84-106` | Replace with card-level primary/secondary actions |
| E11 | Continue action | `onContinue(id)` → `continueSession(id)` | restored game or lobby | Direct session selection/resume | High | Confirmed | `src/App.tsx:55-61`; `src/store/gameStore.ts:423-433` | Reuse for the card’s primary click |
| E12 | Stats action | `statsSessionId` | `SessionStatsTable` subview | Direct, read-only inspection without starting a round | Low | Confirmed | `src/features/game/SessionManagerScreen.tsx:21,27,74-78,103` | Move to per-card icon; keep read-only semantics |
| E13 | Delete action | `deleteSessionId`, modal, `deleteSession(id)` | local registry and active projections | Direct destructive removal with focus containment/restoration | High | Confirmed | `src/features/game/SessionManagerScreen.tsx:22-67,104,113-118`; `src/store/gameStore.ts:435-446` | Move trigger per card; preserve named confirmation and keyed focus restoration |
| E14 | Session edit | no public store action | requested Edit icon | Uncertain: rename, setup edit, and roster edit have different data effects | High | Confirmed absence / Unverified intent | `GameStoreState` exposes create/continue/delete only at `src/store/gameStore.ts:258-295`; roster is locked at `src/features/game/PlayerEditor.tsx:24-40` | Define before implementation; do not fake with a duplicate Continue action |
| E15 | CSS/accessibility | `.session-card`, `.session-actions`, global 48px buttons | desktop/mobile session UI | Direct layout and target sizing; nested buttons would violate interaction semantics | Medium | Confirmed | `src/styles.css:30,131,235-242,302-307` | Use container + sibling buttons; retain ≥48px targets and visible focus |
| E16 | Tests/docs | role/name selectors and documented manager workflow | implementation and releases | Operational compatibility: current tests assume selected card/global controls | Medium | Confirmed | `src/App.test.tsx:46-98,184-248`; `e2e/game-flow.spec.ts:214-247,295-303`; `README.md:60-64` | Rewrite selectors and document direct card continuation |

## 4. Isolation and ordered change plan

### Phase 1 — Separate session continuation from session exit

**Edges:** E1-E8.

1. Establish two explicit destinations: Change category continues the current saved session in setup; Return to Sessions leaves it at the manager. Product copy should use “Return to sessions,” not “Return to lobby,” because Lobby currently means setup elsewhere.
2. Refactor the store boundary so the category command clears the completed round and transient inputs but retains `activeSessionId`, the session record, cumulative stats, and setup. The Sessions-exit command may clear `activeSessionId` as today.
3. In App, reset `lobbyDraft` and route Change category to `lobby`; route Return to Sessions to `sessions`.
4. Consume the category intent at the UI boundary. Give the category heading/section a ref, scroll it into view after packs load/layout, and move programmatic focus to an appropriate heading or selected category without auto-activating a choice. Reset the one-shot intent after consumption to prevent repeated scroll on reload/back navigation.

**Compatibility.** Keep persisted version 4 readable. A retained active session already matches the current `merge` model; no schema addition is required if intent remains the existing union.

**Validation.** Store tests must prove session ID, roster IDs, completed-round count, and stats remain unchanged through Change category and the next start; component/E2E tests must prove the category section is reached directly, the next round updates the same session, Return to Sessions still reaches the manager, and reload at setup does not restore the completed result.

**Rollback.** Revert the App destination and store command together. Reverting only one side can either recreate the original redirect or create duplicate sessions.

### Phase 2 — Make each card the primary Continue control

**Edges:** E9-E13, E15-E16.

1. Remove `selectedId` and the selected-card/global-action dependency.
2. Render each session as a semantic container (`article`/`li`). Put a large primary button over the card’s information that invokes `onContinue(session.id)`. Place View stats and Delete as sibling icon buttons in a per-card action group.
3. Give icon-only buttons stable accessible names such as `View stats for Friday Crew` and `Delete Friday Crew`; the glyph must be `aria-hidden`. Retain at least 48px targets, keyboard focus styles, and enough separation to prevent destructive mis-taps.
4. Change delete focus restoration from the single global `deleteButtonRef` to the exact initiating card action, keyed by session ID or captured when opening the dialog. After deletion, move focus deterministically to the next card, previous card, or Create action.

**Compatibility.** Store contracts and persisted data remain unchanged. Tests and E2E selectors must move from generic global action names to card-scoped accessible names.

**Validation.** Test mouse and keyboard activation of the card, non-propagation of View/Delete, stats remaining read-only, confirmation naming the correct session, Escape/cancel restoring focus to the correct icon, and desktop/mobile wrapping without overlap.

**Rollback.** The UI can return to selected-card/global actions without store migration. Keep the modal behavior in one reusable path so rollback does not fork destructive logic.

### Phase 3 — Define Edit before adding it

**Edge:** E14.

- **Recommended bounded option:** Edit session name only. Add a validated `renameSession(id, name)` action that changes `name` and `updatedAt` without touching roster, setup, stats, or `currentGame`.
- **If Edit means setup/rules/category:** card click already opens setup when there is no unfinished game; a separate Edit icon would need a defined rule for sessions with `currentGame` and otherwise duplicates Continue.
- **If Edit means roster:** stop and design identity migration. Adding/removing/renaming players changes keys in `statsByPlayerId`, roster-to-round consistency, and historical attribution. Do not implement this as array replacement.

**Validation and rollback.** Name-only edit needs blank/trim/default rules, persistence/reload tests, collision policy if names must be unique, and focus return. It is independently rollbackable because it does not change the record schema. Roster edit is not safely rollbackable without a migration policy and is outside this bounded change.

## 5. Improvements

### Required decoupling

- Replace the overloaded result exit behavior with destination-specific commands and names.
- Make the session record, not App-local view state, the invariant that determines whether the next round belongs to the same statistics history.
- Consume or remove `lobbyIntent`; leaving it persisted but behaviorless invites future routing drift.
- Separate the card’s primary control from its secondary icon controls at the DOM level.

### Optional evidence-backed enhancements

1. Show whether a card has an unfinished round so “Continue” versus “Set up next round” is predictable; `SessionRecord.currentGame` already contains the fact.
2. Add lightweight tooltips for pointer users while retaining `aria-label` as the accessible name for icon actions.
3. Rename `returnToLobby` to `returnToSessions` after all consumers are updated; its current name conflicts with actual App routing.
4. Make the session list a semantic `<ul>`/`li>` collection to improve navigation announcements once each card contains multiple controls.
5. Keep Create new session outside per-card actions as the single list-level primary action.

## 6. Uncertainty and coverage boundary

- “Edit” is materially ambiguous. The repository supports editing round setup after Continue but explicitly locks saved rosters; no session rename/update action exists. This report recommends name-only editing unless product explicitly chooses a larger identity migration.
- It is unclear whether “back to category” means merely render the setup page containing categories or place keyboard/viewport focus on the category section. The existing `lobbyIntent: 'category'` strongly suggests the latter, so the recommendation includes focus/scroll behavior.
- The desired final copy and destination for the current “Return to lobby” action were not explicitly stated. Existing behavior and documentation treat it as a return to the session manager; the report preserves that behavior under clearer “Return to sessions” wording.
- Runtime visual inspection was not needed to establish the dependency graph; responsive recommendations are based on current markup/CSS and existing desktop/mobile E2E coverage. Focused App/store tests passed, but no implementation-specific tests were added because this skill permits analysis only.
- Coverage includes source, focused tests, E2E flows, persistence contracts, README, and relevant prior design/analysis documents. Generated output, dependencies, lockfiles, Charades, pack CRUD internals, and unrelated game phases were excluded. A final focused consumer search found no additional dependency within the inspected scope.
