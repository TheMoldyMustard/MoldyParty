# Abort and Session UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Session statistics genuinely phone-friendly, simplify the empty Session state, strengthen destructive-dialog accessibility, and protect the Abort action in short landscape viewports.

**Architecture:** Preserve the existing React components and Zustand contracts. Reflow the existing semantic statistics table into stacked player cards at the current 700px breakpoint, conditionally render only meaningful Session actions, and extend the shared dialog pattern with descriptions. Keep Abort fixed and safe-area-aware while reserving enough active-screen space at short heights.

**Tech Stack:** React 19, TypeScript, CSS, Vitest/Testing Library, Playwright.

**Spec:** `docs/feature-analysis/2026-11-03-abort-session-ui.md`

## Global Constraints

- Do not change session persistence, statistics calculations, or Abort state semantics.
- Keep all interactive targets at least 48px high.
- Preserve desktop table semantics and existing Session/Abort copy.
- Preserve keyboard focus containment, Escape dismissal, inert background, and focus restoration.
- Do not add dependencies.

## Review Focus

- A phone stats view must expose every existing counter without horizontal scrolling.
- Desktop stats must remain a conventional table with the same headers and values.
- Empty sessions must offer Create without dead Continue/View/Delete controls.
- Abort and delete dialogs must announce their consequence text without changing focus behavior.
- A short landscape active-round screen must keep Abort inside the safe viewport without covering its phase heading.

---

### Task 1: Session empty state and destructive-dialog descriptions

**Files:**
- Modify: `src/features/game/SessionManagerScreen.tsx`
- Modify: `src/features/game/AbortGameDialog.tsx`
- Test: `src/features/game/GameFlow.test.tsx`

**Interfaces:**
- Consumes: existing `sessions.length`, `pendingDelete`, and Abort open state.
- Produces: dialogs whose `aria-describedby` points to consequence copy; Session actions rendered only when a saved session exists, while Create remains available.

- [x] **Step 1: Write failing interaction tests**

Add tests asserting that an empty manager has Create but no Continue/View/Delete controls, and that opened Abort/delete dialogs expose their consequence paragraph through `aria-describedby`.

- [x] **Step 2: Run the focused tests and verify expected failures**

Run: `npm run test:run -- src/features/game/GameFlow.test.tsx`

- [x] **Step 3: Implement the minimal conditional action rendering and dialog description IDs**

Keep Create primary; render the other actions only when `selected` is non-null. Add stable paragraph IDs referenced by each dialog.

- [x] **Step 4: Re-run the focused tests and verify they pass**

Run: `npm run test:run -- src/features/game/GameFlow.test.tsx`

### Task 2: Responsive Session statistics cards

**Files:**
- Modify: `src/features/game/SessionStatsTable.tsx`
- Modify: `src/styles.css`
- Test: `e2e/game-flow.spec.ts`

**Interfaces:**
- Consumes: the existing semantic table and `SessionRecord` values.
- Produces: the same table at desktop sizes and card-like table rows at `max-width: 700px`, with visible per-value labels and no horizontal scroll.

- [x] **Step 1: Add a failing mobile overflow assertion to the existing saved-session journey**

For the Pixel 7 project, assert the stats container's `scrollWidth` does not exceed its `clientWidth`, while retaining all current row/value assertions.

- [x] **Step 2: Run the mobile test and verify it fails because the table is 72rem wide**

Run: `npx playwright test e2e/game-flow.spec.ts --project=mobile-chromium -g "saved session"`

- [x] **Step 3: Add literal cell labels and responsive table-to-card CSS**

Keep `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th scope="row">`, and `<td>` semantics. On phones, visually hide the header row, stack each player row, and use each cell's literal `data-label` as its visible label.

- [x] **Step 4: Re-run mobile and desktop saved-session tests**

Run: `npx playwright test e2e/game-flow.spec.ts --project=mobile-chromium --project=desktop-chromium -g "saved session"`

### Task 3: Short-landscape Abort protection

**Files:**
- Modify: `src/styles.css` only if the regression test demonstrates overlap.
- Test: `e2e/game-flow.spec.ts`

**Interfaces:**
- Consumes: `.abort-game-trigger` and active phase headings.
- Produces: a verified safe-area-aware Abort target that remains inside an 844×390 viewport and does not overlap the current phase heading.

- [x] **Step 1: Add a short-landscape geometry regression test to the Abort journey**

In mobile Chromium, resize to 844×390 after a round starts. Assert the Abort target is fully within the viewport and its rectangle does not intersect the phase heading rectangle.

- [x] **Step 2: Run the focused mobile Abort test**

Run: `npx playwright test e2e/game-flow.spec.ts --project=mobile-chromium -g "can abort"`

- [x] **Step 3: If the test fails for overlap, add the smallest short-height media rule that reserves top space on active screens**

Do not change the trigger's safe-area offsets or 48px minimum target.

- [x] **Step 4: Re-run the focused test and verify it passes**

Run: `npx playwright test e2e/game-flow.spec.ts --project=mobile-chromium -g "can abort"`

### Task 4: Full verification

**Files:**
- Verify all modified files and generated report/plan artifacts.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: a buildable, lint-clean, fully tested responsive UI change.

- [x] **Step 1: Run all unit/component tests**

Run: `npm run test:run`

- [x] **Step 2: Run lint and production build**

Run: `npm run lint`

Run: `npm run build`

- [x] **Step 3: Run the complete desktop/mobile end-to-end suite**

Run: `npm run e2e`

- [x] **Step 4: Inspect the resulting diff and rendered mobile/desktop states**

Confirm only scoped files changed, no generated output is tracked, and the Session manager, stats, and Abort dialog remain visually coherent.
