import type { GameState, PlayerRole, PlayerStats, RoleCounter, RoundStatsDelta, VoteRecord } from './types'

const roles: PlayerRole[] = ['INNOCENT', 'IMPOSTOR', 'JESTER', 'OUTLIER']

function emptyRoleCounter(): RoleCounter {
  return Object.fromEntries(roles.map((role) => [role, 0])) as RoleCounter
}

export function emptyPlayerStats(): PlayerStats {
  return {
    roundsPlayed: 0,
    rolesPlayed: emptyRoleCounter(),
    correctImpostorGuesses: 0,
    wrongImpostorGuesses: 0,
    votesForJester: 0,
    votedOutAsJester: 0,
    correctOutlierGuesses: 0,
    wins: { total: 0, byRole: emptyRoleCounter() },
    losses: { total: 0, byRole: emptyRoleCounter() },
  }
}

function targetsFromVote(vote: VoteRecord): string[] {
  if (Array.isArray(vote.targetIds)) return vote.targetIds
  return vote.targetId ? [vote.targetId] : []
}

export function calculateRoundStats(state: GameState): RoundStatsDelta {
  if (state.phase !== 'GAME_OVER' || !state.voteResult) {
    throw new Error('Round stats require a completed game.')
  }

  const eliminatedIds = new Set(
    state.voteResult.eliminatedPlayerIds
      ?? (state.voteResult.eliminatedPlayerId ? [state.voteResult.eliminatedPlayerId] : []),
  )
  const playerById = new Map(state.players.map((player) => [player.id, player]))
  const caughtAnImpostor = state.players.some(
    (player) => player.role === 'IMPOSTOR' && eliminatedIds.has(player.id),
  )
  const delta: RoundStatsDelta = {}

  for (const player of state.players) {
    const stats = emptyPlayerStats()
    stats.roundsPlayed = 1
    stats.rolesPlayed[player.role] = 1

    const won = player.role === 'INNOCENT'
      ? caughtAnImpostor
      : player.role === 'IMPOSTOR'
        ? !caughtAnImpostor
        : player.role === 'JESTER'
          ? eliminatedIds.has(player.id)
          : state.outlierGuesses.some((guess) => guess.playerId === player.id && guess.isCorrect)

    const outcome = won ? stats.wins : stats.losses
    outcome.total = 1
    outcome.byRole[player.role] = 1

    if (player.role === 'JESTER' && eliminatedIds.has(player.id)) {
      stats.votedOutAsJester = 1
    }
    if (
      player.role === 'OUTLIER'
      && state.outlierGuesses.some((guess) => guess.playerId === player.id && guess.isCorrect)
    ) {
      stats.correctOutlierGuesses = 1
    }
    delta[player.id] = stats
  }

  if (!state.absoluteVotingEnabled) {
    for (const vote of state.votes) {
      const voter = playerById.get(vote.voterId)
      const stats = delta[vote.voterId]
      if (!voter || !stats) continue

      for (const targetId of targetsFromVote(vote)) {
        const target = playerById.get(targetId)
        if (!target) continue
        if (target.role === 'IMPOSTOR') stats.correctImpostorGuesses += 1
        else if (voter.role === 'INNOCENT') stats.wrongImpostorGuesses += 1
        if (target.role === 'JESTER') stats.votesForJester += 1
      }
    }
  }

  return delta
}
