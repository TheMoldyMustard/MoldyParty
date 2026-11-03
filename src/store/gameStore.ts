import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { advanceRoleReveal, createRound, recordOutlierGuess, recordVote, startVoting, validateSetup } from '../domain/game'
import type { GameSetupInput, GameState } from '../domain/types'

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
  pendingVote: string[] | null | undefined
  isVoteReady: boolean
  pendingOutlierGuess: string
  isOutlierGuessReady: boolean
  discussionRemainingSeconds: number | null
  discussionDeadlineMs: number | null
  isDiscussionTimerRunning: boolean
  lobbyIntent: LobbyIntent
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

export function createGameStore(
  storageName = 'moldyparty-game',
  random: () => number = Math.random,
  storage: StateStorage = localStorage,
  clock: () => number = Date.now,
) {
  return createStore<GameStoreState>()(persist((set) => ({
    setup: null,
    game: null,
    pendingVote: undefined,
    isVoteReady: false,
    pendingOutlierGuess: '',
    isOutlierGuessReady: false,
    discussionRemainingSeconds: null,
    discussionDeadlineMs: null,
    isDiscussionTimerRunning: false,
    lobbyIntent: 'default',

    startGame: (setup) => set({
      setup,
      game: createRound(setup, random),
      pendingVote: undefined,
      isVoteReady: false,
      pendingOutlierGuess: '',
      isOutlierGuessReady: false,
      discussionRemainingSeconds: null,
      discussionDeadlineMs: null,
      isDiscussionTimerRunning: false,
      lobbyIntent: 'default',
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
        discussionRemainingSeconds: duration,
        discussionDeadlineMs: duration === null ? null : clock() + duration * 1000,
        isDiscussionTimerRunning: duration !== null,
      } : { game }
    }),

    beginVoting: () => set((state) => state.game
      ? {
          game: startVoting(state.game),
          pendingVote: undefined,
          isVoteReady: state.game.absoluteVotingEnabled,
        }
      : state,
    ),

    enableAbsoluteVoting: () => set((state) => state.game?.phase === 'VOTING'
      ? {
          setup: state.setup ? { ...state.setup, absoluteVotingEnabled: true } : state.setup,
          game: { ...state.game, absoluteVotingEnabled: true, votes: [], currentVoterIndex: 0, voteResult: null },
          pendingVote: undefined,
          isVoteReady: true,
        }
      : state,
    ),

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
        game,
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
      return {
        game: recordOutlierGuess(state.game, state.pendingOutlierGuess),
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
      return {
        game: createRound({
          ...state.setup,
          absoluteVotingEnabled: options?.absoluteVotingEnabled ?? state.setup.absoluteVotingEnabled,
          pack: replayPack,
          round: (state.game?.round ?? 0) + 1,
        }, random),
        setup: {
          ...state.setup,
          absoluteVotingEnabled: options?.absoluteVotingEnabled ?? state.setup.absoluteVotingEnabled,
        },
        pendingVote: undefined,
        isVoteReady: false,
        pendingOutlierGuess: '',
        isOutlierGuessReady: false,
        discussionRemainingSeconds: null,
        discussionDeadlineMs: null,
        isDiscussionTimerRunning: false,
      }
    }),

    changeCategory: () => set({
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      pendingOutlierGuess: '',
      isOutlierGuessReady: false,
      discussionRemainingSeconds: null,
      discussionDeadlineMs: null,
      isDiscussionTimerRunning: false,
      lobbyIntent: 'category',
    }),

    returnToLobby: () => set({
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      pendingOutlierGuess: '',
      isOutlierGuessReady: false,
      discussionRemainingSeconds: null,
      discussionDeadlineMs: null,
      isDiscussionTimerRunning: false,
      lobbyIntent: 'default',
    }),
  }), {
    name: storageName,
    version: 3,
    storage: createJSONStorage(() => storage),
    partialize: (state) => ({
      setup: state.setup,
      game: state.game ? { ...state.game, isRoleVisible: false } : null,
      discussionRemainingSeconds: state.discussionRemainingSeconds,
      discussionDeadlineMs: state.discussionDeadlineMs,
      isDiscussionTimerRunning: state.isDiscussionTimerRunning,
      lobbyIntent: state.lobbyIntent,
    }),
    merge: (persisted, current) => {
      const saved = persisted as Partial<GameStoreState>
      return {
        ...current,
        ...saved,
        setup: normalizePersistedSetup(saved.setup),
        game: saved.game ? {
          ...saved.game,
          isRoleVisible: false,
          absoluteVotingEnabled: saved.game.absoluteVotingEnabled === true,
          groupVote: Array.isArray(saved.game.groupVote) ? saved.game.groupVote : null,
        } : null,
        pendingVote: undefined,
        isVoteReady: saved.game?.phase === 'VOTING' && saved.game.absoluteVotingEnabled === true,
        pendingOutlierGuess: '',
        isOutlierGuessReady: false,
      }
    },
    migrate: (persisted, version) => {
      const saved = persisted as Partial<GameStoreState>
      if (version >= 3) return saved

      if (version >= 2) {
        const setup = normalizePersistedSetup(saved.setup)
        const game = isRecord(saved.game)
          ? { ...saved.game, absoluteVotingEnabled: saved.game.absoluteVotingEnabled === true, groupVote: null, isRoleVisible: false }
          : null
        return { ...saved, setup, game }
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

      return { ...saved, setup, game }
    },
  }))
}

export const gameStore = createGameStore()

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector)
}
