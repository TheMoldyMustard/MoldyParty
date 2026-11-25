import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { persist, type StateStorage } from 'zustand/middleware'
import type { CharadesCategory, WordItem } from '../domain/types'
import {
  advanceFromSummary as advanceDomain,
  applyFoul as applyFoulDomain,
  beginTurn as beginTurnDomain,
  createCharadesSession,
  submitOutcome as submitOutcomeDomain,
  syncClock as syncClockDomain,
  validateCharadesSettings,
  type CharadesMode,
  type CharadesOutcome,
  type CharadesPlayer,
  type CharadesSession,
  type CharadesSettings,
} from '../domain/charades'
import {
  calculateCharadesRelayResult,
  calculateCharadesTurnStats,
  emptyCharadesPlayerStats,
  type CharadesPlayerStats,
} from '../domain/charadesStats'
import { noRepeatHistory, type NoRepeatHistory } from '../features/charades/noRepeatHistory'

export interface CharadesSessionRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  completedTurns: number
  completedRelayGames: number
  players: CharadesPlayer[]
  setup: CharadesSettings
  statsByPlayerId: Record<string, CharadesPlayerStats>
  currentGame: CharadesSession | null
  trackingEnabled: boolean
}

export interface CharadesStoreState {
  session: CharadesSession | null
  sessionsById: Record<string, CharadesSessionRecord>
  activeSessionId: string | null
  pendingSessionName: string | null
  createSession: (name: string) => void
  continueSession: (sessionId: string) => void
  renameSession: (sessionId: string, name: string) => void
  deleteSession: (sessionId: string) => void
  abortSession: () => void
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

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function deriveLegacyRelayPlayers(settings: CharadesSettings): CharadesSettings {
  if (settings.players || settings.mode !== 'team-relay' || !settings.teams) return settings
  let index = 0
  const players: CharadesPlayer[] = []
  const teams = settings.teams.map((team) => {
    const memberPlayerIds = team.members.map((name) => {
      index += 1
      const id = `charades-player-${index}`
      players.push({ id, name })
      return id
    })
    return { ...team, memberPlayerIds }
  }) as CharadesSettings['teams']
  return { ...settings, players, teams }
}

function migrateLegacyGame(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.settings)) return value
  const rawSettings = value.settings as unknown as CharadesSettings
  const settings = deriveLegacyRelayPlayers(rawSettings)
  const durationMs = Number(settings.durationSeconds) * 1_000
  const summaries = Array.isArray(value.turnSummaries) ? value.turnSummaries.map((summary) => isRecord(summary) ? {
    ...summary,
    holderPlayerId: typeof summary.holderPlayerId === 'string' ? summary.holderPlayerId : null,
    activeDurationMs: typeof summary.activeDurationMs === 'number' ? summary.activeDurationMs : durationMs,
    statsRecorded: typeof summary.statsRecorded === 'boolean' ? summary.statsRecorded : true,
  } : summary) : value.turnSummaries
  const startedAtMs = 'startedAtMs' in value
    ? value.startedAtMs
    : value.phase === 'ACTIVE' && typeof value.deadlineMs === 'number' ? value.deadlineMs - durationMs : null
  return {
    ...value,
    settings,
    turnSummaries: summaries,
    startedAtMs,
    relayResultRecorded: typeof value.relayResultRecorded === 'boolean' ? value.relayResultRecorded : value.phase === 'SESSION_SUMMARY',
  }
}

function isRecoverableSession(value: unknown): value is CharadesSession {
  if (!isRecord(value)) return false
  if (!['GET_READY', 'ACTIVE', 'ROUND_SUMMARY', 'SESSION_SUMMARY'].includes(String(value.phase))) return false
  if (!isRecord(value.settings) || !Array.isArray(value.cards) || value.cards.length < 2) return false
  if (!Array.isArray(value.remainingDeck) || !Array.isArray(value.currentEvents) || !Array.isArray(value.turnSummaries)) return false
  if (!Array.isArray(value.teamTurnCounts) || value.teamTurnCounts.length !== 2) return false
  if (!(value.startedAtMs === null || (typeof value.startedAtMs === 'number' && Number.isFinite(value.startedAtMs)))) return false
  if (typeof value.relayResultRecorded !== 'boolean') return false
  if (value.phase === 'ACTIVE' && typeof value.startedAtMs !== 'number') return false
  if (value.phase !== 'ACTIVE' && value.startedAtMs !== null) return false
  if (value.turnSummaries.some((summary) => !isRecord(summary)
    || !(summary.holderPlayerId === null || typeof summary.holderPlayerId === 'string')
    || !isNonNegativeInteger(summary.activeDurationMs)
    || typeof summary.statsRecorded !== 'boolean')) return false
  const settings = value.settings as unknown as CharadesSettings
  try {
    if (validateCharadesSettings(settings, value.cards.length).length > 0) return false
  } catch {
    return false
  }
  return true
}

function isCountStats(value: unknown): boolean {
  return isRecord(value) && isNonNegativeInteger(value.turnsPlayed) && isNonNegativeInteger(value.correct) && isNonNegativeInteger(value.passes)
}

function isCategoryStats(value: unknown): boolean {
  return isRecord(value) && isNonNegativeInteger(value.attempted) && isNonNegativeInteger(value.correct)
}

function isPlayerStats(value: unknown): value is CharadesPlayerStats {
  if (!isRecord(value)) return false
  if (![value.turnsPlayed, value.correct, value.passes, value.activeDurationMs, value.bestTurn, value.longestCorrectStreak, value.henyoFouls, value.relayWins, value.relayLosses, value.relayTies].every(isNonNegativeInteger)) return false
  const byMode = value.byMode
  const byCategory = value.byCategory
  if (!isRecord(byMode) || !isRecord(byCategory)) return false
  return ['classic', 'henyo', 'one-word', 'team-relay'].every((mode) => isCountStats(byMode[mode]))
    && ['person', 'place', 'object', 'animal', 'food', 'pop-culture', 'other'].every((category) => isCategoryStats(byCategory[category]))
}

function settingsMatchRoster(settings: CharadesSettings, players: CharadesPlayer[]): boolean {
  const settingsPlayers = settings.players ?? []
  return settingsPlayers.length === players.length
    && settingsPlayers.every((player, index) => player.id === players[index].id && player.name === players[index].name)
}

function gameMatchesRoster(game: CharadesSession, players: CharadesPlayer[]): boolean {
  return settingsMatchRoster(game.settings, players)
}

function normalizeSession(id: string, value: unknown): CharadesSessionRecord | null {
  if (!isRecord(value) || value.id !== id || typeof value.name !== 'string' || !value.name.trim()) return null
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' || !Array.isArray(value.players) || !isRecord(value.setup)) return null
  if (!isNonNegativeInteger(value.completedTurns) || !isNonNegativeInteger(value.completedRelayGames) || typeof value.trackingEnabled !== 'boolean') return null
  const players = value.players.flatMap((player) => isRecord(player) && typeof player.id === 'string' && typeof player.name === 'string'
    ? [{ id: player.id, name: player.name }]
    : [])
  if (players.length !== value.players.length || new Set(players.map((player) => player.id)).size !== players.length) return null
  if (value.trackingEnabled !== (players.length >= 2)) return null
  const statsByPlayerId = value.statsByPlayerId
  if (!isRecord(statsByPlayerId) || players.some((player) => !isPlayerStats(statsByPlayerId[player.id]))) return null
  const setup = value.setup as unknown as CharadesSettings
  try {
    if (validateCharadesSettings(setup, 2).some((error) => !error.startsWith('Choose filters'))) return null
  } catch {
    return null
  }
  if (!settingsMatchRoster(setup, players)) return null
  const candidate = value.currentGame === null ? null : migrateLegacyGame(value.currentGame)
  let currentGame = candidate === null ? null : isRecoverableSession(candidate) ? candidate : null
  if (currentGame && !gameMatchesRoster(currentGame, players)) currentGame = null
  return { ...value, id, name: value.name.trim(), players, setup, currentGame } as CharadesSessionRecord
}

function jsonStorage(storage: StateStorage) {
  return {
    getItem: (name: string) => Promise.resolve(storage.getItem(name)).then((value) => value ? JSON.parse(value) : null),
    setItem: (name: string, value: unknown) => Promise.resolve(storage.setItem(name, JSON.stringify(value))),
    removeItem: (name: string) => Promise.resolve(storage.removeItem(name)),
  }
}

const modes: CharadesMode[] = ['classic', 'henyo', 'one-word', 'team-relay']
const categories: CharadesCategory[] = ['person', 'place', 'object', 'animal', 'food', 'pop-culture', 'other']

function addPlayerStats(current: CharadesPlayerStats, delta: CharadesPlayerStats): CharadesPlayerStats {
  return {
    turnsPlayed: current.turnsPlayed + delta.turnsPlayed,
    correct: current.correct + delta.correct,
    passes: current.passes + delta.passes,
    activeDurationMs: current.activeDurationMs + delta.activeDurationMs,
    bestTurn: Math.max(current.bestTurn, delta.bestTurn),
    longestCorrectStreak: Math.max(current.longestCorrectStreak, delta.longestCorrectStreak),
    henyoFouls: current.henyoFouls + delta.henyoFouls,
    relayWins: current.relayWins + delta.relayWins,
    relayLosses: current.relayLosses + delta.relayLosses,
    relayTies: current.relayTies + delta.relayTies,
    byMode: Object.fromEntries(modes.map((mode) => [mode, {
      turnsPlayed: current.byMode[mode].turnsPlayed + delta.byMode[mode].turnsPlayed,
      correct: current.byMode[mode].correct + delta.byMode[mode].correct,
      passes: current.byMode[mode].passes + delta.byMode[mode].passes,
    }])) as CharadesPlayerStats['byMode'],
    byCategory: Object.fromEntries(categories.map((category) => [category, {
      attempted: current.byCategory[category].attempted + delta.byCategory[category].attempted,
      correct: current.byCategory[category].correct + delta.byCategory[category].correct,
    }])) as CharadesPlayerStats['byCategory'],
  }
}

function withCurrentGame(state: CharadesStoreState, game: CharadesSession | null, now: number): Partial<CharadesStoreState> {
  if (!state.activeSessionId || !state.sessionsById[state.activeSessionId]) return { session: game }
  const record = state.sessionsById[state.activeSessionId]
  if (!game) return { session: null, sessionsById: { ...state.sessionsById, [record.id]: { ...record, currentGame: null } } }
  let nextGame = game
  let completedTurns = record.completedTurns
  let completedRelayGames = record.completedRelayGames
  let statsByPlayerId = record.statsByPlayerId
  const lastIndex = nextGame.turnSummaries.length - 1
  const summary = nextGame.turnSummaries[lastIndex]
  if (summary && !summary.statsRecorded) {
    const turnDelta = record.trackingEnabled ? calculateCharadesTurnStats(summary, nextGame.settings.mode) : null
    const summaries = nextGame.turnSummaries.map((item, index) => index === lastIndex ? { ...item, statsRecorded: true } : item)
    nextGame = { ...nextGame, turnSummaries: summaries }
    if (turnDelta && statsByPlayerId[turnDelta.playerId]) {
      statsByPlayerId = { ...statsByPlayerId, [turnDelta.playerId]: addPlayerStats(statsByPlayerId[turnDelta.playerId], turnDelta.delta) }
      completedTurns += 1
    }
  }
  const relayResults = record.trackingEnabled ? calculateCharadesRelayResult(nextGame) : null
  if (nextGame.phase === 'SESSION_SUMMARY' && !nextGame.relayResultRecorded) {
    nextGame = { ...nextGame, relayResultRecorded: true }
    if (relayResults) {
      statsByPlayerId = Object.fromEntries(Object.entries(statsByPlayerId).map(([playerId, stats]) => {
        const result = relayResults[playerId]
        return [playerId, result === 'win' ? { ...stats, relayWins: stats.relayWins + 1 }
          : result === 'loss' ? { ...stats, relayLosses: stats.relayLosses + 1 }
            : result === 'tie' ? { ...stats, relayTies: stats.relayTies + 1 } : stats]
      }))
      completedRelayGames += 1
    }
  }
  return {
    session: nextGame,
    sessionsById: {
      ...state.sessionsById,
      [record.id]: {
        ...record,
        updatedAt: new Date(now).toISOString(),
        completedTurns,
        completedRelayGames,
        statsByPlayerId,
        currentGame: nextGame,
      },
    },
  }
}

export function createCharadesStore(
  storageName = 'moldyparty-charades',
  random: () => number = Math.random,
  storage: StateStorage = localStorage,
  clock: () => number = Date.now,
  history: NoRepeatHistory = noRepeatHistory,
  idFactory: () => string = () => globalThis.crypto?.randomUUID?.() ?? `charades-session-${clock()}-${Math.floor(random() * 1_000_000)}`,
) {
  return createStore<CharadesStoreState>()(persist((set, get) => ({
    session: null,
    sessionsById: {},
    activeSessionId: null,
    pendingSessionName: null,
    createSession: (name) => set({ pendingSessionName: name.trim() || 'New Session', activeSessionId: null, session: null }),
    continueSession: (sessionId) => set((state) => {
      const record = state.sessionsById[sessionId]
      return record ? { activeSessionId: sessionId, pendingSessionName: null, session: record.currentGame } : state
    }),
    renameSession: (sessionId, name) => set((state) => {
      const record = state.sessionsById[sessionId]
      const trimmed = name.trim()
      if (!record || !trimmed) return state
      return { sessionsById: { ...state.sessionsById, [sessionId]: { ...record, name: trimmed, updatedAt: new Date(clock()).toISOString() } } }
    }),
    deleteSession: (sessionId) => set((state) => {
      if (!state.sessionsById[sessionId]) return state
      const sessionsById = { ...state.sessionsById }
      delete sessionsById[sessionId]
      const active = state.activeSessionId === sessionId
      return { sessionsById, activeSessionId: active ? null : state.activeSessionId, session: active ? null : state.session }
    }),
    abortSession: () => set((state) => ({ ...withCurrentGame(state, null, clock()), activeSessionId: null })),
    startSession: (settings, items) => set((state) => {
      const existing = state.activeSessionId ? state.sessionsById[state.activeSessionId] : null
      let effectiveSettings = deriveLegacyRelayPlayers(settings)
      const existingHasRoster = Boolean(existing?.players.length)
      if (existingHasRoster) effectiveSettings = { ...effectiveSettings, players: existing!.players }
      const rotationPlayers = effectiveSettings.players ?? []
      if (effectiveSettings.mode !== 'team-relay' && rotationPlayers.length > 0) {
        effectiveSettings = { ...effectiveSettings, holderRotationOffset: existing ? existing.completedTurns % rotationPlayers.length : 0 }
      }
      const usedWordKeys = effectiveSettings.noRepeatEnabled ? history.getUsed(effectiveSettings.packId) : []
      const game = createCharadesSession(effectiveSettings, items, random, { usedWordKeys, previousWordKey: usedWordKeys.at(-1) ?? null })
      const players = existingHasRoster ? existing!.players : effectiveSettings.players ?? []
      const sessionId = existing?.id ?? idFactory()
      const timestamp = new Date(clock()).toISOString()
      const record: CharadesSessionRecord = existing ? {
        ...existing,
        players,
        setup: effectiveSettings,
        statsByPlayerId: existingHasRoster ? existing.statsByPlayerId : Object.fromEntries(players.map((player) => [player.id, emptyCharadesPlayerStats()])),
        currentGame: game,
        trackingEnabled: existingHasRoster ? existing.trackingEnabled : players.length >= 2,
        updatedAt: timestamp,
      } : {
        id: sessionId,
        name: state.pendingSessionName ?? `Session ${Object.keys(state.sessionsById).length + 1}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedTurns: 0,
        completedRelayGames: 0,
        players,
        setup: effectiveSettings,
        statsByPlayerId: Object.fromEntries(players.map((player) => [player.id, emptyCharadesPlayerStats()])),
        currentGame: game,
        trackingEnabled: players.length >= 2,
      }
      return { session: game, sessionsById: { ...state.sessionsById, [sessionId]: record }, activeSessionId: sessionId, pendingSessionName: null }
    }),
    beginTurn: (now = clock()) => set((state) => withCurrentGame(state, state.session ? beginTurnDomain(state.session, now, random) : null, now)),
    submitOutcome: (outcome, cardToken, now = clock()) => set((state) => {
      if (!state.session) return state
      const playedWord = state.session.currentCard?.word
      const beforeEventCount = state.session.currentEvents.length
      const game = submitOutcomeDomain(state.session, outcome, cardToken, now, random)
      if (game.currentEvents.length === beforeEventCount + 1 && playedWord && state.session.settings.noRepeatEnabled) history.markUsed(state.session.settings.packId, playedWord)
      return withCurrentGame(state, game, now)
    }),
    applyFoul: (now = clock()) => set((state) => withCurrentGame(state, state.session ? applyFoulDomain(state.session, now) : null, now)),
    syncClock: (now = clock()) => set((state) => withCurrentGame(state, state.session ? syncClockDomain(state.session, now) : null, now)),
    advanceFromSummary: () => set((state) => withCurrentGame(state, state.session ? advanceDomain(state.session) : null, clock())),
    resetSession: () => set((state) => ({ ...withCurrentGame(state, null, clock()), activeSessionId: null })),
    recover: (now = clock()) => {
      const state = get()
      if (state.session) set(withCurrentGame(state, syncClockDomain(state.session, now), now))
    },
  }), {
    name: storageName,
    storage: jsonStorage(storage),
    version: 2,
    migrate: (persisted) => persisted,
    partialize: (state) => ({ session: state.session, sessionsById: state.sessionsById, activeSessionId: state.activeSessionId, pendingSessionName: state.pendingSessionName }),
    merge: (persisted, current) => {
      const saved = isRecord(persisted) ? persisted : {}
      const sessionsById = isRecord(saved.sessionsById)
        ? Object.fromEntries(Object.entries(saved.sessionsById).flatMap(([id, value]) => {
            const record = normalizeSession(id, value)
            return record ? [[id, record]] : []
          }))
        : {}
      let activeSessionId = typeof saved.activeSessionId === 'string' && sessionsById[saved.activeSessionId] ? saved.activeSessionId : null
      if (activeSessionId && 'session' in saved) {
        const candidate = saved.session === null ? null : migrateLegacyGame(saved.session)
        const record = sessionsById[activeSessionId]
        const currentGame = candidate !== null && isRecoverableSession(candidate) && gameMatchesRoster(candidate, record.players) ? candidate : null
        sessionsById[activeSessionId] = { ...sessionsById[activeSessionId], currentGame }
      }
      if (Object.keys(sessionsById).length === 0) {
        const candidate = migrateLegacyGame(saved.session)
        if (isRecoverableSession(candidate)) {
          const sessionId = idFactory()
          const timestamp = new Date(clock()).toISOString()
          const players = candidate.settings.players ?? []
          sessionsById[sessionId] = {
            id: sessionId,
            name: 'Recovered Charades',
            createdAt: timestamp,
            updatedAt: timestamp,
            completedTurns: 0,
            completedRelayGames: 0,
            players,
            setup: candidate.settings,
            statsByPlayerId: Object.fromEntries(players.map((player) => [player.id, emptyCharadesPlayerStats()])),
            currentGame: candidate,
            trackingEnabled: players.length >= 2,
          }
          activeSessionId = sessionId
        }
      }
      const active = activeSessionId ? sessionsById[activeSessionId] : null
      return {
        ...current,
        sessionsById,
        activeSessionId,
        pendingSessionName: typeof saved.pendingSessionName === 'string' ? saved.pendingSessionName : null,
        session: active?.currentGame ?? null,
      }
    },
    onRehydrateStorage: () => (state) => state?.recover(clock()),
  }))
}

export const charadesStore = createCharadesStore()

export function useCharadesStore<T>(selector: (state: CharadesStoreState) => T): T {
  return useStore(charadesStore, selector)
}
