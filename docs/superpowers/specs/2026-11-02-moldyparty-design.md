# MoldyParty Design

## Intent

Build a polished, installable, offline-first pass-the-device party game. The launch game is Impostor: players privately learn roles, discuss, vote in secret, and reveal the result. Custom word packs remain on the device and can be imported or exported as JSON.

## Goals

- Run the entire game without a network connection after the first load.
- Protect role and vote secrecy during device hand-offs.
- Support built-in categories and durable, editable custom packs.
- Make every primary action comfortable on a phone held in one hand.
- Keep game rules deterministic and independently testable.

## Non-goals

- Online multiplayer, accounts, cloud sync, or a backend.
- AI generation inside the application; the app only copies a compatible prompt.
- Multiple game titles in the first release.

## Constraints

- Minimum three players and at least one impostor, with fewer impostors than players.
- The game must be installable on desktop and mobile and usable offline.
- User content and preferences are local-first.
- Imported packs accept both the canonical item schema and parallel `words`/`hints` arrays.

## Architecture

The application uses React, TypeScript, Vite, Tailwind CSS, Zustand, Dexie, and `vite-plugin-pwa`. A pure game domain module owns role assignment, phase transitions, votes, and results; React screens render the current phase and issue commands through the store. Dexie stores custom packs and preferences, while the in-progress round stays in Zustand with local persistence for refresh recovery.

The game lifecycle is `LOBBY -> ROLE_REVEAL -> DISCUSSION -> VOTING -> GAME_OVER`. Role reveal and voting each interleave a private content screen with a neutral hand-off mask. Starting a round chooses one word and assigns unique impostors using injected randomness so tests can be deterministic.

## UI Direction

The visual language is playful but legible: a deep plum background, warm cream surfaces, lime and coral accents, oversized rounded controls, and subtle mold/spore motifs. Primary controls have a 48px minimum target, clear focus styles, and high contrast. Secret information appears only while a player deliberately holds the reveal surface; releasing immediately masks it.

## Alternatives Considered

- Svelte would reduce component boilerplate, but React has the stronger testing and PWA ecosystem for this project.
- React Context plus LocalStorage would reduce dependencies, but becomes fragile for structured custom-pack CRUD and schema migrations.
- React, Zustand, and Dexie was selected because it cleanly separates transient game state from durable content without introducing a backend.

## Builder Decisions

- Ties eliminate nobody; the result explicitly lists the tied leaders.
- A skipped vote is recorded as `null` and does not count toward any candidate.
- Built-in categories include Animals, Places, and Objects with hints.
- The discussion timer is optional, defaults to three minutes, and never automatically advances to voting.
- “Play Again” reshuffles roles and chooses a new word from the current pack; “Change Category” returns to setup while preserving players and other settings.

