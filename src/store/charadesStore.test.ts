import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordItem } from '../domain/types'
import type { CharadesSettings } from '../domain/charades'
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
})
