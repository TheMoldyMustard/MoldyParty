import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist, type StateStorage } from 'zustand/middleware'
import type { GameId } from '../domain/types'

export interface AppStoreState {
  activeGameId: GameId | null
  recoveryNotice: string
  setActiveGame: (gameId: GameId | null) => void
  setRecoveryNotice: (notice: string) => void
}

function jsonStorage(storage: StateStorage) {
  return {
    getItem: (name: string) => Promise.resolve(storage.getItem(name)).then((value) => value ? JSON.parse(value) : null),
    setItem: (name: string, value: unknown) => Promise.resolve(storage.setItem(name, JSON.stringify(value))),
    removeItem: (name: string) => Promise.resolve(storage.removeItem(name)),
  }
}

export function createAppStore(storageName = 'moldyparty-app', storage: StateStorage = localStorage) {
  return createStore<AppStoreState>()(persist((set) => ({
    activeGameId: null,
    recoveryNotice: '',
    setActiveGame: (activeGameId) => set({ activeGameId }),
    setRecoveryNotice: (recoveryNotice) => set({ recoveryNotice }),
  }), {
    name: storageName,
    storage: jsonStorage(storage),
    version: 1,
    partialize: (state) => ({ activeGameId: state.activeGameId }),
  }))
}

export function resolveActiveGame(
  explicit: GameId | null,
  hasImpostorGame: boolean,
  hasCharadesGame: boolean,
): GameId | null {
  if (explicit === 'impostor') return hasImpostorGame ? 'impostor' : null
  if (explicit === 'charades') return hasCharadesGame ? 'charades' : null
  if (hasImpostorGame) return 'impostor'
  if (hasCharadesGame) return 'charades'
  return null
}

export const appStore = createAppStore()

export function useAppStore<T>(selector: (state: AppStoreState) => T): T {
  return useStore(appStore, selector)
}
