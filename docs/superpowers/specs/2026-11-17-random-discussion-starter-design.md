# Random Discussion Starter Design

## Intent

When the last player confirms their secret role, choose one player at random and clearly identify them as the person who starts the discussion. This removes the pause where the group has to decide who speaks first.

## Goals and constraints

- Every round selects exactly one of the round's players, regardless of role.
- Selection happens on the transition from role reveal to discussion.
- The selected player remains stable across timer updates and page reloads.
- The discussion timer behavior and all later game phases remain unchanged.
- Existing saved rounds without a starter remain loadable.

## Non-goals

- No lobby setting, reroll control, speaking order, or role-based eligibility rule.
- No visual redesign beyond a prominent instruction on the discussion screen.

## Approaches considered

1. Select during round creation. Simple, but earlier than the requested transition.
2. Keep the selection only in component state. Small, but reloads would change or lose it.
3. Select at the final role confirmation and persist the selected player ID with the round. Chosen because it matches the requested timing and survives reloads.

## Design

Add an optional `discussionStarterPlayerId` to `GameState` for backward compatibility. When `advanceRoleReveal` processes the final player, it uses the injected random source to select a valid player ID and enters `DISCUSSION`. `DiscussionScreen` resolves that ID to the player's name and displays “<name> starts the discussion” above the existing timer. Tests cover deterministic selection, stability, legacy saved state, and rendered copy.
