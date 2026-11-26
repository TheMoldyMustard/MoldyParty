export type SensorPermissionStatus = 'granted' | 'denied' | 'unavailable'

export type SensorConstructorLike = ((...args: never[]) => unknown) & {
  requestPermission?: () => Promise<string>
}

export async function requestSensorPermission(
  constructor: SensorConstructorLike | undefined,
): Promise<SensorPermissionStatus> {
  if (!constructor) return 'unavailable'
  if (typeof constructor.requestPermission !== 'function') return 'granted'
  try {
    return await constructor.requestPermission() === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}
