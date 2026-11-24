import { beforeEach, describe, expect, it } from 'vitest'
import { createAppStore, resolveActiveGame } from './appStore'

describe('app store', () => {
  beforeEach(() => localStorage.clear())

  it('persists the active game discriminator', async () => {
    const source = createAppStore('app-routing-test', localStorage)
    source.getState().setActiveGame('charades')

    const restored = createAppStore('app-routing-test', localStorage)
    await restored.persist.rehydrate()

    expect(restored.getState().activeGameId).toBe('charades')
  })

  it('infers a legacy active Impostor game but rejects stale explicit pointers', () => {
    expect(resolveActiveGame(null, true, false, false)).toBe('impostor')
    expect(resolveActiveGame('charades', true, false, false)).toBeNull()
    expect(resolveActiveGame('charades', false, true, false)).toBe('charades')
    expect(resolveActiveGame('category-bomb', false, false, true)).toBe('category-bomb')
    expect(resolveActiveGame(null, false, false, true)).toBe('category-bomb')
  })

  it('normalizes an unknown persisted active game id', async () => {
    localStorage.setItem('app-invalid-test', JSON.stringify({ state: { activeGameId: 'unknown' }, version: 2 }))
    const restored = createAppStore('app-invalid-test', localStorage)
    await restored.persist.rehydrate()
    expect(restored.getState().activeGameId).toBeNull()
  })

  it('migrates the compatible active-game discriminator from version one', async () => {
    localStorage.setItem('app-v1-test', JSON.stringify({ state: { activeGameId: 'charades' }, version: 1 }))
    const restored = createAppStore('app-v1-test', localStorage)
    await restored.persist.rehydrate()
    expect(restored.getState().activeGameId).toBe('charades')
  })
})
