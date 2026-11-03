import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { advanceRoleReveal, createRound, recordOutlierGuess, recordVote, startVoting, validateSetup } from '../domain/game'
import { calculateRoundStats, emptyPlayerStats } from '../domain/sessionStats'
import type { GameSetupInput, GameState, PlayerStats, SessionRecord } from '../domain/types'

const recoverableLegacyPhases: GameState['phase'][] = [
  'ROLE_REVEAL',
  'DISCUSSION',
  'VOTING',
  'GAME_OVER',
]
const recoverableLegacyRoles = ['INNOCENT', 'IMPOSTOR']

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isValidVoteResult(value: unknown, playerIds: Set<string>): boolean {
  if (!isRecord(value) || !isRecord(value.counts) || !Array.isArray(value.topCandidateIds)) return false
  const eliminatedPlayerId = value.eliminatedPlayerId
  const eliminatedPlayerIds = value.eliminatedPlayerIds
  return Object.entries(value.counts).every(([id, count]) => playerIds.has(id) && Number.isInteger(count) && Number(count) >= 0)
    && value.topCandidateIds.every((id) => typeof id === 'string' && playerIds.has(id))
    && (eliminatedPlayerId === undefined || eliminatedPlayerId === null || (typeof eliminatedPlayerId === 'string' && playerIds.has(eliminatedPlayerId)))
    && (eliminatedPlayerIds === undefined || (Array.isArray(eliminatedPlayerIds)
      && new Set(eliminatedPlayerIds).size === eliminatedPlayerIds.length
      && eliminatedPlayerIds.every((id) => typeof id === 'string' && playerIds.has(id))))
    && typeof value.isTie === 'boolean'
}

function normalizePersistedSetup(value: unknown): GameSetupInput | null {
  if (!isRecord(value)
    || !Array.isArray(value.playerNames)
    || value.playerNames.some((name) => typeof name !== 'string')
    || typeof value.impostorCount !== 'number'
    || !isRecord(value.pack)
    || !Array.isArray(value.pack.items)
    || typeof value.hintsEnabled !== 'boolean'
    || !(value.discussionDurationSeconds === null || typeof value.discussionDurationSeconds === 'number')
  ) return null

  const normalized = {
    ...value,
    jesterEnabled: typeof value.jesterEnabled === 'boolean' ? value.jesterEnabled : false,
    outlierEnabled: typeof value.outlierEnabled === 'boolean' ? value.outlierEnabled : false,
    outlierHintsEnabled: typeof value.outlierHintsEnabled === 'boolean' ? value.outlierHintsEnabled : false,
    absoluteVotingEnabled: typeof value.absoluteVotingEnabled === 'boolean' ? value.absoluteVotingEnabled : false,
  } as unknown as GameSetupInput
  return validateSetup(normalized).length === 0 ? normalized : null
}

const playerRoles = ['INNOCENT', 'IMPOSTOR', 'JESTER', 'OUTLIER'] as const
const gamePhases: GameState['phase'][] = ['ROLE_REVEAL', 'DISCUSSION', 'VOTING', 'OUTLIER_GUESS', 'GAME_OVER']

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isRoleCounter(value: unknown): boolean {
  return isRecord(value) && playerRoles.every((role) => isNonNegativeInteger(value[role]))
}

function isPlayerStats(value: unknown): value is PlayerStats {
  return isRecord(value)
    && isNonNegativeInteger(value.roundsPlayed)
    && isRoleCounter(value.rolesPlayed)
    && isNonNegativeInteger(value.correctImpostorGuesses)
    && isNonNegativeInteger(value.wrongImpostorGuesses)
    && isNonNegativeInteger(value.votesForJester)
    && isNonNegativeInteger(value.votedOutAsJester)
    && isNonNegativeInteger(value.correctOutlierGuesses)
    && isRecord(value.wins)
    && isNonNegativeInteger(value.wins.total)
    && isRoleCounter(value.wins.byRole)
    && isRecord(value.losses)
    && isNonNegativeInteger(value.losses.total)
    && isRoleCounter(value.losses.byRole)
}

function isCurrentGameState(value: unknown, setup: GameSetupInput, sessionPlayers: SessionRecord['players'], completedRounds: number): value is GameState {
  if (!isRecord(value)
    || typeof value.phase !== 'string'
    || !gamePhases.includes(value.phase as GameState['phase'])
    || !Array.isArray(value.players)
    || value.players.length !== sessionPlayers.length
    || !isNonNegativeInteger(value.round)
    || !isNonNegativeInteger(value.impostorCount)
    || value.impostorCount !== setup.impostorCount
    || typeof value.selectedPackId !== 'string'
    || value.selectedPackId !== setup.pack.id
    || typeof value.selectedPackName !== 'string'
    || typeof value.currentWord !== 'string'
    || typeof value.currentHint !== 'string'
    || typeof value.hintsEnabled !== 'boolean'
    || typeof value.jesterEnabled !== 'boolean'
    || typeof value.outlierEnabled !== 'boolean'
    || typeof value.outlierHintsEnabled !== 'boolean'
    || typeof value.absoluteVotingEnabled !== 'boolean'
    || value.hintsEnabled !== setup.hintsEnabled
    || value.jesterEnabled !== setup.jesterEnabled
    || value.outlierEnabled !== setup.outlierEnabled
    || value.outlierHintsEnabled !== setup.outlierHintsEnabled
    || value.absoluteVotingEnabled !== setup.absoluteVotingEnabled
    || !(value.discussionDurationSeconds === null || isNonNegativeInteger(value.discussionDurationSeconds))
    || value.discussionDurationSeconds !== setup.discussionDurationSeconds
    || !isNonNegativeInteger(value.currentRevealIndex)
    || value.currentRevealIndex >= value.players.length
    || typeof value.isRoleVisible !== 'boolean'
    || !isNonNegativeInteger(value.currentVoterIndex)
    || value.currentVoterIndex >= value.players.length
    || !Array.isArray(value.votes)
    || !(value.groupVote === null || Array.isArray(value.groupVote))
    || !isNonNegativeInteger(value.currentOutlierGuessIndex)
    || !Array.isArray(value.outlierGuesses)
    || typeof value.statsRecorded !== 'boolean'
  ) return false

  const playersAreValid = value.players.every((player, index) => isRecord(player)
    && player.id === sessionPlayers[index].id
    && player.name === sessionPlayers[index].name
    && typeof player.role === 'string'
    && playerRoles.includes(player.role as GameState['players'][number]['role'])
    && typeof player.hasViewedRole === 'boolean')
  if (!playersAreValid || setup.playerNames.some((name, index) => name.trim() !== sessionPlayers[index].name)) return false

  const players = value.players as unknown as GameState['players']
  const playerIds = new Set(sessionPlayers.map((player) => player.id))
  if (players.filter((player) => player.role === 'IMPOSTOR').length !== setup.impostorCount
    || players.filter((player) => player.role === 'JESTER').length !== (setup.jesterEnabled ? 1 : 0)
    || players.filter((player) => player.role === 'OUTLIER').length !== (setup.outlierEnabled ? 1 : 0)) return false

  const votesAreValid = value.votes.every((vote, index) => isRecord(vote)
    && vote.voterId === sessionPlayers[index]?.id
    && ((Array.isArray(vote.targetIds)
      && vote.targetIds.length <= setup.impostorCount
      && new Set(vote.targetIds).size === vote.targetIds.length
      && vote.targetIds.every((id) => typeof id === 'string' && playerIds.has(id) && id !== vote.voterId))
      || (vote.targetId === null || (typeof vote.targetId === 'string' && playerIds.has(vote.targetId) && vote.targetId !== vote.voterId))))
  const groupVoteIsValid = value.groupVote === null || (value.groupVote.length <= setup.impostorCount
    && new Set(value.groupVote).size === value.groupVote.length
    && value.groupVote.every((id) => typeof id === 'string' && playerIds.has(id)))
  const outlierIds = players.filter((player) => player.role === 'OUTLIER').map((player) => player.id)
  const guessesAreValid = value.outlierGuesses.every((guess, index) => isRecord(guess)
    && guess.playerId === outlierIds[index]
    && typeof guess.guess === 'string'
    && Boolean(guess.guess.trim())
    && typeof guess.isCorrect === 'boolean')
  if (!votesAreValid || !groupVoteIsValid || !guessesAreValid || value.outlierGuesses.length > outlierIds.length) return false

  const hasFinishedVoting = value.absoluteVotingEnabled
    ? value.votes.length === 0 && value.groupVote !== null
    : value.groupVote === null && value.votes.length === players.length
  if (value.phase === 'ROLE_REVEAL' || value.phase === 'DISCUSSION') {
    if (value.voteResult !== null || value.votes.length !== 0 || value.groupVote !== null || value.outlierGuesses.length !== 0) return false
  } else if (value.phase === 'VOTING') {
    if (value.voteResult !== null || value.outlierGuesses.length !== 0) return false
    if (value.absoluteVotingEnabled ? value.votes.length !== 0 || value.groupVote !== null : value.groupVote !== null || value.votes.length !== value.currentVoterIndex) return false
  } else {
    if (!hasFinishedVoting || !isValidVoteResult(value.voteResult, playerIds)) return false
    if (value.phase === 'OUTLIER_GUESS' && value.outlierGuesses.length !== value.currentOutlierGuessIndex) return false
    if (value.phase === 'GAME_OVER' && value.outlierGuesses.length !== outlierIds.length) return false
  }

  return value.phase === 'GAME_OVER'
    ? value.statsRecorded && value.round === completedRounds
    : !value.statsRecorded && value.round === completedRounds + 1
}

function normalizeSessionRecord(id: string, value: unknown): SessionRecord | null {
  if (!isRecord(value)
    || value.id !== id
    || typeof value.name !== 'string'
    || !value.name.trim()
    || typeof value.createdAt !== 'string'
    || typeof value.updatedAt !== 'string'
    || !isNonNegativeInteger(value.completedRounds)
    || !Array.isArray(value.players)
    || value.players.length < 3
    || !isRecord(value.statsByPlayerId)
  ) return null
  const setup = normalizePersistedSetup(value.setup)
  if (!setup) return null
  const statsByPlayerId = value.statsByPlayerId
  if (!isRecord(statsByPlayerId)) return null
  const players = value.players
  if (!players.every((player) => isRecord(player) && typeof player.id === 'string' && typeof player.name === 'string')) return null
  const playerIds = players.map((player) => (player as { id: string }).id)
  if (new Set(playerIds).size !== playerIds.length
    || Object.keys(statsByPlayerId).length !== playerIds.length
    || playerIds.some((playerId) => !isPlayerStats(statsByPlayerId[playerId]) || statsByPlayerId[playerId].roundsPlayed !== value.completedRounds)
  ) return null
  if (!(value.currentGame === null || isCurrentGameState(value.currentGame, setup, players as SessionRecord['players'], value.completedRounds))) return null
  return {
    ...(value as unknown as SessionRecord),
    setup,
    name: value.name.trim(),
    currentGame: value.currentGame ? { ...(value.currentGame as unknown as GameState), isRoleVisible: false } : null,
  }
}

function isRecoverableGame(value: unknown): value is GameState {
  if (!isRecord(value)
    || typeof value.phase !== 'string'
    || !recoverableLegacyPhases.includes(value.phase as GameState['phase'])
    || !Array.isArray(value.players)
    || value.players.length < 3
  ) return false

  const playersAreValid = value.players.every((player) => isRecord(player)
    && typeof player.id === 'string'
    && typeof player.name === 'string'
    && typeof player.role === 'string'
    && recoverableLegacyRoles.includes(player.role)
    && typeof player.hasViewedRole === 'boolean')
  if (!playersAreValid) return false

  const playerIds = new Set(value.players.map((player) => (player as Record<string, unknown>).id as string))
  if (playerIds.size !== value.players.length
    || !Number.isInteger(value.round) || Number(value.round) < 1
    || !Number.isInteger(value.impostorCount) || Number(value.impostorCount) < 1 || Number(value.impostorCount) >= value.players.length
    || typeof value.selectedPackId !== 'string'
    || typeof value.selectedPackName !== 'string'
    || typeof value.currentWord !== 'string'
    || typeof value.currentHint !== 'string'
    || typeof value.hintsEnabled !== 'boolean'
    || !(value.discussionDurationSeconds === null || (Number.isInteger(value.discussionDurationSeconds) && Number(value.discussionDurationSeconds) >= 0))
    || !Number.isInteger(value.currentRevealIndex) || Number(value.currentRevealIndex) < 0 || Number(value.currentRevealIndex) >= value.players.length
    || typeof value.isRoleVisible !== 'boolean'
    || !Number.isInteger(value.currentVoterIndex) || Number(value.currentVoterIndex) < 0 || Number(value.currentVoterIndex) >= value.players.length
    || !Array.isArray(value.votes)
  ) return false

  const votesAreValid = value.votes.every((vote) => isRecord(vote)
    && typeof vote.voterId === 'string'
    && playerIds.has(vote.voterId)
    && ((Array.isArray(vote.targetIds)
      && vote.targetIds.length <= Number(value.impostorCount)
      && new Set(vote.targetIds).size === vote.targetIds.length
      && vote.targetIds.every((id) => typeof id === 'string' && playerIds.has(id) && id !== vote.voterId))
      || (vote.targetId === null || (typeof vote.targetId === 'string' && playerIds.has(vote.targetId)))
        && vote.targetId !== vote.voterId))
  if (!votesAreValid || value.votes.length > value.players.length) return false

  if (value.phase === 'ROLE_REVEAL' || value.phase === 'DISCUSSION') {
    return value.voteResult === null && value.votes.length === 0
  }
  if (value.phase === 'VOTING') {
    return value.voteResult === null && value.votes.length === value.currentVoterIndex
  }
  return value.votes.length === value.players.length && isValidVoteResult(value.voteResult, playerIds)
}

export type LobbyIntent = 'default' | 'category'

export interface GameStoreState {
  setup: GameSetupInput | null
  game: GameState | null
  sessionsById: Record<string, SessionRecord>
  activeSessionId: string | null
  pendingSessionName: string | null
  pendingVote: string[] | null | undefined
  isVoteReady: boolean
  pendingOutlierGuess: string
  isOutlierGuessReady: boolean
  discussionRemainingSeconds: number | null
  discussionDeadlineMs: number | null
  isDiscussionTimerRunning: boolean
  lobbyIntent: LobbyIntent
  createSession: (name: string) => void
  continueSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  abortGame: () => void
  startGame: (setup: GameSetupInput) => void
  showRole: () => void
  hideRole: () => void
  confirmRole: () => void
  beginVoting: () => void
  enableAbsoluteVoting: () => void
  showVote: () => void
  castVote: (targetId: string | null) => void
  confirmVote: () => void
  showOutlierGuess: () => void
  hideOutlierGuess: () => void
  setOutlierGuess: (guess: string) => void
  confirmOutlierGuess: () => void
  pauseDiscussionTimer: () => void
  resumeDiscussionTimer: () => void
  syncDiscussionTimer: () => void
  playAgain: (options?: { absoluteVotingEnabled?: boolean }) => void
  changeCategory: () => void
  returnToLobby: () => void
}

function addPlayerStats(current: PlayerStats, delta: PlayerStats): PlayerStats {
  const roles = ['INNOCENT', 'IMPOSTOR', 'JESTER', 'OUTLIER'] as const
  return {
    roundsPlayed: current.roundsPlayed + delta.roundsPlayed,
    rolesPlayed: Object.fromEntries(roles.map((role) => [role, current.rolesPlayed[role] + delta.rolesPlayed[role]])) as PlayerStats['rolesPlayed'],
    correctImpostorGuesses: current.correctImpostorGuesses + delta.correctImpostorGuesses,
    wrongImpostorGuesses: current.wrongImpostorGuesses + delta.wrongImpostorGuesses,
    votesForJester: current.votesForJester + delta.votesForJester,
    votedOutAsJester: current.votedOutAsJester + delta.votedOutAsJester,
    correctOutlierGuesses: current.correctOutlierGuesses + delta.correctOutlierGuesses,
    wins: {
      total: current.wins.total + delta.wins.total,
      byRole: Object.fromEntries(roles.map((role) => [role, current.wins.byRole[role] + delta.wins.byRole[role]])) as PlayerStats['wins']['byRole'],
    },
    losses: {
      total: current.losses.total + delta.losses.total,
      byRole: Object.fromEntries(roles.map((role) => [role, current.losses.byRole[role] + delta.losses.byRole[role]])) as PlayerStats['losses']['byRole'],
    },
  }
}

function syncActiveSession(
  state: GameStoreState,
  game: GameState,
  setup: GameSetupInput | null = state.setup,
): Pick<GameStoreState, 'sessionsById'> | Record<string, never> {
  if (!state.activeSessionId || !setup) return {}
  const session = state.sessionsById[state.activeSessionId]
  if (!session) return {}
  return {
    sessionsById: {
      ...state.sessionsById,
      [session.id]: { ...session, setup, currentGame: game },
    },
  }
}

function finishRound(state: GameStoreState, game: GameState, now: number) {
  if (game.phase !== 'GAME_OVER' || game.statsRecorded || !state.activeSessionId) {
    return { game, ...syncActiveSession(state, game) }
  }
  const session = state.sessionsById[state.activeSessionId]
  if (!session) return { game }
  const delta = calculateRoundStats(game)
  const statsByPlayerId = Object.fromEntries(session.players.map((player) => [
    player.id,
    addPlayerStats(session.statsByPlayerId[player.id] ?? emptyPlayerStats(), delta[player.id]),
  ]))
  const completedGame = { ...game, statsRecorded: true }
  return {
    game: completedGame,
    sessionsById: {
      ...state.sessionsById,
      [session.id]: {
        ...session,
        completedRounds: session.completedRounds + 1,
        updatedAt: new Date(now).toISOString(),
        statsByPlayerId,
        currentGame: completedGame,
      },
    },
  }
}

export function createGameStore(
  storageName = 'moldyparty-game',
  random: () => number = Math.random,
  storage: StateStorage = localStorage,
  clock: () => number = Date.now,
  idFactory: () => string = () => crypto.randomUUID(),
) {
  function migrateWithSession(
    saved: Partial<GameStoreState>,
    setup: GameSetupInput | null,
    game: GameState | null,
  ): Partial<GameStoreState> {
    if (!setup || !game) {
      return { ...saved, setup, game, sessionsById: {}, activeSessionId: null, pendingSessionName: null }
    }
    const sessionId = idFactory()
    const timestamp = new Date(clock()).toISOString()
    const recoveredGame = game.phase === 'GAME_OVER' ? { ...game, statsRecorded: true } : game
    const session: SessionRecord = {
      id: sessionId,
      name: 'Recovered Session',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedRounds: 0,
      players: game.players.map(({ id, name }) => ({ id, name })),
      setup,
      statsByPlayerId: Object.fromEntries(game.players.map((player) => [player.id, emptyPlayerStats()])),
      currentGame: recoveredGame,
    }
    return {
      ...saved,
      setup,
      game: recoveredGame,
      sessionsById: { [sessionId]: session },
      activeSessionId: sessionId,
      pendingSessionName: null,
    }
  }

  return createStore<GameStoreState>()(persist((set) => ({
    setup: null,
    game: null,
    sessionsById: {},
    activeSessionId: null,
    pendingSessionName: null,
    pendingVote: undefined,
    isVoteReady: false,
    pendingOutlierGuess: '',
    isOutlierGuessReady: false,
    discussionRemainingSeconds: null,
    discussionDeadlineMs: null,
    isDiscussionTimerRunning: false,
    lobbyIntent: 'default',

    createSession: (name) => set({
      pendingSessionName: name.trim() || 'New Session',
      activeSessionId: null,
      setup: null,
      game: null,
      lobbyIntent: 'default',
    }),

    continueSession: (sessionId) => set((state) => {
      const session = state.sessionsById[sessionId]
      if (!session) return state
      return {
        activeSessionId: sessionId,
        pendingSessionName: null,
        setup: session.setup,
        game: session.currentGame,
        lobbyIntent: 'default',
      }
    }),

    deleteSession: (sessionId) => set((state) => {
      if (!state.sessionsById[sessionId]) return state
      const sessionsById = { ...state.sessionsById }
      delete sessionsById[sessionId]
      const deletingActive = state.activeSessionId === sessionId
      return {
        sessionsById,
        activeSessionId: deletingActive ? null : state.activeSessionId,
        setup: deletingActive ? null : state.setup,
        game: deletingActive ? null : state.game,
      }
    }),

    abortGame: () => set((state) => {
      if (!state.activeSessionId || !state.sessionsById[state.activeSessionId]) return state
      const sessionsById = {
        ...state.sessionsById,
        [state.activeSessionId]: { ...state.sessionsById[state.activeSessionId], currentGame: null },
      }
      return {
        sessionsById,
        activeSessionId: null,
        setup: null,
        game: null,
        pendingVote: undefined,
        isVoteReady: false,
        pendingOutlierGuess: '',
        isOutlierGuessReady: false,
        discussionRemainingSeconds: null,
        discussionDeadlineMs: null,
        isDiscussionTimerRunning: false,
      }
    }),

    startGame: (setup) => set((state) => {
      const existing = state.activeSessionId ? state.sessionsById[state.activeSessionId] : null
      const sessionId = existing?.id ?? idFactory()
      const effectiveSetup = existing
        ? { ...setup, playerNames: existing.players.map((player) => player.name) }
        : setup
      const game = createRound({ ...effectiveSetup, round: existing ? existing.completedRounds + 1 : 1 }, random)
      const timestamp = new Date(clock()).toISOString()
      const session: SessionRecord = existing ? {
        ...existing,
        setup: effectiveSetup,
        players: game.players.map(({ id, name }) => ({ id, name })),
        currentGame: game,
        updatedAt: timestamp,
      } : {
        id: sessionId,
        name: state.pendingSessionName ?? `Session ${Object.keys(state.sessionsById).length + 1}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedRounds: 0,
        players: game.players.map(({ id, name }) => ({ id, name })),
        setup: effectiveSetup,
        statsByPlayerId: Object.fromEntries(game.players.map((player) => [player.id, emptyPlayerStats()])),
        currentGame: game,
      }
      return {
        setup: effectiveSetup,
        game,
        sessionsById: { ...state.sessionsById, [sessionId]: session },
        activeSessionId: sessionId,
        pendingSessionName: null,
        pendingVote: undefined,
        isVoteReady: false,
        pendingOutlierGuess: '',
        isOutlierGuessReady: false,
        discussionRemainingSeconds: null,
        discussionDeadlineMs: null,
        isDiscussionTimerRunning: false,
        lobbyIntent: 'default',
      }
    }),

    showRole: () => set((state) => state.game?.phase === 'ROLE_REVEAL'
      ? { game: { ...state.game, isRoleVisible: true } }
      : state,
    ),

    hideRole: () => set((state) => state.game?.phase === 'ROLE_REVEAL'
      ? { game: { ...state.game, isRoleVisible: false } }
      : state,
    ),

    confirmRole: () => set((state) => {
      if (!state.game) return state
      const game = advanceRoleReveal(state.game)
      const enteredDiscussion = state.game.phase === 'ROLE_REVEAL' && game.phase === 'DISCUSSION'
      const duration = game.discussionDurationSeconds
      return enteredDiscussion ? {
        game,
        ...syncActiveSession(state, game),
        discussionRemainingSeconds: duration,
        discussionDeadlineMs: duration === null ? null : clock() + duration * 1000,
        isDiscussionTimerRunning: duration !== null,
      } : { game, ...syncActiveSession(state, game) }
    }),

    beginVoting: () => set((state) => {
      if (!state.game) return state
      const game = startVoting(state.game)
      return {
          game,
          ...syncActiveSession(state, game),
          pendingVote: undefined,
          isVoteReady: state.game.absoluteVotingEnabled,
        }
    }),

    enableAbsoluteVoting: () => set((state) => {
      if (state.game?.phase !== 'VOTING') return state
      const setup = state.setup ? { ...state.setup, absoluteVotingEnabled: true } : state.setup
      const game = { ...state.game, absoluteVotingEnabled: true, votes: [], currentVoterIndex: 0, voteResult: null }
      return {
          setup,
          game,
          ...syncActiveSession(state, game, setup),
          pendingVote: undefined,
          isVoteReady: true,
        }
    }),

    showVote: () => set((state) => state.game?.phase === 'VOTING'
      ? { isVoteReady: true, pendingVote: undefined }
      : state,
    ),

    castVote: (targetId) => set((state) => {
      if (state.game?.phase !== 'VOTING' || !state.isVoteReady) return state
      if (targetId === null) return { pendingVote: null }
      const selected = Array.isArray(state.pendingVote) ? state.pendingVote : []
      const next = selected.includes(targetId)
        ? selected.filter((id) => id !== targetId)
        : selected.length < state.game.impostorCount ? [...selected, targetId] : selected
      return { pendingVote: next }
    }),

    confirmVote: () => set((state) => {
      if (!state.game || state.game.phase !== 'VOTING' || state.pendingVote === undefined) {
        return state
      }
      const game = recordVote(state.game, state.pendingVote)
      return {
        ...finishRound(state, game, clock()),
        pendingVote: undefined,
        isVoteReady: game.absoluteVotingEnabled && game.phase === 'VOTING',
      }
    }),

    showOutlierGuess: () => set((state) => state.game?.phase === 'OUTLIER_GUESS'
      ? { isOutlierGuessReady: true, pendingOutlierGuess: '' }
      : state,
    ),

    hideOutlierGuess: () => set((state) => state.game?.phase === 'OUTLIER_GUESS'
      ? { isOutlierGuessReady: false, pendingOutlierGuess: '' }
      : state,
    ),

    setOutlierGuess: (guess) => set((state) =>
      state.game?.phase === 'OUTLIER_GUESS' && state.isOutlierGuessReady
        ? { pendingOutlierGuess: guess }
        : state,
    ),

    confirmOutlierGuess: () => set((state) => {
      if (
        !state.game
        || state.game.phase !== 'OUTLIER_GUESS'
        || !state.isOutlierGuessReady
        || !state.pendingOutlierGuess.trim()
      ) {
        return state
      }
      const game = recordOutlierGuess(state.game, state.pendingOutlierGuess)
      return {
        ...finishRound(state, game, clock()),
        pendingOutlierGuess: '',
        isOutlierGuessReady: false,
      }
    }),

    pauseDiscussionTimer: () => set((state) => {
      if (!state.isDiscussionTimerRunning || state.discussionDeadlineMs === null) return state
      return {
        discussionRemainingSeconds: Math.max(0, Math.ceil((state.discussionDeadlineMs - clock()) / 1000)),
        discussionDeadlineMs: null,
        isDiscussionTimerRunning: false,
      }
    }),

    resumeDiscussionTimer: () => set((state) => {
      if (state.isDiscussionTimerRunning || state.discussionRemainingSeconds === null) return state
      return {
        discussionDeadlineMs: clock() + state.discussionRemainingSeconds * 1000,
        isDiscussionTimerRunning: state.discussionRemainingSeconds > 0,
      }
    }),

    syncDiscussionTimer: () => set((state) => {
      if (!state.isDiscussionTimerRunning || state.discussionDeadlineMs === null) return state
      const remaining = Math.max(0, Math.ceil((state.discussionDeadlineMs - clock()) / 1000))
      return {
        discussionRemainingSeconds: remaining,
        discussionDeadlineMs: remaining === 0 ? null : state.discussionDeadlineMs,
        isDiscussionTimerRunning: remaining > 0,
      }
    }),

    playAgain: (options) => set((state) => {
      if (!state.setup) return state
      const replayPack = state.game && state.setup.pack.items.length > 1
        ? {
            ...state.setup.pack,
            items: state.setup.pack.items.filter((item) => item.word !== state.game?.currentWord),
          }
        : state.setup.pack
      const setup = {
        ...state.setup,
        absoluteVotingEnabled: options?.absoluteVotingEnabled ?? state.setup.absoluteVotingEnabled,
      }
      const game = createRound({
          ...state.setup,
          absoluteVotingEnabled: setup.absoluteVotingEnabled,
          pack: replayPack,
          round: (state.game?.round ?? 0) + 1,
        }, random)
      const synced = syncActiveSession(state, game, setup)
      return {
        game,
        setup,
        ...synced,
        pendingVote: undefined,
        isVoteReady: false,
        pendingOutlierGuess: '',
        isOutlierGuessReady: false,
        discussionRemainingSeconds: null,
        discussionDeadlineMs: null,
        isDiscussionTimerRunning: false,
      }
    }),

    changeCategory: () => set((state) => ({
      sessionsById: state.activeSessionId && state.sessionsById[state.activeSessionId] && state.game?.phase === 'GAME_OVER'
        ? {
            ...state.sessionsById,
            [state.activeSessionId]: { ...state.sessionsById[state.activeSessionId], currentGame: null },
          }
        : state.sessionsById,
      activeSessionId: null,
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      pendingOutlierGuess: '',
      isOutlierGuessReady: false,
      discussionRemainingSeconds: null,
      discussionDeadlineMs: null,
      isDiscussionTimerRunning: false,
      lobbyIntent: 'category',
    })),

    returnToLobby: () => set((state) => ({
      sessionsById: state.activeSessionId && state.sessionsById[state.activeSessionId] && state.game?.phase === 'GAME_OVER'
        ? {
            ...state.sessionsById,
            [state.activeSessionId]: { ...state.sessionsById[state.activeSessionId], currentGame: null },
          }
        : state.sessionsById,
      activeSessionId: null,
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      pendingOutlierGuess: '',
      isOutlierGuessReady: false,
      discussionRemainingSeconds: null,
      discussionDeadlineMs: null,
      isDiscussionTimerRunning: false,
      lobbyIntent: 'default',
    })),
  }), {
    name: storageName,
    version: 4,
    storage: createJSONStorage(() => storage),
    partialize: (state) => ({
      setup: state.setup,
      game: state.game ? { ...state.game, isRoleVisible: false } : null,
      sessionsById: Object.fromEntries(Object.entries(state.sessionsById).map(([id, session]) => [id, {
        ...session,
        currentGame: session.currentGame ? { ...session.currentGame, isRoleVisible: false } : null,
      }])),
      activeSessionId: state.activeSessionId,
      pendingSessionName: state.pendingSessionName,
      discussionRemainingSeconds: state.discussionRemainingSeconds,
      discussionDeadlineMs: state.discussionDeadlineMs,
      isDiscussionTimerRunning: state.isDiscussionTimerRunning,
      lobbyIntent: state.lobbyIntent,
    }),
    merge: (persisted, current) => {
      const saved = persisted as Partial<GameStoreState>
      const sessionsById = isRecord(saved.sessionsById)
        ? Object.fromEntries(Object.entries(saved.sessionsById).flatMap(([id, value]) => {
            const session = normalizeSessionRecord(id, value)
            return session ? [[id, session]] : []
          }))
        : {}
      const activeSessionId = typeof saved.activeSessionId === 'string' && sessionsById[saved.activeSessionId]
        ? saved.activeSessionId
        : null
      const activeSession = activeSessionId ? sessionsById[activeSessionId] : null
      return {
        ...current,
        ...saved,
        sessionsById,
        activeSessionId,
        pendingSessionName: typeof saved.pendingSessionName === 'string' ? saved.pendingSessionName : null,
        setup: activeSession?.setup ?? (saved.activeSessionId ? null : normalizePersistedSetup(saved.setup)),
        game: activeSession?.currentGame ?? null,
        pendingVote: undefined,
        isVoteReady: activeSession?.currentGame?.phase === 'VOTING' && activeSession.currentGame.absoluteVotingEnabled,
        pendingOutlierGuess: '',
        isOutlierGuessReady: false,
      }
    },
    migrate: (persisted, version) => {
      const saved = persisted as Partial<GameStoreState>
      if (version >= 4) return saved

      if (version >= 3) {
        const setup = normalizePersistedSetup(saved.setup)
        const game = isRecord(saved.game)
          ? { ...(saved.game as unknown as GameState), isRoleVisible: false }
          : null
        return migrateWithSession(saved, setup, game)
      }

      if (version >= 2) {
        const setup = normalizePersistedSetup(saved.setup)
        const game = isRecord(saved.game)
          ? { ...saved.game, absoluteVotingEnabled: saved.game.absoluteVotingEnabled === true, groupVote: null, isRoleVisible: false }
          : null
        return migrateWithSession(saved, setup, game as GameState | null)
      }

      const setup = normalizePersistedSetup(saved.setup)
      const game = isRecoverableGame(saved.game) ? {
        ...saved.game,
        jesterEnabled: saved.game.jesterEnabled ?? false,
        outlierEnabled: saved.game.outlierEnabled ?? false,
        outlierHintsEnabled: saved.game.outlierHintsEnabled ?? false,
        absoluteVotingEnabled: false,
        groupVote: null,
        currentOutlierGuessIndex: saved.game.currentOutlierGuessIndex ?? 0,
        outlierGuesses: saved.game.outlierGuesses ?? [],
        isRoleVisible: false,
      } : null

      return migrateWithSession(saved, setup, game)
    },
  }))
}

export const gameStore = createGameStore()

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector)
}
