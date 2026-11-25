import { describe, expect, it } from 'vitest'
import { advanceFromSummary, beginTurn, createCharadesSession, submitOutcome, syncClock, type CharadesSettings, type CharadesTurnSummary } from './charades'
import { calculateCharadesRelayResult, calculateCharadesTurnStats } from './charadesStats'

describe('Charades session statistics', () => {
  it('derives holder performance, streaks, fouls, mode, and category counters', () => {
    const summary: CharadesTurnSummary = {
      teamId: null,
      teamName: null,
      holderPlayerId: 'alex',
      holderName: 'Alex',
      score: 2,
      activeDurationMs: 60_000,
      statsRecorded: false,
      events: [
        { type: 'card', key: 'a', word: 'Adobo', category: 'food', outcome: 'correct', occurredAtMs: 1_000 },
        { type: 'card', key: 'b', word: 'Jeepney', category: 'object', outcome: 'correct', occurredAtMs: 2_000 },
        { type: 'foul', seconds: -5, occurredAtMs: 2_500 },
        { type: 'card', key: 'c', word: 'Mayon', category: 'place', outcome: 'pass', occurredAtMs: 3_000 },
      ],
    }

    expect(calculateCharadesTurnStats(summary, 'henyo')).toMatchObject({
      playerId: 'alex',
      delta: {
        turnsPlayed: 1,
        correct: 2,
        passes: 1,
        activeDurationMs: 60_000,
        bestTurn: 2,
        longestCorrectStreak: 2,
        henyoFouls: 1,
        byMode: { henyo: { turnsPlayed: 1, correct: 2, passes: 1 } },
        byCategory: {
          food: { attempted: 1, correct: 1 },
          object: { attempted: 1, correct: 1 },
          place: { attempted: 1, correct: 0 },
        },
      },
    })
  })

  it('rejects unattributed or already-recorded summaries', () => {
    const summary = {
      teamId: null,
      teamName: null,
      holderPlayerId: null,
      holderName: 'Next player',
      score: 0,
      activeDurationMs: 60_000,
      statsRecorded: false,
      events: [],
    } satisfies CharadesTurnSummary
    expect(calculateCharadesTurnStats(summary, 'classic')).toBeNull()
    expect(calculateCharadesTurnStats({ ...summary, holderPlayerId: 'alex', statsRecorded: true }, 'classic')).toBeNull()
  })

  it('attributes a completed relay win or loss to every assigned player once', () => {
    const settings: CharadesSettings = {
      mode: 'team-relay',
      packId: 'pack-1',
      packName: 'Party',
      durationSeconds: 60,
      categories: [],
      vibes: [],
      motionEnabled: false,
      henyoTapAnswersEnabled: false,
      noRepeatEnabled: false,
      players: [
        { id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' },
        { id: 'casey', name: 'Casey' }, { id: 'devon', name: 'Devon' },
      ],
      teams: [
        { id: 'molds', name: 'Molds', members: ['Alex', 'Blair'], memberPlayerIds: ['alex', 'blair'] },
        { id: 'spores', name: 'Spores', members: ['Casey', 'Devon'], memberPlayerIds: ['casey', 'devon'] },
      ],
      relayRounds: 3,
    }
    const cards = [{ word: 'Adobo', category: 'food' as const }, { word: 'Jeepney', category: 'object' as const }]
    let session = createCharadesSession(settings, cards, () => 0.99)
    for (let turn = 0; turn < 6; turn += 1) {
      session = beginTurn(session, turn * 100_000)
      if (session.activeTeamIndex === 0) session = submitOutcome(session, 'correct', session.currentCardToken, turn * 100_000 + 1_000, () => 0.99)
      session = syncClock(session, turn * 100_000 + 60_000)
      session = advanceFromSummary(session)
    }
    expect(calculateCharadesRelayResult(session)).toEqual({ alex: 'win', blair: 'win', casey: 'loss', devon: 'loss' })
    expect(calculateCharadesRelayResult({ ...session, relayResultRecorded: true })).toBeNull()
  })
})
