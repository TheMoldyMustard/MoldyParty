export const MIN_ROULETTE_NAMES = 2
export const MAX_ROULETTE_NAMES = 50
export const MAX_ROULETTE_NAME_LENGTH = 24

export interface RouletteValidationResult {
  names: string[]
  errors: string[]
}

export function validateRouletteNames(rawNames: string[]): RouletteValidationResult {
  const names = rawNames.map((name) => name.trim())
  const errors: string[] = []

  if (names.length < MIN_ROULETTE_NAMES) errors.push(`Enter at least ${MIN_ROULETTE_NAMES} names.`)
  if (names.length > MAX_ROULETTE_NAMES) errors.push(`Enter no more than ${MAX_ROULETTE_NAMES} names.`)
  if (names.some((name) => !name)) errors.push('Every name must be filled in.')
  if (names.some((name) => Array.from(name).length > MAX_ROULETTE_NAME_LENGTH)) {
    errors.push(`Names must be ${MAX_ROULETTE_NAME_LENGTH} characters or fewer.`)
  }

  const normalized = names.filter(Boolean).map((name) => name.toLocaleLowerCase())
  if (new Set(normalized).size !== normalized.length) errors.push('Names must be unique.')

  return { names, errors }
}

export function selectRouletteIndex(count: number, random: () => number = Math.random): number {
  if (!Number.isInteger(count)) throw new Error('Roulette name count must be an integer.')
  if (count < 1) throw new Error('Roulette needs at least one name.')

  const sampled = random()
  const bounded = Number.isFinite(sampled) ? Math.min(Math.max(sampled, 0), 1 - Number.EPSILON) : 0
  return Math.floor(bounded * count)
}

export function rouletteSectorCenterDegrees(index: number, count: number): number {
  if (!Number.isInteger(count) || count < 1) throw new Error('Roulette name count must be a positive integer.')
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error('Roulette sector index is out of range.')
  return (index + 0.5) * (360 / count)
}

export function nextRouletteRotationDegrees(
  currentRotation: number,
  selectedIndex: number,
  count: number,
  extraTurns = 4,
): number {
  const selectedCenter = rouletteSectorCenterDegrees(selectedIndex, count)
  const targetModulo = (360 - selectedCenter) % 360
  const currentModulo = ((currentRotation % 360) + 360) % 360
  const alignmentDelta = (targetModulo - currentModulo + 360) % 360
  return currentRotation + Math.max(0, Math.floor(extraTurns)) * 360 + alignmentDelta
}
