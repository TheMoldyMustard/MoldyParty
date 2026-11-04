# Abort and Session UI isolation analysis

## 1. Executive verdict

**Scope assumption.** “Abort and Session” means the shared active-round `Abort game` control and confirmation dialog, plus the Impostor session manager, create form, delete dialog, and statistics table. The owning UI is `src/App.tsx` and `src/features/game/{AbortGameDialog,SessionManagerScreen,SessionStatsTable}.tsx`; state and persistence are owned by `src/store/gameStore.ts`.

**Verdict.** The UI looks cohesive and is usable on desktop and mobile. At 390×844 and 1280×900, the rendered Session manager and create form had no horizontal page overflow, clipping, or undersized controls. The Abort trigger uses safe-area offsets, remains at least 48px tall through the shared button rule, and its modal is viewport-bounded. Focus containment, Escape cancellation, background inertness, and focus restoration are implemented for both destructive dialogs. The focused Session and Abort Playwright journeys pass in both Desktop Chrome and Pixel 7 projects (4/4 tests).

Coupling is moderate: UI composition is localized, but both features share Zustand session state, browser persistence, dialog styles, and app-level navigation. Removal is feasible but not low-risk because session records are the persistence and statistics boundary for every round.

**Main risks.** The mobile statistics experience is technically responsive but not especially comfortable: a nine-column table is forced to `min-width: 72rem` and relies on horizontal scrolling. The empty Session screen also shows three unusable disabled actions, which wrap unevenly at phone width and dilute the primary action. Recommendation: keep the current overall design; improve those two mobile states without restructuring the feature.

## 2. Feature anatomy

- `AppContent` selects the session manager when `view === 'sessions'`, mounts one `AbortGameDialog` around every active non-result phase, and returns to Sessions after a confirmed abort (`src/App.tsx:30-53`).
- `AbortGameDialog` owns only transient open/focus state. Confirmation delegates to the store callback; cancellation changes no game data (`src/features/game/AbortGameDialog.tsx:7-63`).
- `SessionManagerScreen` sorts saved records, owns selection/create/stats/delete presentation state, delegates continue/create navigation upward, and calls the store only for deletion (`src/features/game/SessionManagerScreen.tsx:11-117`).
- `SessionStatsTable` is a shared read-only view used in Session details and the completed-result screen (`src/features/game/SessionStatsTable.tsx:16-40`; `src/features/game/GameOverScreen.tsx:69-72`).
- A `SessionRecord` owns roster, setup, aggregate statistics, and an optional in-progress game (`src/domain/types.ts:119-129`). Zustand persists those records to browser `localStorage` under `moldyparty-game` and remasks any visible role (`src/store/gameStore.ts:361-365,716-758`).
- Confirmed abort clears active/transient round state and persisted `currentGame`, but preserves the saved session and completed statistics (`src/store/gameStore.ts:448-465`). No network or server boundary is involved.
- Responsive facts: all buttons have a 48px minimum height; the page uses `100dvh` and safe-area padding; session cards collapse from two columns to one below 700px; dialogs cap width at viewport minus 2rem; the Abort trigger uses top/left safe-area insets (`src/styles.css:18-40,108-135,234-265,301-305`).

## 3. Cascade map

| Edge | Provider | Interface | Consumer | Effect | Risk | Confidence | Evidence | Disposition |
|---|---|---|---|---|---|---|---|---|
| E1 | Home UI | `setView('sessions')` | `SessionManagerScreen` | Direct entry to session UI | Low | Confirmed | `src/App.tsx:64-75` | Keep |
| E2 | `AppContent` | active phase switch | `AbortGameDialog` | Directly exposes Abort in role reveal, discussion, voting, and Outlier guess; excludes completed results | Medium | Confirmed | `src/App.tsx:30-43` | Keep |
| E3 | Abort dialog | `onConfirm` callback | `gameStore.abortGame` + Sessions navigation | Direct destructive transition after confirmation | High | Confirmed | `src/App.tsx:42`; `src/features/game/AbortGameDialog.tsx:52-62` | Keep confirmation boundary |
| E4 | `abortGame` | Zustand state update | active game, session `currentGame`, vote/guess/timer transients | Directly discards unfinished work while retaining completed stats | High | Confirmed | `src/store/gameStore.ts:448-465`; `src/store/gameStore.test.ts:129-183` | Keep atomic |
| E5 | Zustand persist | `partialize` / `merge` | browser `localStorage` and hydration | Persisted session recovery; aborted rounds stay absent after reload | High | Confirmed | `src/store/gameStore.ts:716-758`; `e2e/game-flow.spec.ts:225-249` | Keep and regression-test |
| E6 | Session manager | `sessionsById` selectors | cards, selected state, actions | Direct rendering and selection of saved sessions | Medium | Confirmed | `src/features/game/SessionManagerScreen.tsx:11-28,80-104` | Keep |
| E7 | Session actions | `onCreate`, `onContinue`, `deleteSession` | App navigation and store | Direct creation/continuation/deletion boundary | High | Confirmed | `src/App.tsx:45-53`; `src/features/game/SessionManagerScreen.tsx:69-72,99-116`; `src/store/gameStore.ts:415-446` | Keep confirmations for deletion |
| E8 | `SessionStatsTable` | `SessionRecord` prop | manager details and result screen | Shared read-only rendering of aggregate statistics | Medium | Confirmed | `src/features/game/SessionStatsTable.tsx:16-40`; `src/features/game/GameOverScreen.tsx:69-72` | Improve mobile presentation without changing contract |
| E9 | Shared dialog CSS | `.session-dialog` | Abort and delete dialogs | Transitive layout/visual coupling; a style change affects both destructive flows | Medium | Confirmed | `src/styles.css:250-254`; both dialog components | Keep shared, test both |
| E10 | Responsive CSS | breakpoints, min sizes, overflow | session cards/actions/stats and Abort trigger | Operational mobile behavior | Medium | Confirmed | `src/styles.css:29-40,234-265,301-305`; rendered 390×844 and 1280×900 checks | Improve E8/empty actions |
| E11 | Playwright projects | Desktop Chrome + Pixel 7 | Session and Abort journeys | Operational regression coverage for visibility and complete interactions | Medium | Confirmed | `playwright.config.ts:13-16`; `e2e/game-flow.spec.ts:154-249`; focused run: 4 passed | Keep; add geometry assertions only if regressions recur |

## 4. Isolation and disassembly

### Recommended isolation seams

- Keep the present E3 boundary: the dialog decides only confirmation, while `abortGame()` owns the atomic state cut.
- Keep E8 prop-driven and read-only. A mobile cards/summary view can consume the same `SessionRecord` without changing persistence or statistics logic.
- Treat E9 as a shared destructive-dialog primitive if dialog behavior is later extracted; preserve its focus and inert behavior.

### Ordered cuts if either feature were removed

1. **Remove Abort UI:** cut E2 then E3. Validate that all four active phases render and complete without the trigger. Roll back by restoring the shared mount in `AppContent`.
2. **Remove Abort behavior:** only after the UI cut, remove E4 and its store interface. Compatibility impact: persisted unfinished rounds would again remain resumable; no schema cleanup is required. Validate store hydration and full round completion. Roll back by restoring the atomic action.
3. **Remove Session presentation:** cut E1/E6/E7/E8 only after defining another owner for creating and resuming rounds. Validate home-to-game entry, recovery after reload, and results. Roll back by restoring the `sessions` app view.
4. **Remove session persistence:** migrate or explicitly discard E5 data only after replacing statistics, roster, and recovery ownership. This is a breaking data cut; back up/export is not currently available. Validate reload, exactly-once statistics, abort, replay, and deletion. Roll back by retaining the previous storage version and merge path.

Cleanup after any cut should remove orphaned tests/styles only after consumer searches for the referenced edge IDs. No persistent cleanup is needed for an Abort-only removal; Session removal would leave existing `moldyparty-game` browser data unless a deliberate migration policy is added.

## 5. Improvements

1. **Required for a stronger mobile experience (E8/E10):** replace or supplement the 72rem stats table with a phone layout such as per-player expandable cards, or at minimum freeze the Player column and add a visible horizontal-scroll cue. Current overflow prevents page breakage but makes cross-row comparison difficult (`src/styles.css:257-265`).
2. **Recommended (E6/E10):** when there are no sessions, hide the disabled Continue/View/Delete controls or place them below the empty-state explanation. At 390px they create an uneven three-row action cluster even though only Create is actionable.
3. **Optional (E3/E9):** associate each destructive dialog’s explanatory paragraph using `aria-describedby` so the consequence text is announced consistently with the title.
4. **Optional (E2/E10):** add a short-landscape viewport check for the fixed top-left Abort trigger. The current safe-area positioning is sound, but no automated geometry assertion proves it cannot cover phase content on unusually short screens.

## 6. Uncertainty and coverage boundary

- The Session manager and create form were visually inspected at 390×844 and 1280×900. The existing Chrome window could not be inspected because the automation surface could not verify its URL safely.
- Abort rendering was assessed from component/CSS evidence and successful Pixel 7/Desktop Chrome journeys rather than a retained visual screenshot of every active phase and orientation.
- Native iOS Safari dialog rendering, virtual-keyboard resizing, 320px-wide phones, zoomed text, and screen-reader announcements were not runtime-tested.
- The focused search covered repository source, tests, README, and feature documents while excluding dependencies and generated output. No additional dependency was found within the inspected scope.
