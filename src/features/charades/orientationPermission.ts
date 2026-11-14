export type OrientationPermissionStatus = 'granted' | 'denied' | 'unavailable'

export type OrientationConstructorLike = ((...args: never[]) => unknown) & {
  requestPermission?: () => Promise<string>
}

export async function requestOrientationPermission(
  constructor: OrientationConstructorLike | undefined,
): Promise<OrientationPermissionStatus> {
  if (!constructor) return 'unavailable'
  if (typeof constructor.requestPermission !== 'function') return 'granted'
  try {
    return await constructor.requestPermission() === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}
