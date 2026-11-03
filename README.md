# MoldyParty

MoldyParty is an offline-first, installable pass-the-device party game. Its launch title, **Impostor**, privately assigns roles, guides discussion and secret voting, and reveals the round without requiring accounts, a server, or a network connection.

## Run locally

Requirements: Node.js 20.19+, 22.12+, or a newer supported release, plus npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production/offline check:

```bash
npm run build
npm run preview
```

The service worker is generated only for production builds. Browser install prompts also require a secure context (`https` or localhost) and a supporting browser.

## Commands

- `npm run dev` — Vite development server.
- `npm run test:run` — unit and component tests once.
- `npm run lint` — TypeScript/React lint checks.
- `npm run build` — type-check and build the PWA, manifest, and service worker.
- `npm run preview` — serve the production build.
- `npm run e2e` — Playwright journeys on desktop and mobile Chromium; run `npm run build` first.

Install Playwright's browser once on a new machine with `npx playwright install chromium`.

## How the game works

1. Add at least three uniquely named players.
2. Choose fewer impostors than players, a built-in or custom category, optional hints, and an optional discussion timer. You can also enable one Jester and one Outlier, while leaving at least one Innocent in the round.
3. Pass the device. Each player deliberately holds the reveal surface to see their role; releasing it masks the secret immediately. The Jester tries to get voted out. The Outlier tries to guess the word and receives no hint unless the dedicated Outlier hint setting is enabled.
4. Discuss until the group chooses to proceed. The timer never advances the game automatically.
5. Vote privately by passing the device again, or enable **Absolute Voting** in setup to vote openly together without the voting handoff. Players may select anyone except themselves or skip. The result screen also offers Absolute Voting as a shortcut for the next round.
6. If an Outlier is enabled, pass the device privately to them for one guess after voting. Matching ignores surrounding whitespace and letter case; being voted out does not affect the Outlier's result.
7. A unique vote leader is revealed. A tie or all-skipped ballot eliminates nobody. The secret word, special-role outcomes, and every player's role are then shown.

## Custom packs

Packs can be entered manually, pasted as JSON, or uploaded from a `.json` file. They can be previewed, renamed, exported, and deleted. Data is stored in IndexedDB on the current browser profile.

Canonical import/export format:

```json
{
  "packName": "Custom Deck Title",
  "category": "Custom",
  "items": [
    {
      "word": "Example Word",
      "hints": ["First", "Second", "Third", "Fourth", "Fifth"]
    }
  ]
}
```

Each new-format item contains five hints; one is selected randomly when the round starts. Existing items with a single `"hint"` remain compatible. The fallback format `{ "words": ["..."], "hints": ["..."] }` is also accepted when both arrays have the same length. The AI prompt helper copies a topic-specific prompt that asks ChatGPT, Gemini, or Claude for canonical JSON; no AI service is called by MoldyParty.

## Architecture

- React, TypeScript, Vite, and Tailwind CSS provide the responsive interface.
- Pure functions in `src/domain` own validation, role assignment, phase transitions, ballots, ties, and results. Voting can be private (pass-device) or Absolute Voting (public/no-handoff); both use the same ballot and result rules.
- Zustand coordinates the finite-state lifecycle (`LOBBY → ROLE_REVEAL → DISCUSSION → VOTING → OUTLIER_GUESS? → GAME_OVER`) and persists in-progress recovery.
- Dexie stores custom packs in IndexedDB.
- `vite-plugin-pwa`/Workbox precaches the application shell and supplies an offline navigation fallback.
- Vitest and Testing Library verify rules and interaction behavior; Playwright verifies complete desktop/mobile and offline journeys.

## Offline and privacy notes

MoldyParty does not transmit gameplay or custom-pack data. Role reveals, ballots, and unfinished Outlier guesses are remasked after privacy is lost or a saved round is restored. Clearing browser storage, using private browsing, or uninstalling with site-data removal can erase local packs and an in-progress round, so export important packs as JSON. The first visit must be online; subsequent production-build visits can load from the service worker cache.
