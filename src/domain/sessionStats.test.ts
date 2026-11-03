import { describe, expect, it } from 'vitest'
import { calculateRoundStats } from './sessionStats'
import type { GameState, Player } from './types'

const players: Player[] = [
  { id: 'innocent', name: 'Alex', role: 'INNOCENT', hasViewedRole: true },
  { id: 'impostor', name: 'Blair', role: 'IMPOSTOR', hasViewedRole: true },
  { id: 'jester', name: 'Casey', role: 'JESTER', hasViewedRole: true },
  { id: 'outlier', name: 'Devon', role: 'OUTLIER', hasViewedRole: true },
]

function completedRound(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'GAME_OVER',
    round: 1,
    players,
    impostorCount: 1,
    selectedPackId: 'test-pack',
    selectedPackName: 'Test Pack',
    currentWord: 'Otter',
    currentHint: 'Water',
    hintsEnabled: true,
    jesterEnabled: true,
    outlierEnabled: true,
    outlierHintsEnabled: false,
    absoluteVotingEnabled: false,
    discussionDurationSeconds: null,
    currentRevealIndex: 3,
    isRoleVisible: false,
    currentVoterIndex: 3,
    votes: [
      { voterId: 'innocent', targetId: 'impostor' },
      { voterId: 'impostor', targetId: 'jester' },
      { voterId: 'jester', targetId: 'impostor' },
      { voterId: 'outlier', targetId: 'innocent' },
    ],
    groupVote: null,
    voteResult: {
      counts: { innocent: 1, impostor: 2, jester: 1, outlier: 0 },
      topCandidateIds: ['impostor'],
      eliminatedPlayerIds: ['impostor', 'jester'],
      eliminatedPlayerId: null,
      isTie: true,
    },
    currentOutlierGuessIndex: 0,
    outlierGuesses: [{ playerId: 'outlier', guess: 'Otter', isCorrect: true }],
    ...overrides,
  }
}

describe('calculateRoundStats', () => {
  it('rejects an incomplete round instead of partially counting it', () => {
    expect(() => calculateRoundStats(completedRound({ phase: 'VOTING', voteResult: null })))
      .toThrow('Round stats require a completed game.')
  })

  it('attributes private votes and independent role outcomes to each player', () => {
    const delta = calculateRoundStats(completedRound())

    expect(delta.innocent).toMatchObject({
      roundsPlayed: 1,
      correctImpostorGuesses: 1,
      wrongImpostorGuesses: 0,
      wins: { total: 1, byRole: { INNOCENT: 1, IMPOSTOR: 0, JESTER: 0, OUTLIER: 0 } },
      losses: { total: 0, byRole: { INNOCENT: 0, IMPOSTOR: 0, JESTER: 0, OUTLIER: 0 } },
    })
    expect(delta.impostor).toMatchObject({
      votesForJester: 1,
      losses: { total: 1, byRole: { INNOCENT: 0, IMPOSTOR: 1, JESTER: 0, OUTLIER: 0 } },
    })
    expect(delta.jester).toMatchObject({
      correctImpostorGuesses: 1,
      votedOutAsJester: 1,
      wins: { total: 1, byRole: { INNOCENT: 0, IMPOSTOR: 0, JESTER: 1, OUTLIER: 0 } },
    })
    expect(delta.outlier).toMatchObject({
      correctOutlierGuesses: 1,
      wins: { total: 1, byRole: { INNOCENT: 0, IMPOSTOR: 0, JESTER: 0, OUTLIER: 1 } },
    })
    expect(delta.innocent.rolesPlayed).toEqual({ INNOCENT: 1, IMPOSTOR: 0, JESTER: 0, OUTLIER: 0 })
  })

  it('counts each non-impostor private target as a wrong Innocent guess', () => {
    const delta = calculateRoundStats(completedRound({
      votes: [
        { voterId: 'innocent', targetIds: ['jester', 'outlier'] },
        { voterId: 'impostor', targetId: 'innocent' },
        { voterId: 'jester', targetId: 'impostor' },
        { voterId: 'outlier', targetId: 'innocent' },
      ],
    }))

    expect(delta.innocent.wrongImpostorGuesses).toBe(2)
    expect(delta.innocent.votesForJester).toBe(1)
  })

  it('does not invent per-player vote attribution for Group Vote', () => {
    const delta = calculateRoundStats(completedRound({
      absoluteVotingEnabled: true,
      votes: [],
      groupVote: ['impostor', 'jester'],
    }))

    for (const player of players) {
      expect(delta[player.id]).toMatchObject({
        correctImpostorGuesses: 0,
        wrongImpostorGuesses: 0,
        votesForJester: 0,
      })
    }
    expect(delta.innocent.wins.total).toBe(1)
    expect(delta.jester.votedOutAsJester).toBe(1)
  })

  it('awards Impostor wins and Innocent losses when no Impostor is eliminated', () => {
    const delta = calculateRoundStats(completedRound({
      votes: players.map((player) => ({ voterId: player.id, targetId: null })),
      voteResult: {
        counts: { innocent: 0, impostor: 0, jester: 0, outlier: 0 },
        topCandidateIds: [],
        eliminatedPlayerIds: [],
        eliminatedPlayerId: null,
        isTie: false,
      },
      outlierGuesses: [{ playerId: 'outlier', guess: 'Falcon', isCorrect: false }],
    }))

    expect(delta.impostor.wins.byRole.IMPOSTOR).toBe(1)
    expect(delta.innocent.losses.byRole.INNOCENT).toBe(1)
    expect(delta.jester.losses.byRole.JESTER).toBe(1)
    expect(delta.outlier.losses.byRole.OUTLIER).toBe(1)
  })
})
