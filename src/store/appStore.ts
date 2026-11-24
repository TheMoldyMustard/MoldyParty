import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist, type StateStorage } from 'zustand/middleware'
import type { AppGameId } from '../domain/types'

export interface AppStoreState {
  activeGameId: AppGameId | null
  recoveryNotice: string
  setActiveGame: (gameId: AppGameId | null) => void
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
    version: 2,
    migrate: (persisted) => persisted,
    partialize: (state) => ({ activeGameId: state.activeGameId }),
    merge: (persisted, current) => {
      const saved = persisted && typeof persisted === 'object' ? persisted as Partial<AppStoreState> : {}
      const activeGameId = ['impostor', 'charades', 'category-bomb'].includes(String(saved.activeGameId))
        ? saved.activeGameId as AppGameId
        : null
      return { ...current, activeGameId, recoveryNotice: '' }
    },
  }))
}

export function resolveActiveGame(
  explicit: AppGameId | null,
  hasImpostorGame: boolean,
  hasCharadesGame: boolean,
  hasCategoryBombGame = false,
): AppGameId | null {
  if (explicit === 'impostor') return hasImpostorGame ? 'impostor' : null
  if (explicit === 'charades') return hasCharadesGame ? 'charades' : null
  if (explicit === 'category-bomb') return hasCategoryBombGame ? 'category-bomb' : null
  if (hasImpostorGame) return 'impostor'
  if (hasCharadesGame) return 'charades'
  if (hasCategoryBombGame) return 'category-bomb'
  return null
}

export const appStore = createAppStore()

export function useAppStore<T>(selector: (state: AppStoreState) => T): T {
  return useStore(appStore, selector)
}
