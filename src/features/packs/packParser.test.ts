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

  it('parses five one-word hints while retaining a legacy primary hint', () => {
    const hints = ['Orbit', 'Night', 'Tide', 'Silver', 'Distant']
    const result = parseWordPackJson(JSON.stringify({
      packName: 'Space',
      category: 'Custom',
      items: [{ word: 'Moon', hints }],
    }))

    expect(result).toEqual({
      ok: true,
      pack: expect.objectContaining({
        items: [{ word: 'Moon', hint: 'Orbit', hints }],
      }),
    })
  })

  it('parses and preserves mixed Charades metadata without inventing hints', () => {
    const result = parseWordPackJson(JSON.stringify({
      packName: 'Pinoy Party',
      category: 'Mixed',
      items: [
        { word: 'Adobo', hint: 'Ulam', category: 'food', vibes: ['casual', 'pop-culture-local'] },
        { word: 'Balut', charadesOnly: true, category: 'food', vibes: ['chaos-hard'] },
      ],
    }))

    expect(result).toEqual({
      ok: true,
      pack: expect.objectContaining({
        items: [
          { word: 'Adobo', hint: 'Ulam', category: 'food', vibes: ['casual', 'pop-culture-local'] },
          { word: 'Balut', charadesOnly: true, category: 'food', vibes: ['chaos-hard'] },
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
    [JSON.stringify({ packName: 'No Hints', category: 'Custom', items: [
      { word: 'Moon', hints: [] },
    ] }), 'Each hints array needs at least 1 hint.'],
    [JSON.stringify({ packName: 'Bad Category', items: [
      { word: 'Moon', category: 'planet' },
    ] }), 'Item 1 has an unknown Charades category.'],
    [JSON.stringify({ packName: 'Bad Vibe', items: [
      { word: 'Moon', vibes: ['impossible'] },
    ] }), 'Item 1 has an unknown Charades vibe.'],
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

  it('exports all five hints when a word has a hint pool', () => {
    const hints = ['Orbit', 'Night', 'Tide', 'Silver', 'Distant']
    const result = JSON.parse(serializeWordPack({
      id: 'local-id',
      packName: 'Space',
      category: 'Custom',
      source: 'custom',
      items: [{ word: 'Moon', hint: hints[0], hints }],
    }))

    expect(result.items).toEqual([{ word: 'Moon', hints }])
  })

  it('exports optional Charades metadata and omits an absent hint', () => {
    const result = JSON.parse(serializeWordPack({
      id: 'local-id',
      packName: 'Pinoy Party',
      category: 'Mixed',
      source: 'custom',
      items: [{
        word: 'Balut',
        charadesOnly: true,
        category: 'food',
        vibes: ['chaos-hard'],
      }],
    }))

    expect(result.items).toEqual([{
      word: 'Balut',
      charadesOnly: true,
      category: 'food',
      vibes: ['chaos-hard'],
    }])
  })
})
