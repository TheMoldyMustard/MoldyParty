import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { advanceRoleReveal, createRound, recordVote, startVoting } from '../domain/game'
import type { GameSetupInput, GameState } from '../domain/types'

export type LobbyIntent = 'default' | 'category'

export interface GameStoreState {
  setup: GameSetupInput | null
  game: GameState | null
  pendingVote: string | null | undefined
  isVoteReady: boolean
  discussionRemainingSeconds: number | null
  discussionDeadlineMs: number | null
  isDiscussionTimerRunning: boolean
  lobbyIntent: LobbyIntent
  startGame: (setup: GameSetupInput) => void
  showRole: () => void
  hideRole: () => void
  confirmRole: () => void
  beginVoting: () => void
  showVote: () => void
  castVote: (targetId: string | null) => void
  confirmVote: () => void
  pauseDiscussionTimer: () => void
  resumeDiscussionTimer: () => void
  syncDiscussionTimer: () => void
  playAgain: () => void
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
    discussionRemainingSeconds: null,
    discussionDeadlineMs: null,
    isDiscussionTimerRunning: false,
    lobbyIntent: 'default',

    startGame: (setup) => set({
      setup,
      game: createRound(setup, random),
      pendingVote: undefined,
      isVoteReady: false,
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
          isVoteReady: false,
        }
      : state,
    ),

    showVote: () => set((state) => state.game?.phase === 'VOTING'
      ? { isVoteReady: true, pendingVote: undefined }
      : state,
    ),

    castVote: (targetId) => set((state) =>
      state.game?.phase === 'VOTING' && state.isVoteReady
        ? { pendingVote: targetId }
        : state,
    ),

    confirmVote: () => set((state) => {
      if (!state.game || state.game.phase !== 'VOTING' || state.pendingVote === undefined) {
        return state
      }
      return {
        game: recordVote(state.game, state.pendingVote),
        pendingVote: undefined,
        isVoteReady: false,
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

    playAgain: () => set((state) => {
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
          pack: replayPack,
          round: (state.game?.round ?? 0) + 1,
        }, random),
        pendingVote: undefined,
        isVoteReady: false,
        discussionRemainingSeconds: null,
        discussionDeadlineMs: null,
        isDiscussionTimerRunning: false,
      }
    }),

    changeCategory: () => set({
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      discussionRemainingSeconds: null,
      discussionDeadlineMs: null,
      isDiscussionTimerRunning: false,
      lobbyIntent: 'category',
    }),

    returnToLobby: () => set({
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      discussionRemainingSeconds: null,
      discussionDeadlineMs: null,
      isDiscussionTimerRunning: false,
      lobbyIntent: 'default',
    }),
  }), {
    name: storageName,
    version: 1,
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
        game: saved.game ? { ...saved.game, isRoleVisible: false } : null,
        pendingVote: undefined,
        isVoteReady: false,
      }
    },
  }))
}

export const gameStore = createGameStore()

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector)
}
