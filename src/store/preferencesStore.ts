import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist, type StateStorage } from 'zustand/middleware'

export interface PreferencesState {
  defaultDiscussionSeconds: number | null
  installPromptDismissed: boolean
  soundEnabled: boolean
  hapticsEnabled: boolean
  setDefaultDiscussionSeconds: (seconds: number | null) => void
  dismissInstallPrompt: () => void
  setSoundEnabled: (enabled: boolean) => void
  setHapticsEnabled: (enabled: boolean) => void
}

function jsonStorage(storage: StateStorage) {
  return {
    getItem: (name: string) => Promise.resolve(storage.getItem(name)).then((value) => value ? JSON.parse(value) : null),
    setItem: (name: string, value: unknown) => Promise.resolve(storage.setItem(name, JSON.stringify(value))),
    removeItem: (name: string) => Promise.resolve(storage.removeItem(name)),
  }
}

export function createPreferencesStore(
  storageName = 'moldyparty-preferences',
  storage: StateStorage = localStorage,
) {
  return createStore<PreferencesState>()(persist((set) => ({
    defaultDiscussionSeconds: 180,
    installPromptDismissed: false,
    soundEnabled: true,
    hapticsEnabled: true,
    setDefaultDiscussionSeconds: (seconds) => set({ defaultDiscussionSeconds: seconds }),
    dismissInstallPrompt: () => set({ installPromptDismissed: true }),
    setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
    setHapticsEnabled: (enabled) => set({ hapticsEnabled: enabled }),
  }), {
    name: storageName,
    storage: jsonStorage(storage),
    version: 2,
    migrate: (persisted) => {
      const saved = persisted && typeof persisted === 'object' ? persisted as Partial<PreferencesState> : {}
      return {
        ...saved,
        soundEnabled: typeof saved.soundEnabled === 'boolean' ? saved.soundEnabled : true,
        hapticsEnabled: typeof saved.hapticsEnabled === 'boolean' ? saved.hapticsEnabled : true,
      }
    },
  }))
}

export const preferencesStore = createPreferencesStore()

export function usePreferencesStore<T>(selector: (state: PreferencesState) => T): T {
  return useStore(preferencesStore, selector)
}
