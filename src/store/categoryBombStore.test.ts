import { beforeEach, describe, expect, it } from 'vitest'
import { createCategoryBombStore } from './categoryBombStore'

function names(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Player ${index + 1}`)
}

describe('Category Bomb store', () => {
  beforeEach(() => localStorage.clear())

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
