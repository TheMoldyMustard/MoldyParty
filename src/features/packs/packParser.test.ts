import { describe, expect, it } from 'vitest'
import { parseWordPackJson, serializeWordPack } from './packParser'

describe('parseWordPackJson', () => {
  it('parses and normalizes the canonical schema', () => {
    const result = parseWordPackJson(JSON.stringify({
      packName: '  Space Things  ',
      category: 'Custom',
      items: [{ word: '  Moon  ', hint: '  Orbit  ' }],
    }))

    expect(result).toEqual({
      ok: true,
      pack: expect.objectContaining({
        packName: 'Space Things',
        category: 'Custom',
        source: 'custom',
        items: [{ word: 'Moon', hint: 'Orbit' }],
      }),
    })
  })

  it('parses fallback words and parallel hints arrays', () => {
    const result = parseWordPackJson(JSON.stringify({
      words: ['Jett', 'Sage'],
      hints: ['Wind', 'Healing'],
    }))

    expect(result).toEqual({
      ok: true,
      pack: expect.objectContaining({
        packName: 'Imported Pack',
        items: [
          { word: 'Jett', hint: 'Wind' },
          { word: 'Sage', hint: 'Healing' },
        ],
      }),
    })
  })

  it.each([
    ['', 'Paste some JSON to continue.'],
    ['{oops', 'That is not valid JSON.'],
    [JSON.stringify({ packName: 'Empty', category: 'Custom', items: [] }), 'Add at least one word.'],
    [JSON.stringify({ words: ['A', 'B'], hints: ['Hint'] }), 'Words and hints must have the same length.'],
    [JSON.stringify({ packName: 'Dupes', category: 'Custom', items: [
      { word: 'Moon', hint: 'One' }, { word: ' moon ', hint: 'Two' },
    ] }), 'Words must be unique within a pack.'],
  ])('rejects invalid input with a useful message', (text, message) => {
    expect(parseWordPackJson(text)).toEqual({ ok: false, error: message })
  })
})

describe('serializeWordPack', () => {
  it('exports only the portable canonical shape', () => {
    const result = JSON.parse(serializeWordPack({
      id: 'local-id',
      packName: 'Space',
      category: 'Custom',
      source: 'custom',
      createdAt: '2026-11-02T00:00:00.000Z',
      items: [{ word: 'Moon', hint: 'Orbit' }],
    }))

    expect(result).toEqual({
      packName: 'Space',
      category: 'Custom',
      items: [{ word: 'Moon', hint: 'Orbit' }],
    })
  })
})
