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

const categoryBombSeats = new Set([
  'top-left', 'top-center', 'top-right', 'right-top', 'right-center', 'right-bottom',
  'bottom-right', 'bottom-center', 'bottom-left', 'left-bottom', 'left-center', 'left-top',
])

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
    if (usedSeats.some((seat) => typeof seat !== 'string' || !categoryBombSeats.has(seat)) || new Set(usedSeats).size !== players.length) return false
  }
  if (typeof value.id !== 'string' || !value.id || typeof value.categoryId !== 'string' || !value.categoryId || typeof value.categoryLabel !== 'string' || !value.categoryLabel) return false
  if (!Array.isArray(value.remainingCyclePlayerIds) || !Number.isInteger(value.actionToken) || Number(value.actionToken) < 0) return false
  if (!Number.isFinite(value.extensionGrantedMs) || Number(value.extensionGrantedMs) < 0 || Number(value.extensionGrantedMs) > 15_000) return false
  const playerIds = new Set(players.map((player) => player.id))
  const queue = value.remainingCyclePlayerIds
  if (queue.some((id) => typeof id !== 'string' || !playerIds.has(id)) || new Set(queue).size !== queue.length) return false
  if (value.settings.turnPolicy === 'chaos' && queue.length > 0) return false
  const expectedSetupPhase = displayMode === 'radial' ? 'PLACEMENT' : 'READY'
  if ((value.phase === 'PLACEMENT' || value.phase === 'READY') && value.phase !== expectedSetupPhase) return false
  if ((value.phase === 'PLACEMENT' || value.phase === 'READY') && (
    value.currentPlayerId !== null || queue.length > 0 || value.deadlineMs !== null
    || value.explodedPlayerId !== null || value.explosionReason !== null
  )) return false
  if (value.phase === 'ACTIVE') {
    if (typeof value.currentPlayerId !== 'string' || !playerIds.has(value.currentPlayerId) || typeof value.deadlineMs !== 'number' || !Number.isFinite(value.deadlineMs)) return false
    if (queue.includes(value.currentPlayerId) || value.explodedPlayerId !== null || value.explosionReason !== null) return false
  }
  if (value.phase === 'EXPLODED') {
    if (typeof value.currentPlayerId !== 'string' || !playerIds.has(value.currentPlayerId) || value.deadlineMs !== null) return false
    if (typeof value.explodedPlayerId !== 'string' || !playerIds.has(value.explodedPlayerId) || value.explodedPlayerId !== value.currentPlayerId) return false
    if (!['timer', 'foul'].includes(String(value.explosionReason))) return false
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
    syncClock: (now = clock()) => {
      const round = get().round
      if (!round) return
      const next = syncCategoryBombClock(round, now)
      if (next !== round) set({ round: next })
    },
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
