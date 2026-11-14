import { describe, expect, it, vi } from 'vitest'
import { createOrientationRecognizer } from './orientationInput'
import { createCharadesDeviceController } from './useCharadesDevices'

function fakeTarget() {
  const listeners = new Map<string, Set<EventListener>>()
  return {
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      const set = listeners.get(type) ?? new Set<EventListener>()
      set.add(listener)
      listeners.set(type, set)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener)
    }),
    dispatch(type: string, event: Event) {
      for (const listener of listeners.get(type) ?? []) listener(event)
    },
  }
}

describe('Charades device controller', () => {
  it('requests motion permission synchronously before awaiting other device services', async () => {
    let releaseAudio!: () => void
    const audioUnlock = new Promise<void>((resolve) => { releaseAudio = resolve })
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const controller = createCharadesDeviceController({
      windowTarget: fakeTarget(),
      documentTarget: { ...fakeTarget(), visibilityState: 'visible' as const },
      requestPermission,
      getAngle: () => 0,
      now: () => 0,
      wakeLock: { acquire: vi.fn().mockResolvedValue(false), release: vi.fn(), isHeld: vi.fn() },
      lockLandscape: vi.fn().mockResolvedValue(false),
      unlockOrientation: vi.fn(),
      audio: { unlock: vi.fn(() => audioUnlock.then(() => true)), play: vi.fn(), playCountdown: vi.fn(), setEnabled: vi.fn(), dispose: vi.fn() },
      vibrationNavigator: {},
      recognizer: createOrientationRecognizer(),
      onOutcome: vi.fn().mockReturnValue(true),
    })

    const starting = controller.start({ motionEnabled: true, soundEnabled: true, hapticsEnabled: false })
    expect(requestPermission).toHaveBeenCalledTimes(1)
    releaseAudio()
    await starting
  })

  it('calibrates orientation, forwards semantic actions, and cleans up every service', async () => {
    let now = 0
    const windowTarget = fakeTarget()
    const documentTarget = { ...fakeTarget(), visibilityState: 'visible' as const }
    const onOutcome = vi.fn().mockReturnValue(true)
    const wakeLock = { acquire: vi.fn().mockResolvedValue(true), release: vi.fn().mockResolvedValue(undefined), isHeld: vi.fn() }
    const audio = {
      unlock: vi.fn().mockResolvedValue(true),
      play: vi.fn().mockReturnValue(true),
      playCountdown: vi.fn().mockReturnValue(true),
      setEnabled: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
    }
    const unlock = vi.fn()
    const vibrate = vi.fn().mockReturnValue(true)
    const controller = createCharadesDeviceController({
      windowTarget,
      documentTarget,
      requestPermission: vi.fn().mockResolvedValue('granted'),
      getAngle: () => 0,
      now: () => now,
      wakeLock,
      lockLandscape: vi.fn().mockResolvedValue(true),
      unlockOrientation: unlock,
      audio,
      vibrationNavigator: { vibrate },
      recognizer: createOrientationRecognizer({ minimumSamples: 2, dwellMs: 0 }),
      onOutcome,
    })

    await controller.start({ motionEnabled: true, soundEnabled: true, hapticsEnabled: true })
    windowTarget.dispatch('deviceorientation', Object.assign(new Event('deviceorientation'), { beta: 10, gamma: 0 }))
    now = 1_000
    windowTarget.dispatch('deviceorientation', Object.assign(new Event('deviceorientation'), { beta: 10, gamma: 0 }))
    now = 1_100
    windowTarget.dispatch('deviceorientation', Object.assign(new Event('deviceorientation'), { beta: 40, gamma: 0 }))
    windowTarget.dispatch('deviceorientation', Object.assign(new Event('deviceorientation'), { beta: 40, gamma: 0 }))
    controller.playOutcome('pass')

    expect(onOutcome).toHaveBeenCalledWith('correct')
    expect(audio.play).toHaveBeenCalledWith('correct')
    expect(vibrate).toHaveBeenCalledWith(35)
    expect(audio.play).toHaveBeenCalledWith('pass')
    expect(vibrate).toHaveBeenCalledWith([30, 45, 30])

    await controller.stop()
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith('deviceorientation', expect.any(Function))
    expect(wakeLock.release).toHaveBeenCalled()
    expect(unlock).toHaveBeenCalled()
    expect(audio.dispose).toHaveBeenCalled()
  })

  it('continues with tap controls after motion permission is denied', async () => {
    const windowTarget = fakeTarget()
    const documentTarget = { ...fakeTarget(), visibilityState: 'visible' as const }
    const controller = createCharadesDeviceController({
      windowTarget,
      documentTarget,
      requestPermission: vi.fn().mockResolvedValue('denied'),
      getAngle: () => 0,
      now: () => 0,
      wakeLock: { acquire: vi.fn().mockResolvedValue(false), release: vi.fn(), isHeld: vi.fn() },
      lockLandscape: vi.fn().mockResolvedValue(false),
      unlockOrientation: vi.fn(),
      audio: { unlock: vi.fn(), play: vi.fn(), playCountdown: vi.fn(), setEnabled: vi.fn(), dispose: vi.fn() },
      vibrationNavigator: {},
      recognizer: createOrientationRecognizer(),
      onOutcome: vi.fn(),
    })

    const status = await controller.start({ motionEnabled: true, soundEnabled: false, hapticsEnabled: false })

    expect(status.motion).toBe('denied')
    expect(windowTarget.addEventListener).not.toHaveBeenCalledWith('deviceorientation', expect.any(Function))
  })
})
