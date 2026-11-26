import { describe, expect, it, vi } from 'vitest'
import { vibrateForOutcome } from './haptics'
import { getOrientationAngle, lockLandscape, unlockOrientation } from './orientationLock'
import { requestSensorPermission } from './sensorPermission'
import { createWakeLockManager } from './wakeLock'

describe('motion sensor permission', () => {
  it('returns granted for browsers without an explicit permission method', async () => {
    expect(await requestSensorPermission(function DeviceMotionEvent() {})).toBe('granted')
  })

  it('reports an explicit denial without throwing', async () => {
    const constructor = Object.assign(function DeviceMotionEvent() {}, {
      requestPermission: vi.fn().mockResolvedValue('denied'),
    })

    expect(await requestSensorPermission(constructor)).toBe('denied')
  })

  it('reports an unavailable sensor constructor', async () => {
    expect(await requestSensorPermission(undefined)).toBe('unavailable')
  })
})

describe('wake lock manager', () => {
  it('holds one sentinel, releases it, and can reacquire after returning visible', async () => {
    const first = { released: false, release: vi.fn().mockImplementation(async () => { first.released = true }) }
    const second = { released: false, release: vi.fn().mockImplementation(async () => { second.released = true }) }
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const manager = createWakeLockManager({ request }, () => true)

    expect(await manager.acquire()).toBe(true)
    expect(await manager.acquire()).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
    await manager.release()
    expect(first.release).toHaveBeenCalledTimes(1)
    expect(await manager.acquire()).toBe(true)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('fails open when hidden or rejected', async () => {
    const request = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    expect(await createWakeLockManager({ request }, () => false).acquire()).toBe(false)
    expect(request).not.toHaveBeenCalled()
    expect(await createWakeLockManager({ request }, () => true).acquire()).toBe(false)
  })
})

describe('orientation and haptic feedback fallbacks', () => {
  it('uses a zero angle when screen orientation is unavailable', () => {
    expect(getOrientationAngle(undefined)).toBe(0)
    expect(getOrientationAngle({ angle: 270 })).toBe(270)
  })

  it('treats orientation locking as advisory and always allows unlock cleanup', async () => {
    const orientation = { lock: vi.fn().mockRejectedValue(new Error('Unsupported')), unlock: vi.fn() }
    expect(await lockLandscape(orientation)).toBe(false)
    unlockOrientation(orientation)
    expect(orientation.unlock).toHaveBeenCalledTimes(1)
  })

  it('uses distinct correct and pass patterns only when enabled', () => {
    const vibrate = vi.fn().mockReturnValue(true)
    vibrateForOutcome({ vibrate }, 'correct', true)
    vibrateForOutcome({ vibrate }, 'pass', true)
    vibrateForOutcome({ vibrate }, 'correct', false)

    expect(vibrate).toHaveBeenNthCalledWith(1, 35)
    expect(vibrate).toHaveBeenNthCalledWith(2, [30, 45, 30])
    expect(vibrate).toHaveBeenCalledTimes(2)
  })
})
