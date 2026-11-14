import { describe, expect, it } from 'vitest'
import { buildAiPackPrompt } from './aiPrompt'

describe('buildAiPackPrompt', () => {
  it('keeps the existing Impostor prompt as the default', () => {
    const prompt = buildAiPackPrompt('Space')

    expect(prompt).toContain('MoldyParty Impostor word pack about Space')
    expect(prompt).toContain('Generate 25 unique items.')
    expect(prompt).toContain('exactly 5 different hints')
  })

  it('builds a 50-item tagged Charades prompt without requiring hints', () => {
    const prompt = buildAiPackPrompt('Pinoy Party', { game: 'charades', mode: 'classic' })

    expect(prompt).toContain('MoldyParty Forehead Charades word pack about Pinoy Party')
    expect(prompt).toContain('Generate exactly 50 unique items.')
    expect(prompt).toContain('"category": "food"')
    expect(prompt).toContain('"vibes": ["casual", "pop-culture-local"]')
    expect(prompt).not.toContain('exactly 5 different hints')
  })

  it('asks Henyo generation for concrete category-anchored nouns', () => {
    const prompt = buildAiPackPrompt('Philippines', { game: 'charades', mode: 'henyo' })

    expect(prompt).toContain('concrete nouns suitable for Pinoy Henyo')
    expect(prompt).toContain('person, place, object, animal, food, pop-culture, other')
  })
})
