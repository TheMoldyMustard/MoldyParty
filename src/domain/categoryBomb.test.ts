import { describe, expect, it } from 'vitest'
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
  return { players: players(count), turnPolicy }
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
    ], turnPolicy: 'fair-cycle' })).toContain('Player names must be unique.')
    expect(validateCategoryBombSettings({ players: [
      { id: 'a', name: '', seat: null },
      { id: 'b', name: 'Blair', seat: null },
    ], turnPolicy: 'fair-cycle' })).toContain('Every player needs a name.')
    expect(validateCategoryBombSettings({ players: [
      { id: 'a', name: 'A'.repeat(25), seat: null },
      { id: 'b', name: 'Blair', seat: null },
    ], turnPolicy: 'fair-cycle' })).toContain('Player names must be 24 characters or fewer.')
    expect(validateCategoryBombSettings(settings(50))).toEqual([])
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
})

describe('Category Bomb timer and turn policies', () => {
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

  it('adds short leeway up to the cap and rejects stale actions', () => {
    let round = activeRound(3)
    const originalDeadline = round.deadlineMs!
    const staleToken = round.actionToken
    round = acceptCategoryBombAnswer(round, staleToken, 1_100, () => 0)
    expect(round.deadlineMs).toBe(originalDeadline + 1_500)
    expect(round.extensionGrantedMs).toBe(1_500)
    expect(acceptCategoryBombAnswer(round, staleToken, 1_200, () => 0)).toBe(round)
    for (let index = 0; index < 20; index += 1) {
      round = acceptCategoryBombAnswer(round, round.actionToken, 1_300 + index, () => 0)
    }
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
  })
})
