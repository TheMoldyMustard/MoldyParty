import { beforeEach, describe, expect, it } from 'vitest'
import { createPreferencesStore } from './preferencesStore'

describe('preferences store', () => {
  beforeEach(() => localStorage.clear())

  it('hydrates version-one preferences with enabled feedback defaults', async () => {
    localStorage.setItem('preferences-migration-test', JSON.stringify({
      state: { defaultDiscussionSeconds: 240, installPromptDismissed: true },
      version: 1,
    }))

    const store = createPreferencesStore('preferences-migration-test', localStorage)
    await store.persist.rehydrate()

    expect(store.getState()).toMatchObject({
      defaultDiscussionSeconds: 240,
      installPromptDismissed: true,
      soundEnabled: true,
      hapticsEnabled: true,
    })
  })

  it('persists sound and haptics choices independently', () => {
    const store = createPreferencesStore('preferences-feedback-test', localStorage)
    store.getState().setSoundEnabled(false)
    store.getState().setHapticsEnabled(false)

    expect(store.getState()).toMatchObject({ soundEnabled: false, hapticsEnabled: false })
  })
})
