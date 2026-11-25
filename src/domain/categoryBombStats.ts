import type { CategoryBombRound } from './categoryBomb'

export interface CategoryBombPlayerStats {
  bombsPlayed: number
  successfulAnswers: number
  explosions: number
  timerExplosions: number
  foulExplosions: number
  bestBomb: number
}

export interface CategoryBombRoundStatsDelta {
  playerDeltas: Record<string, CategoryBombPlayerStats>
  completedBombs: number
  totalSuccessfulAnswers: number
  longestBomb: number
  timerExplosions: number
  foulExplosions: number
  categoryId: string
}

export function emptyCategoryBombPlayerStats(): CategoryBombPlayerStats {
  return {
    bombsPlayed: 0,
    successfulAnswers: 0,
    explosions: 0,
    timerExplosions: 0,
    foulExplosions: 0,
    bestBomb: 0,
  }
}

export function calculateCategoryBombRoundStats(round: CategoryBombRound): CategoryBombRoundStatsDelta | null {
  if (round.phase !== 'EXPLODED' || round.statsRecorded || !round.explodedPlayerId || !round.explosionReason) return null
  const answerCounts = round.acceptedAnswerPlayerIds.reduce<Record<string, number>>((counts, playerId) => {
    counts[playerId] = (counts[playerId] ?? 0) + 1
    return counts
  }, {})
  const playerDeltas = Object.fromEntries(round.settings.players.map((player) => {
    const successfulAnswers = answerCounts[player.id] ?? 0
    const exploded = player.id === round.explodedPlayerId
    return [player.id, {
      bombsPlayed: 1,
      successfulAnswers,
      explosions: exploded ? 1 : 0,
      timerExplosions: exploded && round.explosionReason === 'timer' ? 1 : 0,
      foulExplosions: exploded && round.explosionReason === 'foul' ? 1 : 0,
      bestBomb: successfulAnswers,
    }]
  }))
  return {
    playerDeltas,
    completedBombs: 1,
    totalSuccessfulAnswers: round.acceptedAnswerPlayerIds.length,
    longestBomb: round.acceptedAnswerPlayerIds.length,
    timerExplosions: round.explosionReason === 'timer' ? 1 : 0,
    foulExplosions: round.explosionReason === 'foul' ? 1 : 0,
    categoryId: round.categoryId,
  }
}
