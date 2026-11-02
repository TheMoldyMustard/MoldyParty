import type {
  GameSetupInput,
  GameState,
  Player,
  SetupErrors,
  VoteRecord,
  VoteResult,
} from './types'

const MIN_PLAYERS = 3

export function validateSetup(input: GameSetupInput): SetupErrors {
  const errors: string[] = []
  const trimmedNames = input.playerNames.map((name) => name.trim())
  const comparableNames = trimmedNames.filter(Boolean).map((name) => name.toLocaleLowerCase())

  if (input.playerNames.length < MIN_PLAYERS) {
    errors.push('Add at least 3 players.')
  }
  if (trimmedNames.some((name) => !name)) {
    errors.push('Every player needs a name.')
  }
  if (new Set(comparableNames).size !== comparableNames.length) {
    errors.push('Player names must be unique.')
  }
  if (input.impostorCount < 1 || input.impostorCount >= input.playerNames.length) {
    errors.push('Choose at least 1 impostor and fewer impostors than players.')
  }
  if (input.pack.items.length === 0) {
    errors.push('Choose a word pack with at least one item.')
  }
  if (
    input.discussionDurationSeconds !== null &&
    (!Number.isInteger(input.discussionDurationSeconds) || input.discussionDurationSeconds < 0)
  ) {
    errors.push('Discussion time must be zero or a positive number of seconds.')
  }

  return errors
}

function shuffledIndexes(length: number, random: () => number): number[] {
  const indexes = Array.from({ length }, (_, index) => index)
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]]
  }
  return indexes
}

export function createRound(input: GameSetupInput, random: () => number = Math.random): GameState {
  const errors = validateSetup(input)
  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }

  const wordIndex = Math.min(
    input.pack.items.length - 1,
    Math.floor(random() * input.pack.items.length),
  )
  const selectedItem = input.pack.items[wordIndex]
  const impostorIndexes = new Set(
    shuffledIndexes(input.playerNames.length, random).slice(0, input.impostorCount),
  )

  return {
    phase: 'ROLE_REVEAL',
    round: input.round ?? 1,
    players: input.playerNames.map((name, index) => ({
      id: `player-${index + 1}`,
      name: name.trim(),
      role: impostorIndexes.has(index) ? 'IMPOSTOR' : 'INNOCENT',
      hasViewedRole: false,
    })),
    impostorCount: input.impostorCount,
    selectedPackId: input.pack.id,
    selectedPackName: input.pack.packName,
    currentWord: selectedItem.word,
    currentHint: selectedItem.hint,
    hintsEnabled: input.hintsEnabled,
    discussionDurationSeconds: input.discussionDurationSeconds,
    currentRevealIndex: 0,
    isRoleVisible: false,
    currentVoterIndex: 0,
    votes: [],
    voteResult: null,
  }
}

export function advanceRoleReveal(state: GameState): GameState {
  if (state.phase !== 'ROLE_REVEAL') {
    return state
  }

  const players = state.players.map((player, index) =>
    index === state.currentRevealIndex ? { ...player, hasViewedRole: true } : player,
  )
  const isLastPlayer = state.currentRevealIndex === state.players.length - 1

  return {
    ...state,
    players,
    phase: isLastPlayer ? 'DISCUSSION' : 'ROLE_REVEAL',
    currentRevealIndex: isLastPlayer ? state.currentRevealIndex : state.currentRevealIndex + 1,
    isRoleVisible: false,
  }
}

export function calculateVoteResult(players: Player[], votes: VoteRecord[]): VoteResult {
  const counts = Object.fromEntries(players.map((player) => [player.id, 0]))
  for (const vote of votes) {
    if (vote.targetId !== null && vote.targetId in counts) {
      counts[vote.targetId] += 1
    }
  }

  const highestCount = Math.max(0, ...Object.values(counts))
  const topCandidateIds = highestCount === 0
    ? []
    : players.filter((player) => counts[player.id] === highestCount).map((player) => player.id)
  const isTie = topCandidateIds.length > 1

  return {
    counts,
    topCandidateIds,
    eliminatedPlayerId: topCandidateIds.length === 1 ? topCandidateIds[0] : null,
    isTie,
  }
}

export function startVoting(state: GameState): GameState {
  if (state.phase !== 'DISCUSSION') {
    return state
  }
  return {
    ...state,
    phase: 'VOTING',
    currentVoterIndex: 0,
    votes: [],
    voteResult: null,
  }
}

export function recordVote(state: GameState, targetId: string | null): GameState {
  if (state.phase !== 'VOTING') {
    return state
  }

  const voter = state.players[state.currentVoterIndex]
  if (targetId === voter.id) {
    throw new Error('You cannot vote for yourself.')
  }
  if (targetId !== null && !state.players.some((player) => player.id === targetId)) {
    throw new Error('Choose a player in this round.')
  }

  const votes = [...state.votes, { voterId: voter.id, targetId }]
  const isLastVoter = state.currentVoterIndex === state.players.length - 1

  return {
    ...state,
    phase: isLastVoter ? 'GAME_OVER' : 'VOTING',
    currentVoterIndex: isLastVoter ? state.currentVoterIndex : state.currentVoterIndex + 1,
    votes,
    voteResult: isLastVoter ? calculateVoteResult(state.players, votes) : null,
  }
}
