import { describe, expect, it } from 'vitest'
import { parseManualHints } from './manualHints'

describe('parseManualHints', () => {
  it('accepts plain comma-separated values', () => {
    expect(parseManualHints('Creation, Journey, Night')).toEqual(['Creation', 'Journey', 'Night'])
  })

  it.each([
    ['(Creation, Journey)', ['Creation', 'Journey']],
    ['[Creation, Journey]', ['Creation', 'Journey']],
    ['("Creation", "Journey")', ['Creation', 'Journey']],
  ])('accepts wrapped tuple and list syntax', (input, expected) => {
    expect(parseManualHints(input)).toEqual(expected)
  })

  it('keeps a single hint containing spaces as one value', () => {
    expect(parseManualHints('Pop star')).toEqual(['Pop star'])
  })
})
