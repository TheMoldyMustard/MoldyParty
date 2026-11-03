import type {
  GameSetupInput,
  GameState,
  Player,
  SpecialRoleOutcome,
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
  if (
    typeof input.jesterEnabled !== 'boolean'
    || typeof input.outlierEnabled !== 'boolean'
    || typeof input.outlierHintsEnabled !== 'boolean'
  ) {
    errors.push('Role settings must be on or off.')
  }
  const reservedRoles = input.impostorCount
    + (input.jesterEnabled === true ? 1 : 0)
    + (input.outlierEnabled === true ? 1 : 0)
  if (reservedRoles >= input.playerNames.length) {
    errors.push('Leave at least one player as an Innocent.')
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
  const hintPool = selectedItem.hints?.length ? selectedItem.hints : [selectedItem.hint]
  const hintIndex = Math.min(hintPool.length - 1, Math.floor(random() * hintPool.length))
  const roleIndexes = shuffledIndexes(input.playerNames.length, random)
  const impostorIndexes = new Set(roleIndexes.slice(0, input.impostorCount))
  const jesterIndex = input.jesterEnabled ? roleIndexes[input.impostorCount] : null
  const outlierIndex = input.outlierEnabled
    ? roleIndexes[input.impostorCount + (input.jesterEnabled ? 1 : 0)]
    : null

  return {
    phase: 'ROLE_REVEAL',
    round: input.round ?? 1,
    players: input.playerNames.map((name, index) => ({
      id: `player-${index + 1}`,
      name: name.trim(),
      role: impostorIndexes.has(index)
        ? 'IMPOSTOR'
        : index === jesterIndex
          ? 'JESTER'
          : index === outlierIndex
            ? 'OUTLIER'
            : 'INNOCENT',
      hasViewedRole: false,
    })),
    impostorCount: input.impostorCount,
    selectedPackId: input.pack.id,
    selectedPackName: input.pack.packName,
    currentWord: selectedItem.word,
    currentHint: hintPool[hintIndex],
    hintsEnabled: input.hintsEnabled,
    jesterEnabled: input.jesterEnabled,
    outlierEnabled: input.outlierEnabled,
    outlierHintsEnabled: input.outlierEnabled && input.outlierHintsEnabled,
    absoluteVotingEnabled: input.absoluteVotingEnabled,
    discussionDurationSeconds: input.discussionDurationSeconds,
    currentRevealIndex: 0,
    isRoleVisible: false,
    currentVoterIndex: 0,
    votes: [],
    groupVote: null,
    voteResult: null,
    currentOutlierGuessIndex: 0,
    outlierGuesses: [],
    statsRecorded: false,
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

function targetsFromVote(vote: VoteRecord): string[] {
  if (Array.isArray(vote.targetIds)) return vote.targetIds
  return vote.targetId ? [vote.targetId] : []
}

export function calculateVoteResult(players: Player[], votes: VoteRecord[], impostorCount = 1): VoteResult {
  const counts = Object.fromEntries(players.map((player) => [player.id, 0]))
  for (const vote of votes) {
    for (const targetId of targetsFromVote(vote)) {
      if (targetId in counts) counts[targetId] += 1
    }
  }

  const highestCount = Math.max(0, ...Object.values(counts))
  const topCandidateIds = highestCount === 0
    ? []
    : players.filter((player) => counts[player.id] === highestCount).map((player) => player.id)
  const isTie = topCandidateIds.length > 1
  const rankedCandidates = players
    .filter((player) => counts[player.id] > 0)
    .sort((left, right) => counts[right.id] - counts[left.id])
  const cutoffCount = rankedCandidates[Math.min(impostorCount, rankedCandidates.length) - 1]
    ? counts[rankedCandidates[Math.min(impostorCount, rankedCandidates.length) - 1].id]
    : 0
  const eliminatedPlayerIds = cutoffCount === 0
    ? []
    : rankedCandidates.filter((player) => counts[player.id] >= cutoffCount).map((player) => player.id)

  return {
    counts,
    topCandidateIds,
    eliminatedPlayerIds,
    eliminatedPlayerId: eliminatedPlayerIds.length === 1 ? eliminatedPlayerIds[0] : null,
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

export function recordVote(state: GameState, targetIds: string | string[] | null): GameState {
  if (state.phase !== 'VOTING') {
    return state
  }

  const normalizedTargetIds = targetIds === null ? [] : Array.isArray(targetIds) ? targetIds : [targetIds]
  if (normalizedTargetIds.length > state.impostorCount) {
    throw new Error(`Choose up to ${state.impostorCount} player${state.impostorCount === 1 ? '' : 's'}.`)
  }
  if (new Set(normalizedTargetIds).size !== normalizedTargetIds.length) {
    throw new Error('Choose each player only once.')
  }
  if (normalizedTargetIds.some((targetId) => !state.players.some((player) => player.id === targetId))) {
    throw new Error('Choose a player in this round.')
  }

  if (state.absoluteVotingEnabled) {
    const voteResult = normalizedTargetIds.length === 0
      ? calculateVoteResult(state.players, [], state.impostorCount)
      : {
          counts: Object.fromEntries(state.players.map((player) => [player.id, normalizedTargetIds.includes(player.id) ? 1 : 0])),
          topCandidateIds: normalizedTargetIds,
          eliminatedPlayerIds: normalizedTargetIds,
          eliminatedPlayerId: normalizedTargetIds.length === 1 ? normalizedTargetIds[0] : null,
          isTie: false,
        }
    const hasOutlier = state.players.some((player) => player.role === 'OUTLIER')
    return {
      ...state,
      phase: hasOutlier ? 'OUTLIER_GUESS' : 'GAME_OVER',
      groupVote: normalizedTargetIds,
      voteResult,
    }
  }

  const voter = state.players[state.currentVoterIndex]
  if (normalizedTargetIds.includes(voter.id)) {
    throw new Error('You cannot vote for yourself.')
  }

  const ballot = normalizedTargetIds.length <= 1
    ? { voterId: voter.id, targetId: normalizedTargetIds[0] ?? null }
    : { voterId: voter.id, targetIds: normalizedTargetIds }
  const votes = [...state.votes, ballot]
  const isLastVoter = state.currentVoterIndex === state.players.length - 1

  const hasOutlier = state.players.some((player) => player.role === 'OUTLIER')

  return {
    ...state,
    phase: isLastVoter ? (hasOutlier ? 'OUTLIER_GUESS' : 'GAME_OVER') : 'VOTING',
    currentVoterIndex: isLastVoter ? state.currentVoterIndex : state.currentVoterIndex + 1,
    votes,
    voteResult: isLastVoter ? calculateVoteResult(state.players, votes, state.impostorCount) : null,
  }
}

export function recordOutlierGuess(state: GameState, guess: string): GameState {
  if (state.phase !== 'OUTLIER_GUESS') {
    return state
  }

  const trimmedGuess = guess.trim()
  if (!trimmedGuess) {
    throw new Error('Enter a guess for the secret word.')
  }

  const outliers = state.players.filter((player) => player.role === 'OUTLIER')
  const outlier = outliers[state.currentOutlierGuessIndex]
  if (!outlier) {
    throw new Error('No Outlier is waiting to guess.')
  }

  const outlierGuesses = [...state.outlierGuesses, {
    playerId: outlier.id,
    guess: trimmedGuess,
    isCorrect: trimmedGuess.toLowerCase() === state.currentWord.trim().toLowerCase(),
  }]
  const isLastOutlier = state.currentOutlierGuessIndex === outliers.length - 1

  return {
    ...state,
    phase: isLastOutlier ? 'GAME_OVER' : 'OUTLIER_GUESS',
    currentOutlierGuessIndex: isLastOutlier
      ? state.currentOutlierGuessIndex
      : state.currentOutlierGuessIndex + 1,
    outlierGuesses,
  }
}

export function calculateSpecialRoleOutcomes(state: GameState): SpecialRoleOutcome[] {
  return state.players.flatMap((player): SpecialRoleOutcome[] => {
    if (player.role === 'JESTER') {
      const eliminatedPlayerIds = state.voteResult?.eliminatedPlayerIds
        ?? (state.voteResult?.eliminatedPlayerId ? [state.voteResult.eliminatedPlayerId] : [])
      const won = eliminatedPlayerIds.includes(player.id)
      return [{
        playerId: player.id,
        role: 'JESTER',
        won,
        reason: won ? 'Voted out' : 'Not voted out',
      }]
    }
    if (player.role === 'OUTLIER') {
      const won = state.outlierGuesses.find((guess) => guess.playerId === player.id)?.isCorrect === true
      return [{
        playerId: player.id,
        role: 'OUTLIER',
        won,
        reason: won ? 'Guessed the word' : 'Incorrect guess',
      }]
    }
    return []
  })
}
