import { describe, expect, it } from 'vitest'
import { builtInPacks } from './builtInPacks'
import { advanceRoleReveal, createRound, validateSetup } from './game'

const validSetup = {
  playerNames: ['Alex', 'Blair', 'Casey', 'Devon'],
  impostorCount: 1,
  pack: {
    id: 'test-pack',
    packName: 'Test Pack',
    category: 'Test',
    source: 'builtIn' as const,
    items: [
      { word: 'Otter', hint: 'Water' },
      { word: 'Falcon', hint: 'Sky' },
    ],
  },
  hintsEnabled: true,
  discussionDurationSeconds: 180,
}

describe('validateSetup', () => {
  it('rejects fewer than three players', () => {
    expect(validateSetup({ ...validSetup, playerNames: ['Alex', 'Blair'] })).toContain(
      'Add at least 3 players.',
    )
  })

  it('rejects blank and case-insensitive duplicate names', () => {
    const errors = validateSetup({
      ...validSetup,
      playerNames: ['Alex', '  ', 'alex'],
    })

    expect(errors).toContain('Every player needs a name.')
    expect(errors).toContain('Player names must be unique.')
  })

  it.each([0, 4, 5])('rejects an impostor count of %i for four players', (impostorCount) => {
    expect(validateSetup({ ...validSetup, impostorCount })).toContain(
      'Choose at least 1 impostor and fewer impostors than players.',
    )
  })
})

describe('createRound', () => {
  it('selects a word and assigns the requested number of unique impostors', () => {
    const state = createRound(validSetup, () => 0)

    expect(state.phase).toBe('ROLE_REVEAL')
    expect(state.currentWord).toBe('Otter')
    expect(state.currentHint).toBe('Water')
    expect(state.players.filter((player) => player.role === 'IMPOSTOR')).toHaveLength(1)
    expect(new Set(state.players.map((player) => player.id)).size).toBe(4)
    expect(state.currentRevealIndex).toBe(0)
    expect(state.players.every((player) => !player.hasViewedRole)).toBe(true)
  })

  it('keeps the hint internally while disabling its display for impostors', () => {
    const state = createRound({ ...validSetup, hintsEnabled: false }, () => 0)

    expect(state.currentHint).toBe('Water')
    expect(state.hintsEnabled).toBe(false)
  })

  it('refuses invalid setup rather than producing a partial round', () => {
    expect(() => createRound({ ...validSetup, playerNames: ['Alex', 'Blair'] })).toThrow(
      'Add at least 3 players.',
    )
  })
})

describe('advanceRoleReveal', () => {
  it('marks each player viewed and begins discussion after the final hand-off', () => {
    let state = createRound(validSetup, () => 0)

    state = advanceRoleReveal(state)
    expect(state.currentRevealIndex).toBe(1)
    expect(state.players[0].hasViewedRole).toBe(true)

    state = advanceRoleReveal(state)
    state = advanceRoleReveal(state)
    state = advanceRoleReveal(state)

    expect(state.phase).toBe('DISCUSSION')
    expect(state.players.every((player) => player.hasViewedRole)).toBe(true)
  })

  it('does nothing outside the role reveal phase', () => {
    const discussion = {
      ...createRound(validSetup, () => 0),
      phase: 'DISCUSSION' as const,
    }

    expect(advanceRoleReveal(discussion)).toBe(discussion)
  })
})

describe('built-in packs', () => {
  it('ships Animals, Places, and Objects with usable hints', () => {
    expect(builtInPacks.map((pack) => pack.packName)).toEqual(['Animals', 'Places', 'Objects'])
    expect(builtInPacks.every((pack) => pack.items.length >= 8)).toBe(true)
    expect(builtInPacks.every((pack) => pack.items.every((item) => item.word && item.hint))).toBe(true)
  })
})
