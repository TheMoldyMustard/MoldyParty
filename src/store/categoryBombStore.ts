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
  type CategoryBombSettings,
  type CategoryBombTurnPolicy,
} from '../domain/categoryBomb'
import { categoryBombPrompts, type CategoryBombPrompt } from '../domain/categoryBombCategories'
import {
  calculateCategoryBombRoundStats,
  emptyCategoryBombPlayerStats,
  type CategoryBombPlayerStats,
} from '../domain/categoryBombStats'

export interface CategoryBombPassTimeBonusDraft {
  enabled: boolean
  minMs: number
  maxMs: number
}

export interface CategoryBombSessionSetup {
  turnPolicy: CategoryBombTurnPolicy
  passTimeBonusEnabled: boolean
  passTimeBonusMinMs: number
  passTimeBonusMaxMs: number
}

export interface CategoryBombCategoryStats {
  bombsPlayed: number
  explosions: number
}

export interface CategoryBombSessionRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  completedBombs: number
  totalSuccessfulAnswers: number
  longestBomb: number
  timerExplosions: number
  foulExplosions: number
  players: Array<{ id: string; name: string }>
  setup: CategoryBombSessionSetup
  statsByPlayerId: Record<string, CategoryBombPlayerStats>
  categoryStatsById: Record<string, CategoryBombCategoryStats>
  currentRound: CategoryBombRound | null
}

export const DEFAULT_CATEGORY_BOMB_PASS_TIME_BONUS: CategoryBombPassTimeBonusDraft = {
  enabled: false,
  minMs: 500,
  maxMs: 3_000,
}

export interface CategoryBombStoreState {
  round: CategoryBombRound | null
  sessionsById: Record<string, CategoryBombSessionRecord>
  activeSessionId: string | null
  pendingSessionName: string | null
  createSession: (name: string) => void
  continueSession: (sessionId: string) => void
  renameSession: (sessionId: string, name: string) => void
  deleteSession: (sessionId: string) => void
  abortRound: () => void
  editSetup: () => void
  startSetup: (playerNames: string[], turnPolicy: CategoryBombTurnPolicy, passTimeBonus?: CategoryBombPassTimeBonusDraft) => void
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

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

const categoryBombSeats = new Set([
  'top-left', 'top-center', 'top-right', 'right-top', 'right-center', 'right-bottom',
  'bottom-right', 'bottom-center', 'bottom-left', 'left-bottom', 'left-center', 'left-top',
])

function migrateLegacyRound(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.settings)) return value
  let migrated: Record<string, unknown> = value
  const hasNoPassBonusSettings = !('passTimeBonusEnabled' in value.settings)
    && !('passTimeBonusMinMs' in value.settings)
    && !('passTimeBonusMaxMs' in value.settings)
  if (hasNoPassBonusSettings && !('lastAppliedPassBonusMs' in value)) {
    migrated = {
      ...migrated,
      settings: {
        ...value.settings,
        passTimeBonusEnabled: true,
        passTimeBonusMinMs: 1_500,
        passTimeBonusMaxMs: 1_500,
      },
      lastAppliedPassBonusMs: 0,
    }
  }
  if (!('acceptedAnswerPlayerIds' in migrated)) migrated = { ...migrated, acceptedAnswerPlayerIds: [] }
  if (!('startedAtMs' in migrated)) migrated = { ...migrated, startedAtMs: null }
  if (!('statsRecorded' in migrated)) migrated = { ...migrated, statsRecorded: migrated.phase === 'EXPLODED' }
  return migrated
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
    passTimeBonusEnabled: value.settings.passTimeBonusEnabled,
    passTimeBonusMinMs: value.settings.passTimeBonusMinMs,
    passTimeBonusMaxMs: value.settings.passTimeBonusMaxMs,
    players,
  } as CategoryBombSettings
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
  if (!Number.isFinite(value.extensionGrantedMs) || Number(value.extensionGrantedMs) < 0 || Number(value.extensionGrantedMs) > 15_000 || !Number.isInteger(Number(value.extensionGrantedMs) / 100)) return false
  if (!Number.isFinite(value.lastAppliedPassBonusMs) || Number(value.lastAppliedPassBonusMs) < 0 || Number(value.lastAppliedPassBonusMs) > 10_000 || !Number.isInteger(Number(value.lastAppliedPassBonusMs) / 100)) return false
  if (Number(value.lastAppliedPassBonusMs) > Number(value.extensionGrantedMs)) return false
  if (!Array.isArray(value.acceptedAnswerPlayerIds) || typeof value.statsRecorded !== 'boolean') return false
  if (!(value.startedAtMs === null || (typeof value.startedAtMs === 'number' && Number.isFinite(value.startedAtMs)))) return false
  const playerIds = new Set(players.map((player) => player.id))
  if (value.acceptedAnswerPlayerIds.some((id) => typeof id !== 'string' || !playerIds.has(id))) return false
  const queue = value.remainingCyclePlayerIds
  if (queue.some((id) => typeof id !== 'string' || !playerIds.has(id)) || new Set(queue).size !== queue.length) return false
  if (value.settings.turnPolicy === 'chaos' && queue.length > 0) return false
  const expectedSetupPhase = displayMode === 'radial' ? 'PLACEMENT' : 'READY'
  if ((value.phase === 'PLACEMENT' || value.phase === 'READY') && value.phase !== expectedSetupPhase) return false
  if ((value.phase === 'PLACEMENT' || value.phase === 'READY') && (
    value.currentPlayerId !== null || queue.length > 0 || value.deadlineMs !== null
    || value.explodedPlayerId !== null || value.explosionReason !== null || value.startedAtMs !== null
    || value.acceptedAnswerPlayerIds.length > 0 || value.statsRecorded
  )) return false
  if (value.phase === 'ACTIVE') {
    if (typeof value.currentPlayerId !== 'string' || !playerIds.has(value.currentPlayerId) || typeof value.deadlineMs !== 'number' || !Number.isFinite(value.deadlineMs)) return false
    if (queue.includes(value.currentPlayerId) || value.explodedPlayerId !== null || value.explosionReason !== null || typeof value.startedAtMs !== 'number' || value.statsRecorded) return false
  }
  if (value.phase === 'EXPLODED') {
    if (typeof value.currentPlayerId !== 'string' || !playerIds.has(value.currentPlayerId) || value.deadlineMs !== null) return false
    if (typeof value.explodedPlayerId !== 'string' || !playerIds.has(value.explodedPlayerId) || value.explodedPlayerId !== value.currentPlayerId) return false
    if (!['timer', 'foul'].includes(String(value.explosionReason))) return false
  }
  return true
}

function isPlayerStats(value: unknown): value is CategoryBombPlayerStats {
  return isRecord(value)
    && isNonNegativeInteger(value.bombsPlayed)
    && isNonNegativeInteger(value.successfulAnswers)
    && isNonNegativeInteger(value.explosions)
    && isNonNegativeInteger(value.timerExplosions)
    && isNonNegativeInteger(value.foulExplosions)
    && isNonNegativeInteger(value.bestBomb)
}

function roundMatchesRoster(round: CategoryBombRound, players: Array<{ id: string; name: string }>): boolean {
  return round.settings.players.length === players.length
    && round.settings.players.every((player, index) => player.id === players[index].id && player.name === players[index].name)
}

function normalizeSession(id: string, value: unknown): CategoryBombSessionRecord | null {
  if (!isRecord(value) || value.id !== id || typeof value.name !== 'string' || !value.name.trim()) return null
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' || !Array.isArray(value.players) || !isRecord(value.setup)) return null
  const players = value.players.flatMap((player) => isRecord(player) && typeof player.id === 'string' && typeof player.name === 'string'
    ? [{ id: player.id, name: player.name }]
    : [])
  if (players.length < 2 || players.length !== value.players.length || new Set(players.map((player) => player.id)).size !== players.length) return null
  if (![value.completedBombs, value.totalSuccessfulAnswers, value.longestBomb, value.timerExplosions, value.foulExplosions].every(isNonNegativeInteger)) return null
  const statsByPlayerId = value.statsByPlayerId
  if (!isRecord(statsByPlayerId) || !isRecord(value.categoryStatsById)) return null
  if (players.some((player) => !isPlayerStats(statsByPlayerId[player.id]))) return null
  if (Object.values(value.categoryStatsById).some((stats) => !isRecord(stats) || !isNonNegativeInteger(stats.bombsPlayed) || !isNonNegativeInteger(stats.explosions))) return null
  const setup: CategoryBombSessionSetup = {
    turnPolicy: value.setup.turnPolicy as CategoryBombTurnPolicy,
    passTimeBonusEnabled: value.setup.passTimeBonusEnabled as boolean,
    passTimeBonusMinMs: Number(value.setup.passTimeBonusMinMs),
    passTimeBonusMaxMs: Number(value.setup.passTimeBonusMaxMs),
  }
  if (validateCategoryBombSettings({ ...setup, players: players.map((player) => ({ ...player, seat: null })) }).length > 0) return null
  const currentCandidate = value.currentRound === null ? null : migrateLegacyRound(value.currentRound)
  let currentRound = currentCandidate === null ? null : isRecoverableRound(currentCandidate) ? currentCandidate : null
  if (currentRound && !roundMatchesRoster(currentRound, players)) currentRound = null
  return { ...value, id, name: value.name.trim(), players, setup, currentRound } as CategoryBombSessionRecord
}

function jsonStorage(storage: StateStorage) {
  return {
    getItem: (name: string) => Promise.resolve(storage.getItem(name)).then((value) => value ? JSON.parse(value) : null),
    setItem: (name: string, value: unknown) => Promise.resolve(storage.setItem(name, JSON.stringify(value))),
    removeItem: (name: string) => Promise.resolve(storage.removeItem(name)),
  }
}

function addPlayerStats(current: CategoryBombPlayerStats, delta: CategoryBombPlayerStats): CategoryBombPlayerStats {
  return {
    bombsPlayed: current.bombsPlayed + delta.bombsPlayed,
    successfulAnswers: current.successfulAnswers + delta.successfulAnswers,
    explosions: current.explosions + delta.explosions,
    timerExplosions: current.timerExplosions + delta.timerExplosions,
    foulExplosions: current.foulExplosions + delta.foulExplosions,
    bestBomb: Math.max(current.bestBomb, delta.bestBomb),
  }
}

function withCurrentRound(state: CategoryBombStoreState, round: CategoryBombRound | null, now: number): Partial<CategoryBombStoreState> {
  if (!state.activeSessionId || !state.sessionsById[state.activeSessionId]) return { round }
  const session = state.sessionsById[state.activeSessionId]
  const delta = round ? calculateCategoryBombRoundStats(round) : null
  if (!round || !delta) {
    return {
      round,
      sessionsById: { ...state.sessionsById, [session.id]: { ...session, currentRound: round } },
    }
  }
  const completedRound = { ...round, statsRecorded: true }
  const statsByPlayerId = Object.fromEntries(session.players.map((player) => [
    player.id,
    addPlayerStats(session.statsByPlayerId[player.id] ?? emptyCategoryBombPlayerStats(), delta.playerDeltas[player.id]),
  ]))
  const category = session.categoryStatsById[delta.categoryId] ?? { bombsPlayed: 0, explosions: 0 }
  return {
    round: completedRound,
    sessionsById: {
      ...state.sessionsById,
      [session.id]: {
        ...session,
        updatedAt: new Date(now).toISOString(),
        completedBombs: session.completedBombs + delta.completedBombs,
        totalSuccessfulAnswers: session.totalSuccessfulAnswers + delta.totalSuccessfulAnswers,
        longestBomb: Math.max(session.longestBomb, delta.longestBomb),
        timerExplosions: session.timerExplosions + delta.timerExplosions,
        foulExplosions: session.foulExplosions + delta.foulExplosions,
        statsByPlayerId,
        categoryStatsById: {
          ...session.categoryStatsById,
          [delta.categoryId]: { bombsPlayed: category.bombsPlayed + 1, explosions: category.explosions + 1 },
        },
        currentRound: completedRound,
      },
    },
  }
}

export function createCategoryBombStore(
  storageName = 'moldyparty-category-bomb',
  random: () => number = Math.random,
  storage: StateStorage = localStorage,
  clock: () => number = Date.now,
  prompts: CategoryBombPrompt[] = categoryBombPrompts,
  idFactory: () => string = () => globalThis.crypto?.randomUUID?.() ?? `category-session-${clock()}-${Math.floor(random() * 1_000_000)}`,
) {
  return createStore<CategoryBombStoreState>()(persist((set, get) => ({
    round: null,
    sessionsById: {},
    activeSessionId: null,
    pendingSessionName: null,
    createSession: (name) => set({ pendingSessionName: name.trim() || 'New Session', activeSessionId: null, round: null }),
    continueSession: (sessionId) => set((state) => {
      const session = state.sessionsById[sessionId]
      return session ? { activeSessionId: sessionId, pendingSessionName: null, round: session.currentRound } : state
    }),
    renameSession: (sessionId, name) => set((state) => {
      const session = state.sessionsById[sessionId]
      const trimmed = name.trim()
      if (!session || !trimmed) return state
      return { sessionsById: { ...state.sessionsById, [sessionId]: { ...session, name: trimmed, updatedAt: new Date(clock()).toISOString() } } }
    }),
    deleteSession: (sessionId) => set((state) => {
      if (!state.sessionsById[sessionId]) return state
      const sessionsById = { ...state.sessionsById }
      delete sessionsById[sessionId]
      const active = state.activeSessionId === sessionId
      return { sessionsById, activeSessionId: active ? null : state.activeSessionId, round: active ? null : state.round }
    }),
    abortRound: () => set((state) => ({ ...withCurrentRound(state, null, clock()), activeSessionId: null })),
    editSetup: () => set((state) => withCurrentRound(state, null, clock())),
    startSetup: (playerNames, turnPolicy, passTimeBonus = DEFAULT_CATEGORY_BOMB_PASS_TIME_BONUS) => set((state) => {
      const existing = state.activeSessionId ? state.sessionsById[state.activeSessionId] : null
      const sessionId = existing?.id ?? idFactory()
      const players = existing?.players ?? playerNames.map((name, index) => ({ id: `category-player-${index + 1}`, name: name.trim() }))
      const setup: CategoryBombSessionSetup = {
        turnPolicy,
        passTimeBonusEnabled: passTimeBonus.enabled,
        passTimeBonusMinMs: passTimeBonus.minMs,
        passTimeBonusMaxMs: passTimeBonus.maxMs,
      }
      const round = createCategoryBombRound({ ...setup, players: players.map((player) => ({ ...player, seat: null })) }, prompts, random)
      const timestamp = new Date(clock()).toISOString()
      const session: CategoryBombSessionRecord = existing ? {
        ...existing, setup, currentRound: round, updatedAt: timestamp,
      } : {
        id: sessionId,
        name: state.pendingSessionName ?? `Session ${Object.keys(state.sessionsById).length + 1}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedBombs: 0,
        totalSuccessfulAnswers: 0,
        longestBomb: 0,
        timerExplosions: 0,
        foulExplosions: 0,
        players,
        setup,
        statsByPlayerId: Object.fromEntries(players.map((player) => [player.id, emptyCategoryBombPlayerStats()])),
        categoryStatsById: {},
        currentRound: round,
      }
      return { round, sessionsById: { ...state.sessionsById, [sessionId]: session }, activeSessionId: sessionId, pendingSessionName: null }
    }),
    swapSeats: (firstPlayerId, secondPlayerId) => set((state) => withCurrentRound(state, state.round ? swapCategoryBombSeats(state.round, firstPlayerId, secondPlayerId) : null, clock())),
    arm: (now = clock()) => set((state) => withCurrentRound(state, state.round ? armCategoryBombRound(state.round, random, now) : null, now)),
    acceptAnswer: (actionToken, now = clock()) => set((state) => withCurrentRound(state, state.round ? acceptCategoryBombAnswer(state.round, actionToken, now, random) : null, now)),
    callFoul: (actionToken, now = clock()) => set((state) => withCurrentRound(state, state.round ? callCategoryBombFoul(state.round, actionToken, now) : null, now)),
    syncClock: (now = clock()) => {
      const state = get()
      if (!state.round) return
      const next = syncCategoryBombClock(state.round, now)
      if (next !== state.round) set(withCurrentRound(state, next, now))
    },
    replay: (now = clock()) => set((state) => withCurrentRound(state, state.round ? replayCategoryBombRound(state.round, prompts, random, now) : null, now)),
    returnToPreRound: () => set((state) => {
      if (!state.round) return state
      const round: CategoryBombRound = {
        ...state.round,
        phase: state.round.displayMode === 'radial' ? 'PLACEMENT' : 'READY',
        currentPlayerId: null,
        remainingCyclePlayerIds: [],
        deadlineMs: null,
        extensionGrantedMs: 0,
        lastAppliedPassBonusMs: 0,
        actionToken: state.round.actionToken + 1,
        explodedPlayerId: null,
        explosionReason: null,
        startedAtMs: null,
        acceptedAnswerPlayerIds: [],
        statsRecorded: false,
      }
      return withCurrentRound(state, round, clock())
    }),
    reset: () => set((state) => ({ ...withCurrentRound(state, null, clock()), activeSessionId: null })),
    recover: (now = clock()) => {
      const state = get()
      if (state.round) set(withCurrentRound(state, syncCategoryBombClock(state.round, now), now))
    },
  }), {
    name: storageName,
    version: 2,
    storage: jsonStorage(storage),
    migrate: (persisted) => persisted,
    partialize: (state) => ({
      sessionsById: state.sessionsById,
      activeSessionId: state.activeSessionId,
      pendingSessionName: state.pendingSessionName,
      round: state.round,
    }),
    merge: (persisted, current) => {
      const saved = isRecord(persisted) ? persisted : {}
      const sessionsById = isRecord(saved.sessionsById)
        ? Object.fromEntries(Object.entries(saved.sessionsById).flatMap(([id, value]) => {
            const session = normalizeSession(id, value)
            return session ? [[id, session]] : []
          }))
        : {}
      let activeSessionId = typeof saved.activeSessionId === 'string' && sessionsById[saved.activeSessionId] ? saved.activeSessionId : null
      if (activeSessionId && 'round' in saved) {
        const candidate = saved.round === null ? null : migrateLegacyRound(saved.round)
        const record = sessionsById[activeSessionId]
        const currentRound = candidate !== null && isRecoverableRound(candidate) && roundMatchesRoster(candidate, record.players)
          ? { ...candidate, lastAppliedPassBonusMs: 0 }
          : null
        sessionsById[activeSessionId] = { ...sessionsById[activeSessionId], currentRound }
      }
      if (Object.keys(sessionsById).length === 0) {
        const candidate = migrateLegacyRound(saved.round)
        if (isRecoverableRound(candidate)) {
          const recoveredRound = { ...candidate, lastAppliedPassBonusMs: 0 }
          const sessionId = idFactory()
          const timestamp = new Date(clock()).toISOString()
          const players = candidate.settings.players.map((player) => ({ id: player.id, name: player.name }))
          sessionsById[sessionId] = {
            id: sessionId,
            name: 'Recovered Category Bomb',
            createdAt: timestamp,
            updatedAt: timestamp,
            completedBombs: 0,
            totalSuccessfulAnswers: 0,
            longestBomb: 0,
            timerExplosions: 0,
            foulExplosions: 0,
            players,
            setup: {
              turnPolicy: candidate.settings.turnPolicy,
              passTimeBonusEnabled: candidate.settings.passTimeBonusEnabled,
              passTimeBonusMinMs: candidate.settings.passTimeBonusMinMs,
              passTimeBonusMaxMs: candidate.settings.passTimeBonusMaxMs,
            },
            statsByPlayerId: Object.fromEntries(players.map((player) => [player.id, emptyCategoryBombPlayerStats()])),
            categoryStatsById: {},
            currentRound: recoveredRound,
          }
          activeSessionId = sessionId
        }
      }
      const activeSession = activeSessionId ? sessionsById[activeSessionId] : null
      return {
        ...current,
        sessionsById,
        activeSessionId,
        pendingSessionName: typeof saved.pendingSessionName === 'string' ? saved.pendingSessionName : null,
        round: activeSession?.currentRound ?? null,
      }
    },
    onRehydrateStorage: () => (state) => state?.recover(clock()),
  }))
}

export const categoryBombStore = createCategoryBombStore()

export function useCategoryBombStore<T>(selector: (state: CategoryBombStoreState) => T): T {
  return useStore(categoryBombStore, selector)
}
