import { describe, expect, it, vi } from 'vitest'
import {
  acceptCategoryBombAnswer,
  armCategoryBombRound,
  callCategoryBombFoul,
  createCategoryBombRound,
  deriveCategoryBombDisplayMode,
  getCategoryBombArrowAngle,
  replayCategoryBombRound,
  sampleCategoryBombDurationMs,
  swapCategoryBombSeats,
  syncCategoryBombClock,
  validateCategoryBombSettings,
  type CategoryBombPlayer,
  type CategoryBombRound,
  type CategoryBombSettings,
} from './categoryBomb'
import { categoryBombPrompts } from './categoryBombCategories'

function players(count: number): CategoryBombPlayer[] {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}`, seat: null }))
}

function settings(count = 4, turnPolicy: CategoryBombSettings['turnPolicy'] = 'fair-cycle'): CategoryBombSettings {
  return {
    players: players(count),
    turnPolicy,
    passTimeBonusEnabled: false,
    passTimeBonusMinMs: 500,
    passTimeBonusMaxMs: 3_000,
  }
}

function sequenceRandom(values: number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)] ?? 0
}

function activeRound(count = 4, turnPolicy: CategoryBombSettings['turnPolicy'] = 'fair-cycle'): CategoryBombRound {
  const prepared = createCategoryBombRound(settings(count, turnPolicy), categoryBombPrompts, () => 0)
  return armCategoryBombRound(prepared, () => 0, 1_000)
}

describe('Category Bomb validation and display modes', () => {
  it('rejects invalid rosters and validates fifty unique players', () => {
    expect(validateCategoryBombSettings(settings(1))).toContain('Add at least 2 players.')
    expect(validateCategoryBombSettings({ players: [
      { id: 'a', name: ' Alex ', seat: null },
      { id: 'b', name: 'alex', seat: null },
    ], turnPolicy: 'fair-cycle', passTimeBonusEnabled: false, passTimeBonusMinMs: 500, passTimeBonusMaxMs: 3_000 })).toContain('Player names must be unique.')
    expect(validateCategoryBombSettings({ players: [
      { id: 'a', name: '', seat: null },
      { id: 'b', name: 'Blair', seat: null },
    ], turnPolicy: 'fair-cycle', passTimeBonusEnabled: false, passTimeBonusMinMs: 500, passTimeBonusMaxMs: 3_000 })).toContain('Every player needs a name.')
    expect(validateCategoryBombSettings({ players: [
      { id: 'a', name: 'A'.repeat(25), seat: null },
      { id: 'b', name: 'Blair', seat: null },
    ], turnPolicy: 'fair-cycle', passTimeBonusEnabled: false, passTimeBonusMinMs: 500, passTimeBonusMaxMs: 3_000 })).toContain('Player names must be 24 characters or fewer.')
    expect(validateCategoryBombSettings(settings(50))).toEqual([])
  })

  it('validates the retained pass-time bonus range even while disabled', () => {
    expect(validateCategoryBombSettings({ ...settings(), passTimeBonusEnabled: 'yes' as unknown as boolean })).toContain('Choose whether to add random time on pass.')
    expect(validateCategoryBombSettings({ ...settings(), passTimeBonusMinMs: -100 })).toContain('Pass-time bonus must stay between 0 and 10 seconds.')
    expect(validateCategoryBombSettings({ ...settings(), passTimeBonusMaxMs: 10_100 })).toContain('Pass-time bonus must stay between 0 and 10 seconds.')
    expect(validateCategoryBombSettings({ ...settings(), passTimeBonusMinMs: 550 })).toContain('Pass-time bonus must use 0.1-second increments.')
    expect(validateCategoryBombSettings({ ...settings(), passTimeBonusMinMs: 3_000, passTimeBonusMaxMs: 500 })).toContain('Minimum pass-time bonus cannot exceed maximum.')
    expect(validateCategoryBombSettings({ ...settings(), passTimeBonusMinMs: Number.NaN })).toContain('Pass-time bonus must be a finite number.')
  })

  it('derives radial through twelve players and name-only from thirteen', () => {
    expect(deriveCategoryBombDisplayMode(2)).toBe('radial')
    expect(deriveCategoryBombDisplayMode(12)).toBe('radial')
    expect(deriveCategoryBombDisplayMode(13)).toBe('name-only')
    expect(deriveCategoryBombDisplayMode(50)).toBe('name-only')
  })

  it('assigns unique radial seats but clears every large-group seat', () => {
    const radial = createCategoryBombRound(settings(12), categoryBombPrompts, () => 0)
    expect(radial.phase).toBe('PLACEMENT')
    expect(new Set(radial.settings.players.map((player) => player.seat)).size).toBe(12)

    const large = createCategoryBombRound(settings(13), categoryBombPrompts, () => 0)
    expect(large.phase).toBe('READY')
    expect(large.settings.players.every((player) => player.seat === null)).toBe(true)
  })

  it('swaps radial seats and derives the arrow angle from the active seat', () => {
    const round = createCategoryBombRound(settings(4), categoryBombPrompts, () => 0)
    const [first, second] = round.settings.players
    const swapped = swapCategoryBombSeats(round, first.id, second.id)
    expect(swapped.settings.players[0].seat).toBe(second.seat)
    expect(swapped.settings.players[1].seat).toBe(first.seat)

    const armed = armCategoryBombRound(swapped, () => 0, 1_000)
    expect(getCategoryBombArrowAngle(armed)).toBeTypeOf('number')
  })

  it('gives every radial seat a distinct arrow target', () => {
    const round = createCategoryBombRound(settings(12), categoryBombPrompts, () => 0)
    const angles = round.settings.players.map((player) => getCategoryBombArrowAngle({
      ...round,
      currentPlayerId: player.id,
    }))
    expect(new Set(angles).size).toBe(12)
  })
})

describe('Category Bomb timer and turn policies', () => {
  it('attributes each accepted answer to the holder before passing the turn', () => {
    let round = activeRound(3)
    const firstHolder = round.currentPlayerId
    round = acceptCategoryBombAnswer(round, round.actionToken, 1_100, () => 0)
    const secondHolder = round.currentPlayerId
    round = acceptCategoryBombAnswer(round, round.actionToken, 1_200, () => 0)

    expect(round.acceptedAnswerPlayerIds).toEqual([firstHolder, secondHolder])
    expect(round.startedAtMs).toBe(1_000)
    expect(round.statsRecorded).toBe(false)
  })

  it('samples inclusive player-relative duration boundaries', () => {
    expect(sampleCategoryBombDurationMs(2, () => 0)).toBe(26_000)
    expect(sampleCategoryBombDurationMs(2, () => 0.999999)).toBe(40_000)
    expect(sampleCategoryBombDurationMs(12, () => 0)).toBe(56_000)
    expect(sampleCategoryBombDurationMs(12, () => 0.999999)).toBe(90_000)
    expect(sampleCategoryBombDurationMs(50, () => 0)).toBe(170_000)
  })

  it('visits every player once before a new fair cycle and avoids immediate repeats', () => {
    let round = activeRound(4)
    const seen = [round.currentPlayerId]
    for (let index = 0; index < 3; index += 1) {
      round = acceptCategoryBombAnswer(round, round.actionToken, 1_100 + index, () => 0)
      seen.push(round.currentPlayerId)
    }
    expect(new Set(seen).size).toBe(4)
    const previous = round.currentPlayerId
    round = acceptCategoryBombAnswer(round, round.actionToken, 1_200, () => 0)
    expect(round.currentPlayerId).not.toBe(previous)
  })

  it('allows Chaos to revisit a prior player before full coverage but not the current player', () => {
    let round = activeRound(4, 'chaos')
    const first = round.currentPlayerId
    round = acceptCategoryBombAnswer(round, round.actionToken, 1_100, () => 0)
    const second = round.currentPlayerId
    round = acceptCategoryBombAnswer(round, round.actionToken, 1_200, () => 0)
    expect(round.currentPlayerId).toBe(first)
    expect(round.currentPlayerId).not.toBe(second)
  })

  it('adds no time and consumes no bonus random draw when disabled', () => {
    let round = activeRound(3)
    const originalDeadline = round.deadlineMs!
    const staleToken = round.actionToken
    const random = vi.fn(() => 0.5)
    round = acceptCategoryBombAnswer(round, staleToken, 1_100, random)
    expect(round.deadlineMs).toBe(originalDeadline)
    expect(round.extensionGrantedMs).toBe(0)
    expect(round.lastAppliedPassBonusMs).toBe(0)
    expect(random).not.toHaveBeenCalled()
    expect(acceptCategoryBombAnswer(round, staleToken, 1_200, () => 0)).toBe(round)
  })

  it('samples inclusive 0.1-second bonuses and applies only the remaining cap allowance', () => {
    const enabled = { ...settings(3), passTimeBonusEnabled: true }
    let round = armCategoryBombRound(createCategoryBombRound(enabled, categoryBombPrompts, () => 0), () => 0, 1_000)
    const originalDeadline = round.deadlineMs!

    round = acceptCategoryBombAnswer(round, round.actionToken, 1_100, () => 0)
    expect(round.lastAppliedPassBonusMs).toBe(500)
    round = acceptCategoryBombAnswer(round, round.actionToken, 1_200, () => 0.999999)
    expect(round.lastAppliedPassBonusMs).toBe(3_000)
    for (let index = 0; index < 4; index += 1) round = acceptCategoryBombAnswer(round, round.actionToken, 1_300 + index, () => 0.999999)
    expect(round.lastAppliedPassBonusMs).toBe(2_500)
    expect(round.extensionGrantedMs).toBe(15_000)
    expect(round.deadlineMs).toBe(originalDeadline + 15_000)
  })

  it('lets exact deadline expiry win over answers and fouls exactly once', () => {
    const round = activeRound(3)
    const deadline = round.deadlineMs!
    const answered = acceptCategoryBombAnswer(round, round.actionToken, deadline, () => 0)
    expect(answered.phase).toBe('EXPLODED')
    expect(answered.explodedPlayerId).toBe(round.currentPlayerId)
    expect(answered.explosionReason).toBe('timer')
    expect(callCategoryBombFoul(round, round.actionToken, deadline).explosionReason).toBe('timer')
    expect(syncCategoryBombClock(answered, deadline + 1_000)).toBe(answered)
  })

  it('records a deliberate foul against the current player', () => {
    const round = activeRound(3)
    const exploded = callCategoryBombFoul(round, round.actionToken, 1_100)
    expect(exploded).toMatchObject({
      phase: 'EXPLODED',
      explodedPlayerId: round.currentPlayerId,
      explosionReason: 'foul',
    })
  })
})

describe('Category Bomb replay', () => {
  it('keeps roster, layout, and policy while changing category when possible', () => {
    const round = callCategoryBombFoul(activeRound(13), 1, 1_100)
    const replayed = replayCategoryBombRound(round, categoryBombPrompts, sequenceRandom([0.99, 0, 0, 0]), 2_000)
    expect(replayed.phase).toBe('ACTIVE')
    expect(replayed.displayMode).toBe('name-only')
    expect(replayed.settings.players).toHaveLength(13)
    expect(replayed.settings.players.every((player) => player.seat === null)).toBe(true)
    expect(replayed.categoryId).not.toBe(round.categoryId)
    expect(replayed.extensionGrantedMs).toBe(0)
    expect(replayed.lastAppliedPassBonusMs).toBe(0)
    expect(replayed.settings).toMatchObject({
      passTimeBonusEnabled: false,
      passTimeBonusMinMs: 500,
      passTimeBonusMaxMs: 3_000,
    })
  })
})
