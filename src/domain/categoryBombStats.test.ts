import { describe, expect, it } from 'vitest'
import { acceptCategoryBombAnswer, armCategoryBombRound, callCategoryBombFoul, createCategoryBombRound } from './categoryBomb'
import { categoryBombPrompts } from './categoryBombCategories'
import { calculateCategoryBombRoundStats } from './categoryBombStats'

describe('Category Bomb session statistics', () => {
  it('derives accepted answers and foul explosions from one terminal round', () => {
    let round = createCategoryBombRound({
      turnPolicy: 'fair-cycle',
      passTimeBonusEnabled: false,
      passTimeBonusMinMs: 500,
      passTimeBonusMaxMs: 3_000,
      players: [
        { id: 'alex', name: 'Alex', seat: null },
        { id: 'blair', name: 'Blair', seat: null },
        { id: 'casey', name: 'Casey', seat: null },
      ],
    }, categoryBombPrompts, () => 0)
    round = armCategoryBombRound(round, () => 0, 1_000)
    const first = round.currentPlayerId!
    round = acceptCategoryBombAnswer(round, round.actionToken, 1_100, () => 0)
    const exploded = round.currentPlayerId!
    round = callCategoryBombFoul(round, round.actionToken, 1_200)

    expect(calculateCategoryBombRoundStats(round)).toEqual({
      playerDeltas: {
        alex: { bombsPlayed: 1, successfulAnswers: first === 'alex' ? 1 : 0, explosions: exploded === 'alex' ? 1 : 0, timerExplosions: 0, foulExplosions: exploded === 'alex' ? 1 : 0, bestBomb: first === 'alex' ? 1 : 0 },
        blair: { bombsPlayed: 1, successfulAnswers: first === 'blair' ? 1 : 0, explosions: exploded === 'blair' ? 1 : 0, timerExplosions: 0, foulExplosions: exploded === 'blair' ? 1 : 0, bestBomb: first === 'blair' ? 1 : 0 },
        casey: { bombsPlayed: 1, successfulAnswers: first === 'casey' ? 1 : 0, explosions: exploded === 'casey' ? 1 : 0, timerExplosions: 0, foulExplosions: exploded === 'casey' ? 1 : 0, bestBomb: first === 'casey' ? 1 : 0 },
      },
      completedBombs: 1,
      totalSuccessfulAnswers: 1,
      longestBomb: 1,
      timerExplosions: 0,
      foulExplosions: 1,
      categoryId: round.categoryId,
    })
  })

  it('rejects unfinished and already-recorded rounds', () => {
    const round = createCategoryBombRound({
      turnPolicy: 'fair-cycle',
      passTimeBonusEnabled: false,
      passTimeBonusMinMs: 500,
      passTimeBonusMaxMs: 3_000,
      players: [
        { id: 'alex', name: 'Alex', seat: null },
        { id: 'blair', name: 'Blair', seat: null },
      ],
    }, categoryBombPrompts, () => 0)
    expect(calculateCategoryBombRoundStats(round)).toBeNull()
    expect(calculateCategoryBombRoundStats({ ...callCategoryBombFoul(armCategoryBombRound(round, () => 0, 1_000), 1, 1_100), statsRecorded: true })).toBeNull()
  })
})
