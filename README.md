# MoldyParty

MoldyParty is an offline-first, installable pass-the-device party collection. **Impostor** privately assigns roles and guides voting; **Forehead Charades** turns the same device and word library into a fast, tilt-or-tap guessing game; and **Category Bomb** challenges a group to name valid items before a hidden fuse runs out. None of the games requires accounts, a server, or a network connection after the first production load.

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

### Category Bomb

1. Open **Category Bomb**, create or continue a named local session, then add at least two uniquely named players. The roster becomes fixed after the first bomb starts. Choose **Fair cycle** or **Chaos**; Fair cycle gives everyone one turn before reshuffling, while Chaos may choose any player except the person who just answered.
2. With 2–12 players, place the phone in the center and arrange the names around it. The center arrow points toward the current player. With 13 or more players, the game switches to a large-name view with no seating board or arrow, so the phone can be passed directly.
3. Read the category, say a valid item, then tap the bomb and pass the phone to the next named player. **Add random time on pass** is off by default; when enabled, choose a 0.0–10.0-second minimum and maximum in 0.1-second steps (initially 0.5–3.0 seconds). Each accepted pass samples within that range, while a 15-second total cap keeps the round bounded. The random fuse length scales with the group size and is never displayed.
4. The group self-moderates repetition and invalid answers: hold the foul control for 600 ms to explode the current player. A normal expiry also reveals the player holding the turn when the fuse ends.
5. The result shows accepted answers and the explosion cause. Select **New bomb** to keep the roster and rules while drawing a new category, **Review rules** before the next bomb, or **Return to sessions**.

The active round and wall-clock deadline are stored locally. Reloading—even offline after the app has been cached—recovers the same round and immediately reconciles an expired fuse. Sound, vibration, and wake lock are progressive enhancements; the visible tap controls always remain available.

### Forehead Charades

1. Open **Forehead Charades**, create or continue a named local session, and define the player roster used by every mode. The roster becomes fixed after the first game starts.
2. Choose a compatible shared pack and optional category/vibe filters, then pick **Classic** (60/75/90 seconds), **Henyo** (fixed 2:00), **One-Word**, or **Team Relay**. Relay assigns every saved player to exactly one of two teams for 3–5 turns per team; assignments may change between games without changing player identity.
3. **Tilt controls** are enabled by default; switch them off for tap-only play. Press **Start Get Ready** while holding the phone in its neutral forehead position. The first second calibrates motion input; the full three-second countdown also requests landscape and a screen wake lock when the browser supports them.
4. Follow the guided setup: hold the phone neutral, tilt the phone face up to teach **Correct**, then return to neutral. Recognition compares normalized gravity vectors from the motion sensor, so it does not depend on portrait/landscape Euler-axis selection. During play, repeat that face-up tilt for **Correct** or tilt in the opposite direction for **Pass**. The landscape request remains best-effort, and the right and left tap zones—and Arrow Right and Arrow Left on desktop—remain available when motion is disabled, denied, or unavailable.
5. Henyo shows a bilingual category anchor plus optional **Oo / Hindi / Pwede** sound buttons. **Foul (-5s)** shortens the clock without changing the card.
6. Correct/pass feedback uses generated Web Audio tones, optional vibration, text, and a brief color flash. Sound and haptics can be disabled in setup; no audio files are downloaded.
7. The recap preserves every played word in order. Team Relay alternates teams, rotates holders, and totals scores after both teams finish all configured turns.

The current round, deadline, teams, and no-repeat history are stored locally, so an accidental refresh resumes the same game. Finishing returns to the saved-session manager; aborting an unfinished turn requires confirmation and does not add statistics. Motion, wake lock, vibration, and orientation lock are progressive enhancements; unsupported or declined APIs never prevent tap play.

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

Clicking **Impostor**, **Category Bomb**, or **Forehead Charades** opens that game's local session manager. Click a saved-session card to continue it. Each card also has quick icons to rename the session, inspect its statistics table, or permanently delete it after confirmation. Renaming changes only the session label; the stable player roster and its statistics stay attached to the same people. Sessions are stored only in the current browser profile.

After a completed round, **Change category** returns directly to the category picker and keeps the current session active. **Return to sessions** leaves the round setup and opens the saved-session manager.

Impostor tracks every player's role appearances, total and per-role wins/losses, correct Impostor votes, wrong Innocent guesses, votes for the Jester, times voted out as Jester, and correct Outlier word guesses. Private ballots can be attributed to individual players. Group Vote still affects role wins and losses, but it does not add individual vote-accuracy or Jester-vote credit because the ballot has no individual voter.

Category Bomb commits statistics only when a bomb explodes. It tracks accepted answers, timer/foul explosions, bombs survived, and each player's best answer count in one bomb; it never claims the group-moderated answers were objectively correct or exposes the hidden fuse. Forehead Charades commits only completed turns, tracking correct cards, passes, accuracy, best turn, correct streak, Henyo fouls, mode/category breakdowns, and relay win/loss/tie results. Reloading, replaying, or revisiting a result cannot count the same terminal result twice.

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
- Zustand coordinates and persists the three finite-state game lifecycles, including in-progress recovery from wall-clock deadlines.
- Dexie stores custom packs in IndexedDB.
- `vite-plugin-pwa`/Workbox precaches the application shell and supplies an offline navigation fallback.
- Vitest and Testing Library verify rules and interaction behavior; Playwright verifies complete desktop/mobile and offline journeys.

## Offline and privacy notes

MoldyParty does not transmit gameplay, sensor readings, session statistics, or custom-pack data. Charades motion events are interpreted only in the browser and are not recorded. Role reveals, ballots, and unfinished Outlier guesses are remasked after privacy is lost or a saved round is restored. Clearing browser storage, using private browsing, deleting a session, or uninstalling with site-data removal can erase local session stats, packs, no-repeat history, and in-progress rounds, so export important packs as JSON. The first visit must be online; subsequent production-build visits can load any game and saved packs from the service worker cache.
