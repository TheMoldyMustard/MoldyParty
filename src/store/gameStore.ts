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
  lobbyIntent: LobbyIntent
  startGame: (setup: GameSetupInput) => void
  showRole: () => void
  hideRole: () => void
  confirmRole: () => void
  beginVoting: () => void
  showVote: () => void
  castVote: (targetId: string | null) => void
  confirmVote: () => void
  playAgain: () => void
  changeCategory: () => void
  returnToLobby: () => void
}

export function createGameStore(
  storageName = 'moldyparty-game',
  random: () => number = Math.random,
  storage: StateStorage = localStorage,
) {
  return createStore<GameStoreState>()(persist((set) => ({
    setup: null,
    game: null,
    pendingVote: undefined,
    isVoteReady: false,
    lobbyIntent: 'default',

    startGame: (setup) => set({
      setup,
      game: createRound(setup, random),
      pendingVote: undefined,
      isVoteReady: false,
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

    confirmRole: () => set((state) => state.game
      ? { game: advanceRoleReveal(state.game) }
      : state,
    ),

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

    playAgain: () => set((state) => {
      if (!state.setup) return state
      return {
        game: createRound({
          ...state.setup,
          round: (state.game?.round ?? 0) + 1,
        }, random),
        pendingVote: undefined,
        isVoteReady: false,
      }
    }),

    changeCategory: () => set({
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      lobbyIntent: 'category',
    }),

    returnToLobby: () => set({
      game: null,
      pendingVote: undefined,
      isVoteReady: false,
      lobbyIntent: 'default',
    }),
  }), {
    name: storageName,
    version: 1,
    storage: createJSONStorage(() => storage),
    partialize: (state) => ({
      setup: state.setup,
      game: state.game,
      pendingVote: state.pendingVote,
      isVoteReady: state.isVoteReady,
      lobbyIntent: state.lobbyIntent,
    }),
  }))
}

export const gameStore = createGameStore()

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector)
}
