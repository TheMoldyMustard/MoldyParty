import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist, type StateStorage } from 'zustand/middleware'
import type { WordItem } from '../domain/types'
import {
  advanceFromSummary as advanceDomain,
  applyFoul as applyFoulDomain,
  beginTurn as beginTurnDomain,
  createCharadesSession,
  submitOutcome as submitOutcomeDomain,
  syncClock as syncClockDomain,
  type CharadesOutcome,
  type CharadesSession,
  type CharadesSettings,
} from '../domain/charades'
import { noRepeatHistory, type NoRepeatHistory } from '../features/charades/noRepeatHistory'

export interface CharadesStoreState {
  session: CharadesSession | null
  startSession: (settings: CharadesSettings, items: WordItem[]) => void
  beginTurn: (now?: number) => void
  submitOutcome: (outcome: CharadesOutcome, cardToken: number, now?: number) => void
  applyFoul: (now?: number) => void
  syncClock: (now?: number) => void
  advanceFromSummary: () => void
  resetSession: () => void
  recover: (now?: number) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRecoverableSession(value: unknown): value is CharadesSession {
  if (!isRecord(value)) return false
  if (!['GET_READY', 'ACTIVE', 'ROUND_SUMMARY', 'SESSION_SUMMARY'].includes(String(value.phase))) return false
  if (!isRecord(value.settings) || !Array.isArray(value.cards) || value.cards.length < 2) return false
  if (!Array.isArray(value.remainingDeck) || !Array.isArray(value.currentEvents) || !Array.isArray(value.turnSummaries)) return false
  if (!Array.isArray(value.teamTurnCounts) || value.teamTurnCounts.length !== 2) return false
  return true
}

function jsonStorage(storage: StateStorage) {
  return {
    getItem: (name: string) => Promise.resolve(storage.getItem(name)).then((value) => value ? JSON.parse(value) : null),
    setItem: (name: string, value: unknown) => Promise.resolve(storage.setItem(name, JSON.stringify(value))),
    removeItem: (name: string) => Promise.resolve(storage.removeItem(name)),
  }
}

export function createCharadesStore(
  storageName = 'moldyparty-charades',
  random: () => number = Math.random,
  storage: StateStorage = localStorage,
  clock: () => number = Date.now,
  history: NoRepeatHistory = noRepeatHistory,
) {
  return createStore<CharadesStoreState>()(persist((set, get) => ({
    session: null,
    startSession: (settings, items) => set(() => {
      const usedWordKeys = settings.noRepeatEnabled ? history.getUsed(settings.packId) : []
      return {
        session: createCharadesSession(settings, items, random, {
          usedWordKeys,
          previousWordKey: usedWordKeys.at(-1) ?? null,
        }),
      }
    }),
    beginTurn: (now = clock()) => set((state) => ({
      session: state.session ? beginTurnDomain(state.session, now, random) : null,
    })),
    submitOutcome: (outcome, cardToken, now = clock()) => set((state) => {
      if (!state.session) return state
      const playedWord = state.session.currentCard?.word
      const beforeEventCount = state.session.currentEvents.length
      const session = submitOutcomeDomain(state.session, outcome, cardToken, now, random)
      if (session.currentEvents.length === beforeEventCount + 1 && playedWord && state.session.settings.noRepeatEnabled) {
        history.markUsed(state.session.settings.packId, playedWord)
      }
      return { session }
    }),
    applyFoul: (now = clock()) => set((state) => ({
      session: state.session ? applyFoulDomain(state.session, now) : null,
    })),
    syncClock: (now = clock()) => set((state) => ({
      session: state.session ? syncClockDomain(state.session, now) : null,
    })),
    advanceFromSummary: () => set((state) => ({
      session: state.session ? advanceDomain(state.session) : null,
    })),
    resetSession: () => set({ session: null }),
    recover: (now = clock()) => {
      const session = get().session
      if (session) set({ session: syncClockDomain(session, now) })
    },
  }), {
    name: storageName,
    storage: jsonStorage(storage),
    version: 1,
    partialize: (state) => ({ session: state.session }),
    merge: (persisted, current) => {
      const saved = isRecord(persisted) && isRecoverableSession(persisted.session) ? persisted.session : null
      return { ...current, session: saved }
    },
    onRehydrateStorage: () => (state) => state?.recover(clock()),
  }))
}

export const charadesStore = createCharadesStore()

export function useCharadesStore<T>(selector: (state: CharadesStoreState) => T): T {
  return useStore(charadesStore, selector)
}
