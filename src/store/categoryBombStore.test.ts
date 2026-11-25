import { beforeEach, describe, expect, it } from 'vitest'
import { createCategoryBombStore } from './categoryBombStore'

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Player ${index + 1}`)
}

describe('Category Bomb store', () => {
  beforeEach(() => localStorage.clear())

  it('creates a named session and commits an exploded bomb exactly once', () => {
    const store = createCategoryBombStore('category-bomb-sessions', () => 0, localStorage, () => 1_000, undefined, () => 'session-1')
    store.getState().createSession('Friday Crew')
    store.getState().startSetup(['Alex', 'Blair', 'Casey'], 'fair-cycle')
    store.getState().arm(1_000)
    const firstHolder = store.getState().round!.currentPlayerId!
    store.getState().acceptAnswer(store.getState().round!.actionToken, 1_100)
    const exploded = store.getState().round!.currentPlayerId!
    store.getState().callFoul(store.getState().round!.actionToken, 1_200)
    store.getState().syncClock(2_000)

    const session = store.getState().sessionsById['session-1']
    expect(session.completedBombs).toBe(1)
    expect(session.statsByPlayerId[firstHolder].successfulAnswers).toBe(1)
    expect(session.statsByPlayerId[exploded].foulExplosions).toBe(1)
  })

  it('routes setup, seat swaps, arm, answer, foul, replay, and reset through the domain', () => {
    const store = createCategoryBombStore('category-bomb-commands', () => 0, localStorage, () => 1_000)
    store.getState().startSetup(names(4), 'fair-cycle')
    const before = store.getState().round!
    const [first, second] = before.settings.players
    store.getState().swapSeats(first.id, second.id)
    expect(store.getState().round?.settings.players[0].seat).toBe(second.seat)

    store.getState().arm(1_000)
    const armed = store.getState().round!
    store.getState().acceptAnswer(armed.actionToken, 1_100)
    expect(store.getState().round?.actionToken).toBe(armed.actionToken + 1)
    store.getState().callFoul(store.getState().round!.actionToken, 1_200)
    expect(store.getState().round?.explosionReason).toBe('foul')
    store.getState().replay(2_000)
    expect(store.getState().round?.phase).toBe('ACTIVE')
    store.getState().returnToPreRound()
    expect(store.getState().round?.phase).toBe('PLACEMENT')
    store.getState().reset()
    expect(store.getState().round).toBeNull()
  })

  it('defaults the pass-time bonus off and retains an explicitly enabled range', () => {
    const store = createCategoryBombStore('category-bomb-bonus-settings', () => 0, localStorage, () => 1_000)
    store.getState().startSetup(names(3), 'fair-cycle')
    expect(store.getState().round?.settings).toMatchObject({
      passTimeBonusEnabled: false,
      passTimeBonusMinMs: 500,
      passTimeBonusMaxMs: 3_000,
    })

    store.getState().startSetup(names(3), 'chaos', {
      enabled: true,
      minMs: 1_200,
      maxMs: 2_400,
    })
    expect(store.getState().round?.settings).toMatchObject({
      passTimeBonusEnabled: true,
      passTimeBonusMinMs: 1_200,
      passTimeBonusMaxMs: 2_400,
    })
  })

  it('uses ready mode and null seats for thirteen or more players', () => {
    const store = createCategoryBombStore('category-bomb-large', () => 0, localStorage, () => 1_000)
    store.getState().startSetup(names(13), 'chaos')
    expect(store.getState().round).toMatchObject({ phase: 'READY', displayMode: 'name-only' })
    expect(store.getState().round?.settings.players.every((player) => player.seat === null)).toBe(true)
    store.getState().arm(1_000)
    store.getState().returnToPreRound()
    expect(store.getState().round?.phase).toBe('READY')
  })

  it('reconciles the same current player as exploded when hydration occurs after the deadline', async () => {
    let now = 1_000
    const source = createCategoryBombStore('category-bomb-recovery', () => 0, localStorage, () => now)
    source.getState().startSetup(names(3), 'fair-cycle')
    source.getState().arm(now)
    const currentPlayerId = source.getState().round?.currentPlayerId
    now = source.getState().round!.deadlineMs! + 1

    const restored = createCategoryBombStore('category-bomb-recovery', () => 0, localStorage, () => now)
    await restored.persist.rehydrate()
    expect(restored.getState().round).toMatchObject({
      phase: 'EXPLODED',
      explodedPlayerId: currentPlayerId,
      explosionReason: 'timer',
    })
  })

  it('drops malformed Category Bomb state without touching other storage', async () => {
    localStorage.setItem('unrelated', 'keep')
    localStorage.setItem('category-bomb-corrupt', JSON.stringify({ state: { round: { phase: 'ACTIVE' } }, version: 1 }))
    const restored = createCategoryBombStore('category-bomb-corrupt', () => 0, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(restored.getState().round).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })

  it('drops a persisted round with an invalid retained pass-time bonus range', async () => {
    const source = createCategoryBombStore('category-bomb-invalid-bonus', () => 0, localStorage, () => 1_000)
    source.getState().startSetup(names(3), 'fair-cycle')
    const saved = JSON.parse(localStorage.getItem('category-bomb-invalid-bonus')!)
    saved.state.round.settings.passTimeBonusMinMs = 3_000
    saved.state.round.settings.passTimeBonusMaxMs = 500
    localStorage.setItem('category-bomb-invalid-bonus', JSON.stringify(saved))

    const restored = createCategoryBombStore('category-bomb-invalid-bonus', () => 0, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(restored.getState().round).toBeNull()
  })

  it('drops one saved session with invalid setup without deleting valid sessions', async () => {
    const ids = ['valid-session', 'broken-session']
    const source = createCategoryBombStore('category-bomb-session-validation', () => 0, localStorage, () => 1_000, undefined, () => ids.shift()!)
    source.getState().createSession('Valid')
    source.getState().startSetup(['Alex', 'Blair'], 'fair-cycle')
    source.getState().createSession('Broken')
    source.getState().startSetup(['Casey', 'Devon'], 'chaos')
    const saved = JSON.parse(localStorage.getItem('category-bomb-session-validation')!)
    saved.state.sessionsById['broken-session'].setup.turnPolicy = 'alien'
    saved.state.sessionsById['broken-session'].currentRound = null
    saved.state.activeSessionId = null
    saved.state.round = null
    localStorage.setItem('category-bomb-session-validation', JSON.stringify(saved))

    const restored = createCategoryBombStore('category-bomb-session-validation', () => 0, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(Object.keys(restored.getState().sessionsById)).toEqual(['valid-session'])
  })

  it('clears a corrupt active round while preserving its saved roster and statistics', async () => {
    const storageName = 'category-bomb-corrupt-active-only'
    const source = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000, undefined, () => 'saved-session')
    source.getState().createSession('Bomb Crew')
    source.getState().startSetup(names(3), 'fair-cycle')
    const saved = JSON.parse(localStorage.getItem(storageName)!)
    saved.state.round.phase = 'ALIEN'
    saved.state.sessionsById['saved-session'].currentRound.phase = 'ALIEN'
    localStorage.setItem(storageName, JSON.stringify(saved))

    const restored = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000)
    await restored.persist.rehydrate()

    expect(restored.getState().sessionsById['saved-session']).toMatchObject({ name: 'Bomb Crew', currentRound: null })
    expect(restored.getState().sessionsById['saved-session'].players).toHaveLength(3)
    expect(restored.getState().round).toBeNull()
  })

  it('rejects a self-valid top-level round whose roster differs from its saved session', async () => {
    const storageName = 'category-bomb-mismatched-active-roster'
    const source = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000, undefined, () => 'saved-session')
    source.getState().createSession('Bomb Crew')
    source.getState().startSetup(names(3), 'fair-cycle')
    const saved = JSON.parse(localStorage.getItem(storageName)!)
    saved.state.round.settings.players[0].name = 'Intruder'
    localStorage.setItem(storageName, JSON.stringify(saved))

    const restored = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(restored.getState().sessionsById['saved-session']).toMatchObject({ name: 'Bomb Crew', currentRound: null })
    expect(restored.getState().sessionsById['saved-session'].players[0].name).toBe('Player 1')
  })

  it('clears the prior pass bonus feedback when hydrating an active round', async () => {
    const source = createCategoryBombStore('category-bomb-feedback-reset', () => 0, localStorage, () => 1_000)
    source.getState().startSetup(names(3), 'fair-cycle', { enabled: true, minMs: 500, maxMs: 500 })
    source.getState().arm(1_000)
    source.getState().acceptAnswer(source.getState().round!.actionToken, 1_100)
    expect(source.getState().round?.lastAppliedPassBonusMs).toBe(500)

    const restored = createCategoryBombStore('category-bomb-feedback-reset', () => 0, localStorage, () => 1_200)
    await restored.persist.rehydrate()
    expect(restored.getState().round?.lastAppliedPassBonusMs).toBe(0)
  })

  it('migrates a complete legacy active round to the former fixed pass bonus', async () => {
    const storageName = 'category-bomb-legacy-round'
    const source = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000)
    source.getState().startSetup(names(3), 'fair-cycle', { enabled: true, minMs: 1_500, maxMs: 1_500 })
    source.getState().arm(1_000)
    source.getState().acceptAnswer(source.getState().round!.actionToken, 1_100)
    const before = source.getState().round!
    const saved = JSON.parse(localStorage.getItem(storageName)!)
    delete saved.state.round.settings.passTimeBonusEnabled
    delete saved.state.round.settings.passTimeBonusMinMs
    delete saved.state.round.settings.passTimeBonusMaxMs
    delete saved.state.round.lastAppliedPassBonusMs
    localStorage.setItem(storageName, JSON.stringify(saved))

    const restored = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_200)
    await restored.persist.rehydrate()
    expect(restored.getState().round).toMatchObject({
      currentPlayerId: before.currentPlayerId,
      deadlineMs: before.deadlineMs,
      extensionGrantedMs: 1_500,
      lastAppliedPassBonusMs: 0,
      settings: {
        passTimeBonusEnabled: true,
        passTimeBonusMinMs: 1_500,
        passTimeBonusMaxMs: 1_500,
      },
    })
  })

  it('recovers a legacy exploded round without inventing retroactive statistics', async () => {
    const storageName = 'category-bomb-legacy-exploded'
    const source = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000)
    source.getState().startSetup(names(3), 'fair-cycle')
    source.getState().arm(1_000)
    source.getState().callFoul(source.getState().round!.actionToken, 1_100)
    const legacyRound = structuredClone(source.getState().round!) as unknown as Record<string, unknown>
    delete legacyRound.startedAtMs
    delete legacyRound.acceptedAnswerPlayerIds
    delete legacyRound.statsRecorded
    localStorage.setItem(storageName, JSON.stringify({ state: { round: legacyRound }, version: 1 }))

    const restored = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_200, undefined, () => 'recovered')
    await restored.persist.rehydrate()

    expect(restored.getState().sessionsById.recovered).toMatchObject({
      name: 'Recovered Category Bomb',
      completedBombs: 0,
      totalSuccessfulAnswers: 0,
      currentRound: { phase: 'EXPLODED', statsRecorded: true },
    })
  })

  it('drops a persisted round whose cumulative extension is off the 0.1-second grid', async () => {
    const storageName = 'category-bomb-invalid-extension-grid'
    const source = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000)
    source.getState().startSetup(names(3), 'fair-cycle')
    const saved = JSON.parse(localStorage.getItem(storageName)!)
    saved.state.round.extensionGrantedMs = 14_950
    localStorage.setItem(storageName, JSON.stringify(saved))

    const restored = createCategoryBombStore(storageName, () => 0, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(restored.getState().round).toBeNull()
  })

  it('drops an active snapshot whose fair-cycle queue contains an unknown player', async () => {
    const source = createCategoryBombStore('category-bomb-invalid-queue', () => 0, localStorage, () => 1_000)
    source.getState().startSetup(names(3), 'fair-cycle')
    source.getState().arm(1_000)
    const saved = JSON.parse(localStorage.getItem('category-bomb-invalid-queue')!)
    saved.state.round.remainingCyclePlayerIds = ['missing-player']
    localStorage.setItem('category-bomb-invalid-queue', JSON.stringify(saved))

    const restored = createCategoryBombStore('category-bomb-invalid-queue', () => 0, localStorage, () => 1_000)
    await restored.persist.rehydrate()
    expect(restored.getState().round).toBeNull()
  })
})
