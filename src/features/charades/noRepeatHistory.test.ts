import { describe, expect, it } from 'vitest'
import { createNoRepeatHistory } from './noRepeatHistory'

describe('no-repeat history', () => {
  it('persists normalized words per pack and can clear one pack', () => {
    const storage = new Map<string, string>()
    const history = createNoRepeatHistory({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value) },
      removeItem: (key) => { storage.delete(key) },
    })

    history.markUsed('pack-1', '  Adobo ')
    history.markUsed('pack-1', 'ADOBO')
    history.markUsed('pack-2', 'Jeepney')

    expect(history.getUsed('pack-1')).toEqual(['adobo'])
    history.clear('pack-1')
    expect(history.getUsed('pack-1')).toEqual([])
    expect(history.getUsed('pack-2')).toEqual(['jeepney'])
  })

  it('ignores corrupt storage and bounds each pack history', () => {
    const values = new Map([['moldyparty-charades-history', '{oops']])
    const history = createNoRepeatHistory({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
      removeItem: (key) => { values.delete(key) },
    }, 2)

    history.markUsed('pack-1', 'One')
    history.markUsed('pack-1', 'Two')
    history.markUsed('pack-1', 'Three')

    expect(history.getUsed('pack-1')).toEqual(['two', 'three'])
  })
})
