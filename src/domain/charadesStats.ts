import type { CharadesCategory } from './types'
import { getTeamScores, type CharadesMode, type CharadesSession, type CharadesTurnSummary } from './charades'

export interface CharadesCountStats {
  turnsPlayed: number
  correct: number
  passes: number
}

export interface CharadesCategoryStats {
  attempted: number
  correct: number
}

export interface CharadesPlayerStats {
  turnsPlayed: number
  correct: number
  passes: number
  activeDurationMs: number
  bestTurn: number
  longestCorrectStreak: number
  henyoFouls: number
  relayWins: number
  relayLosses: number
  relayTies: number
  byMode: Record<CharadesMode, CharadesCountStats>
  byCategory: Record<CharadesCategory, CharadesCategoryStats>
}

export interface CharadesTurnStatsDelta {
  playerId: string
  delta: CharadesPlayerStats
}

const modes: CharadesMode[] = ['classic', 'henyo', 'one-word', 'team-relay']
const categories: CharadesCategory[] = ['person', 'place', 'object', 'animal', 'food', 'pop-culture', 'other']

export function emptyCharadesPlayerStats(): CharadesPlayerStats {
  return {
    turnsPlayed: 0,
    correct: 0,
    passes: 0,
    activeDurationMs: 0,
    bestTurn: 0,
    longestCorrectStreak: 0,
    henyoFouls: 0,
    relayWins: 0,
    relayLosses: 0,
    relayTies: 0,
    byMode: Object.fromEntries(modes.map((mode) => [mode, { turnsPlayed: 0, correct: 0, passes: 0 }])) as Record<CharadesMode, CharadesCountStats>,
    byCategory: Object.fromEntries(categories.map((category) => [category, { attempted: 0, correct: 0 }])) as Record<CharadesCategory, CharadesCategoryStats>,
  }
}

export function calculateCharadesTurnStats(summary: CharadesTurnSummary, mode: CharadesMode): CharadesTurnStatsDelta | null {
  if (!summary.holderPlayerId || summary.statsRecorded) return null
  const cards = summary.events.filter((event) => event.type === 'card')
  const correct = cards.filter((event) => event.outcome === 'correct').length
  const passes = cards.length - correct
  let currentStreak = 0
  let longestCorrectStreak = 0
  for (const event of cards) {
    currentStreak = event.outcome === 'correct' ? currentStreak + 1 : 0
    longestCorrectStreak = Math.max(longestCorrectStreak, currentStreak)
  }
  const delta = emptyCharadesPlayerStats()
  delta.turnsPlayed = 1
  delta.correct = correct
  delta.passes = passes
  delta.activeDurationMs = summary.activeDurationMs
  delta.bestTurn = correct
  delta.longestCorrectStreak = longestCorrectStreak
  delta.henyoFouls = summary.events.filter((event) => event.type === 'foul').length
  delta.byMode[mode] = { turnsPlayed: 1, correct, passes }
  for (const event of cards) {
    const category = delta.byCategory[event.category]
    category.attempted += 1
    if (event.outcome === 'correct') category.correct += 1
  }
  return { playerId: summary.holderPlayerId, delta }
}

export function calculateCharadesRelayResult(session: CharadesSession): Record<string, 'win' | 'loss' | 'tie'> | null {
  if (session.phase !== 'SESSION_SUMMARY' || session.settings.mode !== 'team-relay' || session.relayResultRecorded || !session.settings.teams) return null
  const [first, second] = getTeamScores(session)
  const tied = first === second
  const winningIndex = first > second ? 0 : 1
  const result: Record<string, 'win' | 'loss' | 'tie'> = {}
  for (const [teamIndex, team] of session.settings.teams.entries()) {
    if (!team.memberPlayerIds) return null
    for (const playerId of team.memberPlayerIds) result[playerId] = tied ? 'tie' : teamIndex === winningIndex ? 'win' : 'loss'
  }
  return result
}
