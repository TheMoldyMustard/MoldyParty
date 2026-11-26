import { describe, expect, it, vi } from 'vitest'
import { createTiltRecognizer } from './tiltInput'
import { createCharadesDeviceController, type CharadesDeviceControllerDependencies } from './useCharadesDevices'

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

function motion(x: number, y: number, z: number) {
  return Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x, y, z } })
}

function dependencies(overrides: Partial<CharadesDeviceControllerDependencies> = {}): CharadesDeviceControllerDependencies {
  return {
    windowTarget: fakeTarget(),
    documentTarget: { ...fakeTarget(), visibilityState: 'visible' as const },
    requestPermission: vi.fn().mockResolvedValue('granted'),
    getAngle: () => 0,
    now: () => 0,
    wakeLock: { acquire: vi.fn().mockResolvedValue(false), release: vi.fn(), isHeld: vi.fn() },
    lockLandscape: vi.fn().mockResolvedValue(false),
    unlockOrientation: vi.fn(),
    audio: { unlock: vi.fn(), play: vi.fn(), playCountdown: vi.fn(), setEnabled: vi.fn(), dispose: vi.fn() },
    vibrationNavigator: {},
    recognizer: createTiltRecognizer(),
    onOutcome: vi.fn().mockReturnValue(true),
    ...overrides,
  }
}

describe('Charades device controller', () => {
  it('requests motion permission synchronously before awaiting other device services', async () => {
    let releaseAudio!: () => void
    const audioUnlock = new Promise<void>((resolve) => { releaseAudio = resolve })
    const requestPermission = vi.fn().mockResolvedValue('granted')
    const controller = createCharadesDeviceController(dependencies({
      requestPermission,
      audio: { unlock: vi.fn(() => audioUnlock.then(() => true)), play: vi.fn(), playCountdown: vi.fn(), setEnabled: vi.fn(), dispose: vi.fn() },
    }))

    const starting = controller.start({ motionEnabled: true, soundEnabled: true, hapticsEnabled: false })
    expect(requestPermission).toHaveBeenCalledTimes(1)
    releaseAudio()
    await starting
  })

  it('publishes guided phases, then forwards calibrated phone-face-up as Correct', async () => {
    let now = 0
    const windowTarget = fakeTarget()
    const onOutcome = vi.fn().mockReturnValue(true)
    const audio = {
      unlock: vi.fn().mockResolvedValue(true), play: vi.fn().mockReturnValue(true),
      playCountdown: vi.fn(), setEnabled: vi.fn(), dispose: vi.fn(),
    }
    const vibrate = vi.fn().mockReturnValue(true)
    const controller = createCharadesDeviceController(dependencies({
      windowTarget,
      now: () => now,
      audio,
      vibrationNavigator: { vibrate },
      recognizer: createTiltRecognizer({ minimumSamples: 2, gestureCalibrationMs: 0, minimumGestureSamples: 2, dwellMs: 0 }),
      onOutcome,
    }))

    await controller.start({ motionEnabled: true, soundEnabled: true, hapticsEnabled: true })
    expect(controller.getStatus().motion).toBe('calibrating-neutral')
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    now = 1_000
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    expect(controller.getStatus().motion).toBe('calibrating-correct')
    now = 1_100
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))
    expect(controller.getStatus().motion).toBe('returning-neutral')
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    expect(controller.getStatus().motion).toBe('armed')

    controller.beginGameplay()
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))

    expect(onOutcome).toHaveBeenCalledWith('correct')
    expect(audio.play).toHaveBeenCalledWith('correct')
    expect(vibrate).toHaveBeenCalledWith(35)
  })

  it('restarts guided calibration before play but fails closed after play on rotation', async () => {
    let now = 0
    let angle = 0
    const windowTarget = fakeTarget()
    const onOutcome = vi.fn().mockReturnValue(true)
    const controller = createCharadesDeviceController(dependencies({
      windowTarget,
      getAngle: () => angle,
      now: () => now,
      recognizer: createTiltRecognizer({ minimumSamples: 2, gestureCalibrationMs: 0, minimumGestureSamples: 2, dwellMs: 0 }),
      onOutcome,
    }))

    await controller.start({ motionEnabled: true, soundEnabled: false, hapticsEnabled: false })
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    now = 1_000
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    expect(controller.getStatus().motion).toBe('calibrating-correct')

    angle = 90
    now = 1_100
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    expect(controller.getStatus().motion).toBe('calibrating-neutral')
    now = 2_100
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    now = 2_200
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))
    windowTarget.dispatch('devicemotion', motion(9.8, 0, 0))
    expect(controller.getStatus().motion).toBe('armed')

    controller.beginGameplay()
    angle = 0
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))
    expect(controller.getStatus().motion).toBe('failed')
    expect(onOutcome).not.toHaveBeenCalled()
  })

  it('continues with tap controls after motion permission is denied', async () => {
    const windowTarget = fakeTarget()
    const controller = createCharadesDeviceController(dependencies({
      windowTarget,
      requestPermission: vi.fn().mockResolvedValue('denied'),
    }))

    const status = await controller.start({ motionEnabled: true, soundEnabled: false, hapticsEnabled: false })

    expect(status.motion).toBe('denied')
    expect(windowTarget.addEventListener).not.toHaveBeenCalledWith('devicemotion', expect.any(Function))
  })

  it('ignores missing gravity vectors and removes the motion listener on stop', async () => {
    const windowTarget = fakeTarget()
    const onOutcome = vi.fn().mockReturnValue(true)
    const controller = createCharadesDeviceController(dependencies({ windowTarget, onOutcome }))

    await controller.start({ motionEnabled: true, soundEnabled: false, hapticsEnabled: false })
    windowTarget.dispatch('devicemotion', Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: null }))
    expect(controller.getStatus().motion).toBe('calibrating-neutral')

    await controller.stop()
    expect(windowTarget.removeEventListener).toHaveBeenCalledWith('devicemotion', expect.any(Function))
    windowTarget.dispatch('devicemotion', motion(8.487, 0, 4.9))
    expect(onOutcome).not.toHaveBeenCalled()
  })

  it('does not install listeners when stop interrupts a pending start', async () => {
    let resolvePermission!: (permission: 'granted') => void
    const permission = new Promise<'granted'>((resolve) => { resolvePermission = resolve })
    const windowTarget = fakeTarget()
    const documentTarget = { ...fakeTarget(), visibilityState: 'visible' as const }
    const wakeLock = { acquire: vi.fn().mockResolvedValue(true), release: vi.fn(), isHeld: vi.fn() }
    const unlockOrientation = vi.fn()
    const controller = createCharadesDeviceController(dependencies({
      windowTarget,
      documentTarget,
      requestPermission: vi.fn(() => permission),
      wakeLock,
      lockLandscape: vi.fn().mockResolvedValue(true),
      unlockOrientation,
    }))

    const starting = controller.start({ motionEnabled: true, soundEnabled: false, hapticsEnabled: false })
    const stopping = controller.stop()
    resolvePermission('granted')
    await Promise.all([starting, stopping])

    expect(windowTarget.addEventListener).not.toHaveBeenCalledWith('devicemotion', expect.any(Function))
    expect(documentTarget.addEventListener).not.toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(wakeLock.release).toHaveBeenCalled()
    expect(unlockOrientation).toHaveBeenCalled()
    expect(controller.getStatus().motion).toBe('off')
  })

  it('keeps a rapid restart active after an older pending start is stopped', async () => {
    let resolveFirstPermission!: (permission: 'granted') => void
    const firstPermission = new Promise<'granted'>((resolve) => { resolveFirstPermission = resolve })
    const requestPermission = vi.fn()
      .mockImplementationOnce(() => firstPermission)
      .mockResolvedValueOnce('granted')
    const windowTarget = fakeTarget()
    const controller = createCharadesDeviceController(dependencies({ windowTarget, requestPermission }))

    const firstStart = controller.start({ motionEnabled: true, soundEnabled: false, hapticsEnabled: false })
    const stopping = controller.stop()
    const secondStart = controller.start({ motionEnabled: true, soundEnabled: false, hapticsEnabled: false })
    await secondStart
    resolveFirstPermission('granted')
    await Promise.all([firstStart, stopping])

    expect(requestPermission).toHaveBeenCalledTimes(2)
    expect(windowTarget.addEventListener).toHaveBeenCalledTimes(1)
    expect(windowTarget.addEventListener).toHaveBeenCalledWith('devicemotion', expect.any(Function))
    expect(controller.getStatus().motion).toBe('calibrating-neutral')
  })
})
