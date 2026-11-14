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
    expect(resolveActiveGame(null, true, false)).toBe('impostor')
    expect(resolveActiveGame('charades', true, false)).toBeNull()
    expect(resolveActiveGame('charades', false, true)).toBe('charades')
  })
})
