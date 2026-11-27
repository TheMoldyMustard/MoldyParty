import { describe, expect, it } from 'vitest'
import {
  nextRouletteRotationDegrees,
  rouletteSectorCenterDegrees,
  selectRouletteIndex,
  validateRouletteNames,
} from './roulette'

describe('roulette names', () => {
  it('normalizes a valid roster without changing its order', () => {
    expect(validateRouletteNames(['  Alex ', 'Blair', ' Casey  '])).toEqual({
      names: ['Alex', 'Blair', 'Casey'],
      errors: [],
    })
  })

  it.each([
    { names: ['Alex'], error: 'Enter at least 2 names.' },
    { names: Array.from({ length: 51 }, (_, index) => `Player ${index + 1}`), error: 'Enter no more than 50 names.' },
    { names: ['Alex', '   '], error: 'Every name must be filled in.' },
    { names: ['Alex', ' alex '], error: 'Names must be unique.' },
    { names: ['A'.repeat(25), 'Blair'], error: 'Names must be 24 characters or fewer.' },
  ])('rejects an unusable roster: $error', ({ names, error }) => {
    const result = validateRouletteNames(names)

    expect(result.errors).toContain(error)
  })

  it('counts Unicode code points rather than UTF-16 units for the name limit', () => {
    expect(validateRouletteNames(['😀'.repeat(24), 'Blair']).errors).toEqual([])
    expect(validateRouletteNames(['😀'.repeat(25), 'Blair']).errors).toContain('Names must be 24 characters or fewer.')
  })

  it('does not describe multiple blank rows as duplicate names', () => {
    const result = validateRouletteNames(['', ''])

    expect(result.errors).toContain('Every name must be filled in.')
    expect(result.errors).not.toContain('Names must be unique.')
  })
})

describe('roulette selection', () => {
  it.each([
    { sample: 0, expected: 0 },
    { sample: 0.249999, expected: 0 },
    { sample: 0.25, expected: 1 },
    { sample: 0.749999, expected: 2 },
    { sample: 0.999999, expected: 3 },
  ])('maps sample $sample to index $expected', ({ sample, expected }) => {
    expect(selectRouletteIndex(4, () => sample)).toBe(expected)
  })

  it('defensively keeps out-of-range random samples inside the roster', () => {
    expect(selectRouletteIndex(4, () => -10)).toBe(0)
    expect(selectRouletteIndex(4, () => 10)).toBe(3)
    expect(selectRouletteIndex(4, () => Number.NaN)).toBe(0)
  })

  it('rejects a non-positive or non-integer roster size', () => {
    expect(() => selectRouletteIndex(0, () => 0)).toThrow('Roulette needs at least one name.')
    expect(() => selectRouletteIndex(2.5, () => 0)).toThrow('Roulette name count must be an integer.')
  })
})

describe('roulette geometry', () => {
  it('returns the center angle for every sector in clockwise order', () => {
    expect([0, 1, 2, 3].map((index) => rouletteSectorCenterDegrees(index, 4))).toEqual([45, 135, 225, 315])
  })

  it('rotates forward through complete turns until the selected center is at the top pointer', () => {
    expect(nextRouletteRotationDegrees(0, 0, 4, 3)).toBe(1395)
    expect(nextRouletteRotationDegrees(1395, 1, 4, 3)).toBe(2745)
  })

  it('rejects an invalid selected sector', () => {
    expect(() => rouletteSectorCenterDegrees(4, 4)).toThrow('Roulette sector index is out of range.')
  })
})
