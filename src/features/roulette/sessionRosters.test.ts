import { describe, expect, it } from 'vitest'
import { createRouletteRosterOptions } from './sessionRosters'

describe('roulette saved-session rosters', () => {
  it('combines valid sessions from every game and sorts the newest first', () => {
    const options = createRouletteRosterOptions([
      {
        gameId: 'impostor',
        gameLabel: 'Impostor',
        sessions: {
          old: {
            name: 'Friday Crew',
            updatedAt: '2026-11-01T10:00:00.000Z',
            players: [{ name: 'Alex' }, { name: 'Blair' }],
          },
        },
      },
      {
        gameId: 'charades',
        gameLabel: 'Forehead Charades',
        sessions: {
          newest: {
            name: 'Guess Crew',
            updatedAt: '2026-11-03T10:00:00.000Z',
            players: [{ name: 'Casey' }, { name: 'Devon' }],
          },
        },
      },
      {
        gameId: 'category-bomb',
        gameLabel: 'Category Bomb',
        sessions: {
          middle: {
            name: 'Bomb Squad',
            updatedAt: '2026-11-02T10:00:00.000Z',
            players: [{ name: 'Eli' }, { name: 'Fran' }],
          },
        },
      },
    ])

    expect(options).toEqual([
      { id: 'charades:newest', label: 'Forehead Charades · Guess Crew', names: ['Casey', 'Devon'] },
      { id: 'category-bomb:middle', label: 'Category Bomb · Bomb Squad', names: ['Eli', 'Fran'] },
      { id: 'impostor:old', label: 'Impostor · Friday Crew', names: ['Alex', 'Blair'] },
    ])
  })

  it('returns copied names and does not expose a mutable session roster reference', () => {
    const players = [{ name: 'Alex' }, { name: 'Blair' }]
    const [option] = createRouletteRosterOptions([{
      gameId: 'impostor',
      gameLabel: 'Impostor',
      sessions: { one: { name: 'Crew', updatedAt: '2026-11-01T00:00:00.000Z', players } },
    }])

    players[0].name = 'Changed later'

    expect(option.names).toEqual(['Alex', 'Blair'])
  })

  it('skips only rosters with fewer than two usable names and preserves names that need roulette edits', () => {
    const fiftyOneNames = Array.from({ length: 51 }, (_, index) => ({ name: `Player ${index + 1}` }))
    fiftyOneNames[0] = { name: 'A'.repeat(30) }
    const options = createRouletteRosterOptions([{
      gameId: 'category-bomb',
      gameLabel: 'Category Bomb',
      sessions: {
        empty: { name: 'Empty', updatedAt: '2026-11-03T00:00:00.000Z', players: [] },
        duplicates: { name: 'Duplicates', updatedAt: '2026-11-02T00:00:00.000Z', players: [{ name: 'Alex' }, { name: 'alex' }] },
        large: { name: 'Large Group', updatedAt: '2026-11-01T00:00:00.000Z', players: fiftyOneNames },
      },
    }])

    expect(options.map((option) => option.label)).toEqual([
      'Category Bomb · Duplicates',
      'Category Bomb · Large Group',
    ])
    expect(options[1].names).toHaveLength(51)
    expect(options[1].names[0]).toBe('A'.repeat(30))
  })
})
