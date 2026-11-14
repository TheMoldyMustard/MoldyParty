export interface ScreenOrientationLike {
  lock?(orientation: 'landscape'): Promise<void>
  unlock?(): void
  angle?: number
}

export function getOrientationAngle(orientation: ScreenOrientationLike | undefined): number {
  const angle = orientation?.angle
  return typeof angle === 'number' && Number.isFinite(angle) ? angle : 0
}

export async function lockLandscape(orientation: ScreenOrientationLike | undefined): Promise<boolean> {
  if (typeof orientation?.lock !== 'function') return false
  try {
    await orientation.lock('landscape')
    return true
  } catch {
    return false
  }
}

export function unlockOrientation(orientation: ScreenOrientationLike | undefined): void {
  try {
    orientation?.unlock?.()
  } catch {
    // Orientation locking is advisory and cleanup must never block exit.
  }
}
