import type { CharadesOutcome } from '../../domain/charades'

export interface VibrationNavigatorLike {
  vibrate?(pattern: number | number[]): boolean
}

export function vibrateForOutcome(
  navigator: VibrationNavigatorLike,
  outcome: CharadesOutcome,
  enabled: boolean,
): boolean {
  if (!enabled || typeof navigator.vibrate !== 'function') return false
  try {
    return navigator.vibrate(outcome === 'correct' ? 35 : [30, 45, 30])
  } catch {
    return false
  }
}
