import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordItem } from '../domain/types'
import { advanceFromSummary, beginTurn, createCharadesSession, getCurrentHolder, syncClock, type CharadesSession, type CharadesSettings } from '../domain/charades'
import { createCharadesStore } from './charadesStore'

const settings: CharadesSettings = {
  mode: 'classic',
  packId: 'pack-1',
  packName: 'Pinoy Party',
  durationSeconds: 60,
  categories: [],
  vibes: [],
  motionEnabled: false,
  henyoTapAnswersEnabled: false,
  noRepeatEnabled: true,
}

const items: WordItem[] = [
  { word: 'Adobo', category: 'food' },
  { word: 'Jeepney', category: 'object' },
  { word: 'Intramuros', category: 'place' },
]

describe('Charades store', () => {
  beforeEach(() => localStorage.clear())

  it('creates a named session and commits a completed holder turn exactly once', () => {
    const store = createCharadesStore('charades-sessions', () => 0.99, localStorage, () => 1_000, undefined, () => 'session-1')
    const state = store.getState() as unknown as {
      createSession?: (name: string) => void
      sessionsById?: Record<string, { completedTurns: number; statsByPlayerId: Record<string, { correct: number; turnsPlayed: number }> }>
    }
    expect(state.createSession).toBeTypeOf('function')
    state.createSession?.('Friday Crew')
    store.getState().startSession({
      ...settings,
      players: [{ id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' }],
    }, items)
    store.getState().beginTurn(1_000)
    store.getState().submitOutcome('correct', store.getState().session!.currentCardToken, 2_000)
    store.getState().syncClock(61_000)
    store.getState().syncClock(62_000)

    const session = (store.getState() as unknown as typeof state).sessionsById?.['session-1']
    expect(session?.completedTurns).toBe(1)
    expect(session?.statsByPlayerId.alex).toMatchObject({ correct: 1, turnsPlayed: 1 })
  })

  it('routes semantic outcomes through the domain and records no-repeat history once', () => {
    const history = {
      getUsed: vi.fn().mockReturnValue([]),
      markUsed: vi.fn(),
      clear: vi.fn(),
    }
    const store = createCharadesStore('charades-command-test', () => 0.99, localStorage, () => 2_000, history)

    store.getState().startSession(settings, items)
    store.getState().beginTurn(1_000)
    const token = store.getState().session!.currentCardToken
    const word = store.getState().session!.currentCard!.word
    store.getState().submitOutcome('correct', token, 2_000)
    store.getState().submitOutcome('pass', token, 2_100)

    expect(store.getState().session?.currentEvents).toHaveLength(1)
    expect(history.markUsed).toHaveBeenCalledTimes(1)
    expect(history.markUsed).toHaveBeenCalledWith('pack-1', word)
  })

  it('reconciles an expired absolute deadline during hydration', async () => {
    let now = 1_000
    const source = createCharadesStore('charades-recovery-test', () => 0.99, localStorage, () => now)
    source.getState().startSession(settings, items)
    source.getState().beginTurn(now)

    now = 62_000
    const restored = createCharadesStore('charades-recovery-test', () => 0.99, localStorage, () => now)
    await restored.persist.rehydrate()

    expect(restored.getState().session?.phase).toBe('ROUND_SUMMARY')
    expect(restored.getState().session?.turnSummaries).toHaveLength(1)
  })

  it('drops corrupt persisted Charades state without touching other storage', async () => {
    localStorage.setItem('charades-corrupt-test', JSON.stringify({
      state: { session: { phase: 'ALIEN_MODE' } },
      version: 1,
    }))
    localStorage.setItem('moldyparty-game', 'leave-me-alone')

    const restored = createCharadesStore('charades-corrupt-test', () => 0.5, localStorage, () => 1_000)
    await restored.persist.rehydrate()

    expect(restored.getState().session).toBeNull()
    expect(localStorage.getItem('moldyparty-game')).toBe('leave-me-alone')
  })

  it('clears a corrupt active game while preserving its saved roster and statistics', async () => {
    const storageName = 'charades-corrupt-active-only'
    const source = createCharadesStore(storageName, () => 0.99, localStorage, () => 1_000, undefined, () => 'saved-session')
    source.getState().createSession('Guess Crew')
    source.getState().startSession({ ...settings, players: [{ id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' }] }, items)
    const saved = JSON.parse(localStorage.getItem(storageName)!)
    saved.state.session.phase = 'ALIEN'
    saved.state.sessionsById['saved-session'].currentGame.phase = 'ALIEN'
    localStorage.setItem(storageName, JSON.stringify(saved))

    const restored = createCharadesStore(storageName, () => 0.99, localStorage, () => 1_000)
    await restored.persist.rehydrate()

    expect(restored.getState().sessionsById['saved-session']).toMatchObject({ name: 'Guess Crew', currentGame: null })
    expect(restored.getState().sessionsById['saved-session'].players.map((player) => player.name)).toEqual(['Alex', 'Blair'])
    expect(restored.getState().session).toBeNull()
  })

  it('rejects a self-valid top-level game whose roster differs from its saved session', async () => {
    const storageName = 'charades-mismatched-active-roster'
    const source = createCharadesStore(storageName, () => 0.99, localStorage, () => 1_000, undefined, () => 'saved-session')
    source.getState().createSession('Guess Crew')
    source.getState().startSession({ ...settings, players: [{ id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' }] }, items)
    const saved = JSON.parse(localStorage.getItem(storageName)!)
    saved.state.session.settings.players[0].name = 'Intruder'
    localStorage.setItem(storageName, JSON.stringify(saved))

    const restored = createCharadesStore(storageName, () => 0.99, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(restored.getState().sessionsById['saved-session']).toMatchObject({ name: 'Guess Crew', currentGame: null })
    expect(restored.getState().sessionsById['saved-session'].players[0].name).toBe('Alex')
  })

  it.each(['setup roster', 'tracking flag'] as const)('drops a saved record whose %s contradicts its stable roster', async (corruption) => {
    const storageName = `charades-invalid-record-${corruption.replace(' ', '-')}`
    const source = createCharadesStore(storageName, () => 0.99, localStorage, () => 1_000, undefined, () => 'saved-session')
    source.getState().createSession('Guess Crew')
    source.getState().startSession({ ...settings, players: [{ id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' }] }, items)
    const saved = JSON.parse(localStorage.getItem(storageName)!)
    if (corruption === 'setup roster') saved.state.sessionsById['saved-session'].setup.players[0].name = 'Intruder'
    else saved.state.sessionsById['saved-session'].trackingEnabled = false
    saved.state.session = null
    saved.state.activeSessionId = null
    localStorage.setItem(storageName, JSON.stringify(saved))

    const restored = createCharadesStore(storageName, () => 0.99, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(restored.getState().sessionsById).toEqual({})
  })

  it('continues non-relay holder rotation across separate games in one saved session', () => {
    const store = createCharadesStore('charades-cross-game-rotation', () => 0.99, localStorage, () => 1_000, undefined, () => 'session-1')
    const trackedSettings = { ...settings, players: [{ id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' }] }
    store.getState().createSession('Guess Crew')
    store.getState().startSession(trackedSettings, items)
    store.getState().beginTurn(1_000)
    store.getState().syncClock(61_000)
    store.getState().resetSession()
    store.getState().continueSession('session-1')
    store.getState().startSession(trackedSettings, items)

    expect(getCurrentHolder(store.getState().session!)).toMatchObject({ playerId: 'blair', memberName: 'Blair' })
  })

  it.each(['GET_READY', 'ACTIVE', 'ROUND_SUMMARY'] as const)('recovers a legacy non-relay %s game with tracking disabled', async (phase) => {
    const storageName = `charades-legacy-${phase.toLowerCase()}`
    let legacy = createCharadesSession(settings, items, () => 0.99)
    if (phase !== 'GET_READY') legacy = beginTurn(legacy, 1_000, () => 0.99)
    if (phase === 'ROUND_SUMMARY') legacy = syncClock(legacy, 61_000)
    const raw = structuredClone(legacy) as unknown as Record<string, unknown>
    delete raw.startedAtMs
    delete raw.relayResultRecorded
    for (const summary of raw.turnSummaries as Array<Record<string, unknown>>) {
      delete summary.holderPlayerId
      delete summary.activeDurationMs
      delete summary.statsRecorded
    }
    localStorage.setItem(storageName, JSON.stringify({ state: { session: raw }, version: 1 }))

    const restored = createCharadesStore(storageName, () => 0.99, localStorage, () => phase === 'ACTIVE' ? 2_000 : 61_000, undefined, () => 'recovered')
    await restored.persist.rehydrate()

    expect(restored.getState().sessionsById.recovered).toMatchObject({
      name: 'Recovered Charades',
      players: [],
      trackingEnabled: false,
      completedTurns: 0,
      currentGame: { phase },
    })
  })

  it('derives stable relay player ids from a legacy completed game without retroactive results', async () => {
    const storageName = 'charades-legacy-relay-summary'
    const relaySettings: CharadesSettings = {
      ...settings,
      mode: 'team-relay',
      teams: [
        { id: 'team-1', name: 'Molds', members: ['Alex', 'Blair'] },
        { id: 'team-2', name: 'Spores', members: ['Casey', 'Devon'] },
      ],
      relayRounds: 3,
    }
    let legacy: CharadesSession = createCharadesSession(relaySettings, items, () => 0.99)
    for (let turn = 0; turn < 6; turn += 1) {
      legacy = beginTurn(legacy, turn * 100_000, () => 0.99)
      legacy = syncClock(legacy, turn * 100_000 + 60_000)
      legacy = advanceFromSummary(legacy)
    }
    const raw = structuredClone(legacy) as unknown as Record<string, unknown>
    delete raw.startedAtMs
    delete raw.relayResultRecorded
    for (const summary of raw.turnSummaries as Array<Record<string, unknown>>) {
      delete summary.holderPlayerId
      delete summary.activeDurationMs
      delete summary.statsRecorded
    }
    localStorage.setItem(storageName, JSON.stringify({ state: { session: raw }, version: 1 }))

    const restored = createCharadesStore(storageName, () => 0.99, localStorage, () => 700_000, undefined, () => 'relay-recovered')
    await restored.persist.rehydrate()
    const record = restored.getState().sessionsById['relay-recovered']

    expect(record.players.map((player) => player.name)).toEqual(['Alex', 'Blair', 'Casey', 'Devon'])
    expect(record.currentGame).toMatchObject({ phase: 'SESSION_SUMMARY', relayResultRecorded: true })
    expect(record.completedTurns).toBe(0)
    expect(record.completedRelayGames).toBe(0)
  })

  it('starts tracking after a recovered non-relay session receives its first stable roster', async () => {
    const storageName = 'charades-legacy-roster-upgrade'
    const legacy = createCharadesSession(settings, items, () => 0.99)
    const raw = structuredClone(legacy) as unknown as Record<string, unknown>
    delete raw.startedAtMs
    delete raw.relayResultRecorded
    localStorage.setItem(storageName, JSON.stringify({ state: { session: raw }, version: 1 }))
    const restored = createCharadesStore(storageName, () => 0.99, localStorage, () => 1_000, undefined, () => 'recovered')
    await restored.persist.rehydrate()
    restored.getState().resetSession()
    restored.getState().continueSession('recovered')
    restored.getState().startSession({
      ...settings,
      players: [{ id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' }],
    }, items)

    expect(restored.getState().sessionsById.recovered).toMatchObject({
      players: [{ id: 'alex', name: 'Alex' }, { id: 'blair', name: 'Blair' }],
      trackingEnabled: true,
    })
    expect(Object.keys(restored.getState().sessionsById.recovered.statsByPlayerId)).toEqual(['alex', 'blair'])
  })
})
