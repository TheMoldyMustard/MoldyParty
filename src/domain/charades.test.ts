import { describe, expect, it } from 'vitest'
import type { WordItem } from './types'
import {
  advanceFromSummary,
  applyFoul,
  beginTurn,
  createCharadesSession,
  getCurrentHolder,
  MODE_POLICIES,
  submitOutcome,
  syncClock,
  validateCharadesSettings,
  type CharadesSettings,
} from './charades'

const cards: WordItem[] = [
  { word: 'Adobo', category: 'food' },
  { word: 'Jeepney', category: 'object' },
  { word: 'Intramuros', category: 'place' },
]

const classicSettings: CharadesSettings = {
  mode: 'classic',
  packId: 'pack-1',
  packName: 'Pinoy Party',
  durationSeconds: 60,
  categories: [],
  vibes: [],
  motionEnabled: true,
  henyoTapAnswersEnabled: false,
  noRepeatEnabled: true,
}

describe('Charades mode policies and validation', () => {
  it('fixes Henyo at 120 seconds and exposes relay round choices', () => {
    expect(MODE_POLICIES.henyo.durationChoices).toEqual([120])
    expect(MODE_POLICIES['team-relay'].relayRounds).toEqual([3, 4, 5])
  })

  it('rejects invalid durations, small decks, and incomplete relay teams', () => {
    expect(validateCharadesSettings({ ...classicSettings, durationSeconds: 120 }, 3)).toContain('Choose a valid duration for Classic mode.')
    expect(validateCharadesSettings(classicSettings, 1)).toContain('Choose filters with at least 2 eligible words.')
    expect(validateCharadesSettings({
      ...classicSettings,
      mode: 'team-relay',
      teams: [
        { id: 'a', name: 'Molds', members: ['Alex'] },
        { id: 'b', name: '', members: [] },
      ],
      relayRounds: 3,
    }, 3)).toEqual(expect.arrayContaining([
      'Both teams need a name.',
      'Each team needs at least one member.',
    ]))
  })

  it('rejects relay assignments with unknown, duplicated, or unassigned session players', () => {
    const settings: CharadesSettings = {
      ...classicSettings,
      mode: 'team-relay',
      players: [
        { id: 'alex', name: 'Alex' },
        { id: 'blair', name: 'Blair' },
        { id: 'casey', name: 'Casey' },
      ],
      teams: [
        { id: 'a', name: 'Molds', members: ['Alex', 'Ghost'], memberPlayerIds: ['alex', 'ghost'] },
        { id: 'b', name: 'Spores', members: ['Alex'], memberPlayerIds: ['alex'] },
      ],
      relayRounds: 3,
    }
    expect(validateCharadesSettings(settings, 3)).toContain('Assign every player to exactly one team.')
    expect(validateCharadesSettings({
      ...settings,
      teams: [
        { id: 'a', name: 'Molds', members: ['Alex'], memberPlayerIds: ['alex'] },
        { id: 'b', name: 'Spores', members: ['Blair', 'Casey'] },
      ],
    }, 3)).toContain('Assign every player to exactly one team.')
  })
})

describe('Charades turn transitions', () => {
  it('rotates stable non-relay holders and records their identity and active duration', () => {
    const settings: CharadesSettings = {
      ...classicSettings,
      players: [
        { id: 'alex', name: 'Alex' },
        { id: 'blair', name: 'Blair' },
      ],
    }
    let session = createCharadesSession(settings, cards, () => 0.99)
    expect(getCurrentHolder(session)).toMatchObject({ playerId: 'alex', memberName: 'Alex' })
    session = beginTurn(session, 1_000)
    session = submitOutcome(session, 'correct', session.currentCardToken, 2_000, () => 0.99)
    session = syncClock(session, 61_000)
    expect(session.turnSummaries[0]).toMatchObject({
      holderPlayerId: 'alex',
      holderName: 'Alex',
      activeDurationMs: 60_000,
      statsRecorded: false,
    })
    session = advanceFromSummary(session)
    expect(getCurrentHolder(session)).toMatchObject({ playerId: 'blair', memberName: 'Blair' })
  })

  it('scores one card once and rejects a stale card token', () => {
    let session = createCharadesSession(classicSettings, cards, () => 0.99)
    session = beginTurn(session, 1_000)
    const token = session.currentCardToken
    const firstWord = session.currentCard?.word

    session = submitOutcome(session, 'correct', token, 2_000, () => 0.99)
    const afterStaleInput = submitOutcome(session, 'pass', token, 2_100, () => 0.99)

    expect(session.currentEvents).toEqual([expect.objectContaining({ word: firstWord, outcome: 'correct' })])
    expect(afterStaleInput).toBe(session)
    expect(session.currentCardToken).toBe(token + 1)
  })

  it('ends on the absolute deadline and records an ordered score summary', () => {
    let session = beginTurn(createCharadesSession(classicSettings, cards, () => 0.99), 1_000)
    session = submitOutcome(session, 'pass', session.currentCardToken, 2_000, () => 0.99)
    session = submitOutcome(session, 'correct', session.currentCardToken, 3_000, () => 0.99)
    session = syncClock(session, 61_000)

    expect(session.phase).toBe('ROUND_SUMMARY')
    expect(session.turnSummaries[0]).toMatchObject({
      score: 1,
      events: [
        { type: 'card', outcome: 'pass' },
        { type: 'card', outcome: 'correct' },
      ],
    })
    expect(submitOutcome(session, 'correct', session.currentCardToken, 61_000)).toBe(session)
  })

  it('applies a Henyo foul without changing the card and ends at zero', () => {
    const henyo = { ...classicSettings, mode: 'henyo' as const, durationSeconds: 120 as const, henyoTapAnswersEnabled: true }
    let session = beginTurn(createCharadesSession(henyo, cards, () => 0.99), 1_000)
    const card = session.currentCard
    const token = session.currentCardToken

    session = applyFoul(session, 116_500)

    expect(session.phase).toBe('ROUND_SUMMARY')
    expect(session.currentCard).toBeNull()
    expect(session.currentCardToken).toBe(token)
    expect(session.turnSummaries[0].events).toContainEqual(expect.objectContaining({ type: 'foul', seconds: -5 }))
    expect(card).not.toBeNull()
  })
})

describe('Team Relay scheduling', () => {
  it('alternates teams and rotates holders before ending after both teams finish every round', () => {
    const settings: CharadesSettings = {
      ...classicSettings,
      mode: 'team-relay',
      teams: [
        { id: 'molds', name: 'Molds', members: ['Alex', 'Blair'] },
        { id: 'spores', name: 'Spores', members: ['Casey', 'Devon'] },
      ],
      relayRounds: 3,
    }
    let session = createCharadesSession(settings, cards, () => 0.99)
    const holders: string[] = []

    for (let turn = 0; turn < 6; turn += 1) {
      holders.push(getCurrentHolder(session).memberName)
      session = beginTurn(session, turn * 100_000)
      session = syncClock(session, turn * 100_000 + 60_000)
      session = advanceFromSummary(session)
    }

    expect(holders).toEqual(['Alex', 'Casey', 'Blair', 'Devon', 'Alex', 'Casey'])
    expect(session.phase).toBe('SESSION_SUMMARY')
    expect(session.teamTurnCounts).toEqual([3, 3])
  })
})

describe('Deck cycling', () => {
  it('uses unseen words first and avoids putting the previous word first after exhaustion', () => {
    const session = createCharadesSession(classicSettings, cards, () => 0, {
      usedWordKeys: ['adobo', 'jeepney', 'intramuros'],
      previousWordKey: 'intramuros',
    })

    expect(session.remainingDeck.map((card) => card.key).sort()).toEqual(['adobo', 'intramuros', 'jeepney'])
    expect(session.remainingDeck[0].key).not.toBe('intramuros')
  })
})
