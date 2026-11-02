import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferencesState {
  defaultDiscussionSeconds: number | null
  installPromptDismissed: boolean
  setDefaultDiscussionSeconds: (seconds: number | null) => void
  dismissInstallPrompt: () => void
}

export const usePreferencesStore = create<PreferencesState>()(persist((set) => ({
  defaultDiscussionSeconds: 180,
  installPromptDismissed: false,
  setDefaultDiscussionSeconds: (seconds) => set({ defaultDiscussionSeconds: seconds }),
  dismissInstallPrompt: () => set({ installPromptDismissed: true }),
}), {
  name: 'moldyparty-preferences',
  version: 1,
}))
