# Category Bomb QA — 2026-11-20

## Automated release evidence

- Vitest: 27 files / 239 tests passed.
- ESLint: passed without warnings.
- TypeScript + production PWA build: passed.
- Playwright: desktop and Pixel 7 Chromium cover 2-, 4-, 8-, and 12-player Radial play; 13- and 50-player Name-only play; hidden expiry, replay, offline recovery, and maximum-length names.
- Responsive geometry assertions cover 390×844 portrait and 667×375 landscape. They verify that twelve 24-character tags do not overlap one another or the category, bomb, or Foul controls; that all controls remain inside the viewport; and that the arrow extends visibly beyond the center bomb.
- The responsive Playwright journey captures `category-bomb-390x844.png`, `category-bomb-667x375.png`, and `category-bomb-name-only-667x375.png` in its test output. These were inspected on 2026-11-20; the controls were reachable and the long-name layouts were readable without overlap.

## Physical-device release matrix

Physical checks cannot be truthfully completed in this development environment. They remain a pre-merge/release gate rather than being represented as passed.

| Device path | Status | Checks still required |
| --- | --- | --- |
| iOS Safari | Pending | Portrait/landscape reach, hold cancellation, audio under mute, vibration behavior, wake lock fallback |
| Installed iOS PWA | Pending | Offline launch/recovery, orientation change, safe areas, audio unlock |
| Android Chrome | Pending | Portrait/landscape reach, hold cancellation, vibration, wake lock, rapid taps |
| Installed Android PWA | Pending | Offline launch/recovery, app resume after deadline, wake lock reacquisition |

Do not treat this branch as release-approved until the pending rows have dated device results.
