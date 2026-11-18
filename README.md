# MoldyParty

MoldyParty is an offline-first, installable pass-the-device party collection. **Impostor** privately assigns roles and guides voting; **Forehead Charades** turns the same device and word library into a fast, tilt-or-tap guessing game. Neither game requires accounts, a server, or a network connection after the first production load.

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

### Forehead Charades

1. Open **Forehead Charades**, choose a compatible shared pack, and optionally narrow it by category or vibe.
2. Pick **Classic** (60/75/90 seconds), **Henyo** (fixed 2:00), **One-Word**, or **Team Relay** with two named rosters and 3–5 turns per team.
3. Press **Start Get Ready** while holding the phone in its neutral forehead position. The first second calibrates motion input; the full three-second countdown also requests landscape and a screen wake lock when the browser supports them.
4. Tilt down or tap the right half for **Correct**. Tilt up or tap the left half for **Pass**. Arrow Right and Arrow Left provide a desktop fallback. Tap controls remain available even when motion permission is denied.
5. Henyo shows a bilingual category anchor plus optional **Oo / Hindi / Pwede** sound buttons. **Foul (-5s)** shortens the clock without changing the card.
6. Correct/pass feedback uses generated Web Audio tones, optional vibration, text, and a brief color flash. Sound and haptics can be disabled in setup; no audio files are downloaded.
7. The recap preserves every played word in order. Team Relay alternates teams, rotates holders, and totals scores after both teams finish all configured turns.

The current round, deadline, teams, and no-repeat history are stored locally, so an accidental refresh resumes the same game. Motion, wake lock, vibration, and orientation lock are progressive enhancements; unsupported or declined APIs never prevent tap play.

### Impostor

1. Open **Impostor**, then create a named local session or continue one you already saved. A session keeps the same player roster and cumulative stats across completed rounds.
2. Add at least three uniquely named players.
3. Choose fewer impostors than players, a built-in or custom category, optional hints, and an optional discussion timer. You can also enable one Jester and one Outlier, while leaving at least one Innocent in the round.
4. Pass the device. Each player deliberately holds the reveal surface to see their role; releasing it masks the secret immediately. The Jester tries to get voted out. The Outlier tries to guess the word and receives no hint unless the dedicated Outlier hint setting is enabled.
5. Discuss until the group chooses to proceed. The timer never advances the game automatically.
6. Vote privately by passing the device again, or enable **Group Vote** in setup for one shared ballot without the voting handoff. Select up to the number of impostors in either mode; private voters cannot select themselves. If you forgot to enable it, the voting handoff offers **Proceed to Group Vote**. The result screen offers Group Vote as a shortcut for the next round.
7. If an Outlier is enabled, pass the device privately to them after voting. They say their guess aloud and enter the same word so the game can validate it. Matching ignores surrounding whitespace and letter case; being voted out does not affect the Outlier's result.
8. The selected candidate or candidates are revealed. A tie votes out all tied leaders; an all-skipped private ballot eliminates nobody. The secret word, special-role outcomes, every player's role, and the session stats table are then shown.
9. During any active round, use **Abort game** if the group wants to stop. After confirmation, the unfinished round is discarded and the session returns to setup; completed session statistics are not changed.

## Local sessions and statistics

Clicking **Impostor** opens the local session manager. Click a saved-session card to continue it. Each card also has quick icons to rename the session, inspect its statistics table, or permanently delete it after confirmation. Renaming changes only the session label; the player roster and its statistics stay attached to the same people. Sessions are stored only in the current browser profile.

After a completed round, **Change category** returns directly to the category picker and keeps the current session active. **Return to sessions** leaves the round setup and opens the saved-session manager.

Each completed round tracks every player's role appearances, total and per-role wins/losses, correct Impostor votes, wrong Innocent guesses, votes for the Jester, times voted out as Jester, and correct Outlier word guesses. Private ballots can be attributed to individual players. Group Vote still affects role wins and losses, but it does not add individual vote-accuracy or Jester-vote credit because the ballot has no individual voter.

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

Hints are required only for items used by Impostor. Charades can read the same hinted items or word-only items with optional metadata:

```json
{
  "packName": "Party Mix",
  "items": [
    {
      "word": "Adobo",
      "hint": "A Filipino dish",
      "category": "food",
      "vibes": ["casual", "pop-culture-local"]
    },
    {
      "word": "Invisible Roller Coaster",
      "charadesOnly": true,
      "category": "other",
      "vibes": ["chaos-hard"]
    }
  ]
}
```

Supported categories are `person`, `place`, `object`, `animal`, `food`, `pop-culture`, and `other`. Supported vibes are `casual`, `pop-culture-local`, and `chaos-hard`. Items marked `charadesOnly`, or items without a hint, are excluded from Impostor but stay available to Charades. Existing items with one `"hint"`, items with five `"hints"`, mixed packs, and the legacy `{ "words": ["..."], "hints": ["..."] }` format remain compatible. The AI prompt helper can copy either an Impostor prompt or a 50-card tagged Charades/Henyo prompt; MoldyParty never calls an AI service itself.

## Architecture

- React, TypeScript, Vite, and Tailwind CSS provide the responsive interface.
- Pure functions in `src/domain` own validation, phase transitions, card/deck policies, role assignment, ballots, ties, relay rotation, and results.
- Zustand coordinates and persists both finite-state lifecycles, including in-progress recovery from wall-clock deadlines.
- Dexie stores custom packs in IndexedDB.
- `vite-plugin-pwa`/Workbox precaches the application shell and supplies an offline navigation fallback.
- Vitest and Testing Library verify rules and interaction behavior; Playwright verifies complete desktop/mobile and offline journeys.

## Offline and privacy notes

MoldyParty does not transmit gameplay, sensor readings, session statistics, or custom-pack data. Charades motion events are interpreted only in the browser and are not recorded. Role reveals, ballots, and unfinished Outlier guesses are remasked after privacy is lost or a saved round is restored. Clearing browser storage, using private browsing, deleting a session, or uninstalling with site-data removal can erase local session stats, packs, no-repeat history, and in-progress rounds, so export important packs as JSON. The first visit must be online; subsequent production-build visits can load either game and saved packs from the service worker cache.
