import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist, type StateStorage } from 'zustand/middleware'
import {
  acceptCategoryBombAnswer,
  armCategoryBombRound,
  callCategoryBombFoul,
  createCategoryBombRound,
  deriveCategoryBombDisplayMode,
  replayCategoryBombRound,
  swapCategoryBombSeats,
  syncCategoryBombClock,
  validateCategoryBombSettings,
  type CategoryBombRound,
  type CategoryBombTurnPolicy,
} from '../domain/categoryBomb'
import { categoryBombPrompts, type CategoryBombPrompt } from '../domain/categoryBombCategories'

export interface CategoryBombStoreState {
  round: CategoryBombRound | null
  startSetup: (playerNames: string[], turnPolicy: CategoryBombTurnPolicy) => void
  swapSeats: (firstPlayerId: string, secondPlayerId: string) => void
  arm: (now?: number) => void
  acceptAnswer: (actionToken: number, now?: number) => void
  callFoul: (actionToken: number, now?: number) => void
  syncClock: (now?: number) => void
  replay: (now?: number) => void
  returnToPreRound: () => void
  reset: () => void
  recover: (now?: number) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecoverableRound(value: unknown): value is CategoryBombRound {
  if (!isRecord(value) || !['PLACEMENT', 'READY', 'ACTIVE', 'EXPLODED'].includes(String(value.phase))) return false
  if (!isRecord(value.settings) || !Array.isArray(value.settings.players)) return false
  const players = value.settings.players.flatMap((player) => isRecord(player) && typeof player.id === 'string' && typeof player.name === 'string'
    ? [{ id: player.id, name: player.name, seat: player.seat }]
    : [])
  if (players.length !== value.settings.players.length) return false
  const settings = {
    turnPolicy: value.settings.turnPolicy,
    players,
  } as CategoryBombRound['settings']
  if (validateCategoryBombSettings(settings).length > 0) return false
  const displayMode = deriveCategoryBombDisplayMode(players.length)
  if (value.displayMode !== displayMode) return false
  if (displayMode === 'name-only' && players.some((player) => player.seat !== null)) return false
  if (displayMode === 'radial') {
    const usedSeats = players.map((player) => player.seat)
    if (usedSeats.some((seat) => typeof seat !== 'string') || new Set(usedSeats).size !== players.length) return false
  }
  if (typeof value.categoryId !== 'string' || typeof value.categoryLabel !== 'string') return false
  if (!Array.isArray(value.remainingCyclePlayerIds) || typeof value.actionToken !== 'number') return false
  if (value.phase === 'ACTIVE') {
    if (typeof value.currentPlayerId !== 'string' || typeof value.deadlineMs !== 'number') return false
    if (!players.some((player) => player.id === value.currentPlayerId)) return false
  }
  return true
}

function jsonStorage(storage: StateStorage) {
  return {
    getItem: (name: string) => Promise.resolve(storage.getItem(name)).then((value) => value ? JSON.parse(value) : null),
    setItem: (name: string, value: unknown) => Promise.resolve(storage.setItem(name, JSON.stringify(value))),
    removeItem: (name: string) => Promise.resolve(storage.removeItem(name)),
  }
}

export function createCategoryBombStore(
  storageName = 'moldyparty-category-bomb',
  random: () => number = Math.random,
  storage: StateStorage = localStorage,
  clock: () => number = Date.now,
  prompts: CategoryBombPrompt[] = categoryBombPrompts,
) {
  return createStore<CategoryBombStoreState>()(persist((set, get) => ({
    round: null,
    startSetup: (playerNames, turnPolicy) => set({
      round: createCategoryBombRound({
        turnPolicy,
        players: playerNames.map((name, index) => ({ id: `category-player-${index + 1}`, name, seat: null })),
      }, prompts, random),
    }),
    swapSeats: (firstPlayerId, secondPlayerId) => set((state) => ({
      round: state.round ? swapCategoryBombSeats(state.round, firstPlayerId, secondPlayerId) : null,
    })),
    arm: (now = clock()) => set((state) => ({
      round: state.round ? armCategoryBombRound(state.round, random, now) : null,
    })),
    acceptAnswer: (actionToken, now = clock()) => set((state) => ({
      round: state.round ? acceptCategoryBombAnswer(state.round, actionToken, now, random) : null,
    })),
    callFoul: (actionToken, now = clock()) => set((state) => ({
      round: state.round ? callCategoryBombFoul(state.round, actionToken, now) : null,
    })),
    syncClock: (now = clock()) => set((state) => ({
      round: state.round ? syncCategoryBombClock(state.round, now) : null,
    })),
    replay: (now = clock()) => set((state) => ({
      round: state.round ? replayCategoryBombRound(state.round, prompts, random, now) : null,
    })),
    returnToPreRound: () => set((state) => state.round ? ({
      round: {
        ...state.round,
        phase: state.round.displayMode === 'radial' ? 'PLACEMENT' : 'READY',
        currentPlayerId: null,
        remainingCyclePlayerIds: [],
        deadlineMs: null,
        extensionGrantedMs: 0,
        actionToken: state.round.actionToken + 1,
        explodedPlayerId: null,
        explosionReason: null,
      },
    }) : state),
    reset: () => set({ round: null }),
    recover: (now = clock()) => {
      const round = get().round
      if (round) set({ round: syncCategoryBombClock(round, now) })
    },
  }), {
    name: storageName,
    version: 1,
    storage: jsonStorage(storage),
    partialize: (state) => ({ round: state.round }),
    merge: (persisted, current) => {
      const saved = isRecord(persisted) && isRecoverableRound(persisted.round) ? persisted.round : null
      return { ...current, round: saved }
    },
    onRehydrateStorage: () => (state) => state?.recover(clock()),
  }))
}

export const categoryBombStore = createCategoryBombStore()

export function useCategoryBombStore<T>(selector: (state: CategoryBombStoreState) => T): T {
  return useStore(categoryBombStore, selector)
}
