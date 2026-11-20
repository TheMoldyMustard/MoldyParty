import { describe, expect, expectTypeOf, it } from 'vitest'
import type { AppGameId, PackGameId, WordPack } from './types'
import { eligibleItems, getItemCategory, isPackUsableFor } from './packCompatibility'

const mixedPack = {
  id: 'mixed',
  packName: 'Mixed',
  category: 'Custom',
  source: 'custom',
  items: [
    { word: 'Adobo', hint: 'Ulam', category: 'food', vibes: ['casual', 'pop-culture-local'] },
    { word: 'Intramuros', hints: ['Walls'], category: 'place', vibes: ['pop-culture-local'] },
    { word: 'Balut', category: 'food', vibes: ['chaos-hard'] },
    { word: 'Jeepney', hint: 'Transport', charadesOnly: true, category: 'object', vibes: ['pop-culture-local'] },
  ],
} as WordPack

describe('pack compatibility', () => {
  it('keeps app routing ids separate from pack consumer ids', () => {
    expectTypeOf<Parameters<typeof eligibleItems>[1]>().toEqualTypeOf<PackGameId>()
    expectTypeOf<'category-bomb'>().toMatchTypeOf<AppGameId>()
    expectTypeOf<'category-bomb'>().not.toMatchTypeOf<PackGameId>()
  })

  it('keeps only hinted non-charades-only items eligible for Impostor', () => {
    expect(eligibleItems(mixedPack, 'impostor').map((item) => item.word)).toEqual(['Adobo', 'Intramuros'])
  })

  it('filters Charades items by category and vibe without excluding word-only items', () => {
    expect(eligibleItems(mixedPack, 'charades', {
      categories: ['food'],
      vibes: ['chaos-hard'],
    }).map((item) => item.word)).toEqual(['Balut'])
  })

  it('requires two eligible cards before a pack can start Charades', () => {
    expect(isPackUsableFor(mixedPack, 'charades', { categories: ['food'], vibes: ['chaos-hard'] })).toBe(false)
    expect(isPackUsableFor(mixedPack, 'charades', { categories: ['food'], vibes: [] })).toBe(true)
  })

  it('derives known legacy pack categories and otherwise uses other', () => {
    expect(getItemCategory({ word: 'Cat', hint: 'Pet' }, 'Animals')).toBe('animal')
    expect(getItemCategory({ word: 'Mystery', hint: 'Unknown' }, 'Custom')).toBe('other')
  })
})
