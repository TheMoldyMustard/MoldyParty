import { describe, expect, it } from 'vitest'
import { builtInPacks } from './builtInPacks'
import {
  advanceRoleReveal,
  calculateSpecialRoleOutcomes,
  calculateVoteResult,
  createRound,
  recordOutlierGuess,
  recordVote,
  startVoting,
  validateSetup,
} from './game'
import type { Player, VoteRecord } from './types'

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
  jesterEnabled: false,
  outlierEnabled: false,
  outlierHintsEnabled: false,
  absoluteVotingEnabled: false,
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

  it('requires at least one word-knowing innocent after special roles are reserved', () => {
    expect(validateSetup({
      ...validSetup,
      impostorCount: 2,
      jesterEnabled: true,
      outlierEnabled: true,
    })).toContain('Leave at least one player as an Innocent.')
  })

  it.each([
    ['jesterEnabled', 'false'],
    ['outlierEnabled', 1],
    ['outlierHintsEnabled', null],
  ] as const)('rejects a non-boolean %s role setting', (field, value) => {
    const setup = { ...validSetup, [field]: value } as unknown as typeof validSetup

    expect(validateSetup(setup)).toContain('Role settings must be on or off.')
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

  it('copies Absolute Voting into the round state', () => {
    const state = createRound({ ...validSetup, absoluteVotingEnabled: true }, () => 0)

    expect(state.absoluteVotingEnabled).toBe(true)
  })

  it('randomly selects one hint from a five-hint pool', () => {
    const randomValues = [0, 0.6, 0, 0, 0]
    const state = createRound({
      ...validSetup,
      pack: {
        ...validSetup.pack,
        items: [{
          word: 'Moon',
          hint: 'Orbit',
          hints: ['Orbit', 'Night', 'Tide', 'Silver', 'Distant'],
        }],
      },
    }, () => randomValues.shift() ?? 0)

    expect(state.currentHint).toBe('Silver')
  })

  it('assigns enabled special roles to distinct players and keeps an innocent', () => {
    const state = createRound({
      ...validSetup,
      playerNames: ['Alex', 'Blair', 'Casey', 'Devon', 'Emery'],
      jesterEnabled: true,
      outlierEnabled: true,
      outlierHintsEnabled: true,
    }, () => 0)

    expect(state.players.map((player) => player.role).sort()).toEqual([
      'IMPOSTOR',
      'INNOCENT',
      'INNOCENT',
      'JESTER',
      'OUTLIER',
    ])
    expect(state.outlierHintsEnabled).toBe(true)
    expect(state.outlierGuesses).toEqual([])
  })

  it('disables the Outlier hint flag when the Outlier role is off', () => {
    const state = createRound({ ...validSetup, outlierHintsEnabled: true }, () => 0)

    expect(state.outlierHintsEnabled).toBe(false)
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
  it('ships the permanent categories with usable hints', () => {
    expect(builtInPacks.map((pack) => pack.packName)).toEqual([
      'Animals',
      'Places',
      'Objects',
      'College Programs in PUP',
      'IT Terms',
      'Nintendo Games',
    ])
    expect(builtInPacks.every((pack) => pack.items.length >= 8)).toBe(true)
    expect(builtInPacks.every((pack) => pack.items.every((item) => item.word && item.hint))).toBe(true)
  })

  it('keeps every supplied randomized hint in the new permanent categories', () => {
    const permanentPackIds = [
      'builtin-college-programs-pup',
      'builtin-it-terms',
      'builtin-nintendo-games',
    ]
    const newPacks = permanentPackIds.map((id) => builtInPacks.find((pack) => pack.id === id))

    expect(newPacks.map((pack) => ({
      packName: pack?.packName,
      category: pack?.category,
      source: pack?.source,
      itemCount: pack?.items.length,
    }))).toEqual([
      { packName: 'College Programs in PUP', category: 'Custom', source: 'builtIn', itemCount: 40 },
      { packName: 'IT Terms', category: 'Custom', source: 'builtIn', itemCount: 25 },
      { packName: 'Nintendo Games', category: 'Custom', source: 'builtIn', itemCount: 40 },
    ])
    expect(newPacks.every((pack) => pack?.items.every(
      (item) => item.hints?.length === 5 && item.hint === item.hints[0],
    ))).toBe(true)

    const canonicalContent = newPacks.map((pack) => ({
      id: pack?.id,
      packName: pack?.packName,
      category: pack?.category,
      source: pack?.source,
      items: pack?.items.map(({ word, hints }) => ({ word, hints })),
    }))
    const serializedContent = JSON.stringify(canonicalContent)
    const hash = Array.from(serializedContent).reduce((value, character) => {
      return Math.imul(value ^ character.charCodeAt(0), 16_777_619)
    }, 2_166_136_261) >>> 0
    const contentFingerprint = `${serializedContent.length}:${hash.toString(16).padStart(8, '0')}`

    expect(contentFingerprint).toBe('9330:bccead28')
  })
})

const votingPlayers: Player[] = [
  { id: 'a', name: 'Alex', role: 'INNOCENT', hasViewedRole: true },
  { id: 'b', name: 'Blair', role: 'IMPOSTOR', hasViewedRole: true },
  { id: 'c', name: 'Casey', role: 'INNOCENT', hasViewedRole: true },
]

describe('calculateVoteResult', () => {
  it('eliminates the single player with the most votes', () => {
    const votes: VoteRecord[] = [
      { voterId: 'a', targetId: 'b' },
      { voterId: 'b', targetId: 'c' },
      { voterId: 'c', targetId: 'b' },
    ]

    expect(calculateVoteResult(votingPlayers, votes)).toEqual({
      counts: { a: 0, b: 2, c: 1 },
      topCandidateIds: ['b'],
      eliminatedPlayerId: 'b',
      isTie: false,
    })
  })

  it('does not count skipped votes and eliminates nobody when all skip', () => {
    const votes = votingPlayers.map((player) => ({ voterId: player.id, targetId: null }))

    expect(calculateVoteResult(votingPlayers, votes)).toEqual({
      counts: { a: 0, b: 0, c: 0 },
      topCandidateIds: [],
      eliminatedPlayerId: null,
      isTie: false,
    })
  })

  it('reports every tied leader and eliminates nobody', () => {
    const votes: VoteRecord[] = [
      { voterId: 'a', targetId: 'b' },
      { voterId: 'b', targetId: 'a' },
      { voterId: 'c', targetId: null },
    ]

    expect(calculateVoteResult(votingPlayers, votes)).toEqual({
      counts: { a: 1, b: 1, c: 0 },
      topCandidateIds: ['a', 'b'],
      eliminatedPlayerId: null,
      isTie: true,
    })
  })
})

describe('voting lifecycle', () => {
  function discussionState() {
    return {
      ...createRound(validSetup, () => 0),
      phase: 'DISCUSSION' as const,
      players: votingPlayers,
    }
  }

  it('starts a fresh sequential ballot from discussion', () => {
    const state = startVoting(discussionState())
    expect(state).toMatchObject({ phase: 'VOTING', currentVoterIndex: 0, votes: [] })
  })

  it('rejects a self-vote and a target outside the round', () => {
    const state = startVoting(discussionState())
    expect(() => recordVote(state, 'a')).toThrow('You cannot vote for yourself.')
    expect(() => recordVote(state, 'missing')).toThrow('Choose a player in this round.')
  })

  it('records skipped votes and moves to the next voter', () => {
    const state = recordVote(startVoting(discussionState()), null)
    expect(state.currentVoterIndex).toBe(1)
    expect(state.votes).toEqual([{ voterId: 'a', targetId: null }])
  })

  it('calculates the result and moves to game over after the final voter', () => {
    let state = startVoting(discussionState())
    state = recordVote(state, 'b')
    state = recordVote(state, 'c')
    state = recordVote(state, 'b')

    expect(state.phase).toBe('GAME_OVER')
    expect(state.voteResult).toMatchObject({ eliminatedPlayerId: 'b', isTie: false })
  })

  it('moves to a private Outlier guess after the final vote', () => {
    const players: Player[] = [
      { id: 'a', name: 'Alex', role: 'INNOCENT', hasViewedRole: true },
      { id: 'b', name: 'Blair', role: 'IMPOSTOR', hasViewedRole: true },
      { id: 'c', name: 'Casey', role: 'OUTLIER', hasViewedRole: true },
      { id: 'd', name: 'Devon', role: 'INNOCENT', hasViewedRole: true },
    ]
    let state = startVoting({
      ...createRound({ ...validSetup, outlierEnabled: true }, () => 0),
      phase: 'DISCUSSION',
      players,
    })
    state = recordVote(state, 'b')
    state = recordVote(state, 'a')
    state = recordVote(state, 'b')
    state = recordVote(state, 'b')

    expect(state.phase).toBe('OUTLIER_GUESS')
    expect(state.voteResult?.eliminatedPlayerId).toBe('b')
  })
})

describe('special role outcomes', () => {
  function specialRoleState() {
    return {
      ...createRound({
        ...validSetup,
        playerNames: ['Alex', 'Blair', 'Casey', 'Devon', 'Emery'],
        jesterEnabled: true,
        outlierEnabled: true,
      }, () => 0),
      phase: 'OUTLIER_GUESS' as const,
      players: [
        { id: 'a', name: 'Alex', role: 'INNOCENT' as const, hasViewedRole: true },
        { id: 'b', name: 'Blair', role: 'IMPOSTOR' as const, hasViewedRole: true },
        { id: 'c', name: 'Casey', role: 'JESTER' as const, hasViewedRole: true },
        { id: 'd', name: 'Devon', role: 'OUTLIER' as const, hasViewedRole: true },
        { id: 'e', name: 'Emery', role: 'INNOCENT' as const, hasViewedRole: true },
      ],
      voteResult: {
        counts: { a: 0, b: 0, c: 4, d: 0, e: 1 },
        topCandidateIds: ['c'],
        eliminatedPlayerId: 'c',
        isTie: false,
      },
    }
  }

  it('accepts a trimmed case-insensitive word guess and completes the round', () => {
    const state = recordOutlierGuess(specialRoleState(), '  OTTER  ')

    expect(state.phase).toBe('GAME_OVER')
    expect(state.outlierGuesses).toEqual([
      { playerId: 'd', guess: 'OTTER', isCorrect: true },
    ])
  })

  it('rejects a blank Outlier guess', () => {
    expect(() => recordOutlierGuess(specialRoleState(), '   ')).toThrow(
      'Enter a guess for the secret word.',
    )
  })

  it('resolves Jester and Outlier wins from independent conditions', () => {
    const completed = recordOutlierGuess(specialRoleState(), 'otter')

    expect(calculateSpecialRoleOutcomes(completed)).toEqual([
      { playerId: 'c', role: 'JESTER', won: true, reason: 'Voted out' },
      { playerId: 'd', role: 'OUTLIER', won: true, reason: 'Guessed the word' },
    ])
  })

  it('does not let elimination make an incorrect Outlier guess win', () => {
    const state = specialRoleState()
    const completed = recordOutlierGuess({
      ...state,
      voteResult: {
        ...state.voteResult,
        counts: { a: 0, b: 0, c: 0, d: 4, e: 1 },
        topCandidateIds: ['d'],
        eliminatedPlayerId: 'd',
      },
    }, 'falcon')

    expect(calculateSpecialRoleOutcomes(completed).find((outcome) => outcome.role === 'OUTLIER')).toEqual({
      playerId: 'd',
      role: 'OUTLIER',
      won: false,
      reason: 'Incorrect guess',
    })
  })
})
