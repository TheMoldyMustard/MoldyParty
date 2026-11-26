import { useEffect, useState } from 'react'
import type { CharadesOutcome } from '../../domain/charades'
import { createAudioSynth, type AudioCue, type AudioSynth } from './audioSynth'
import { vibrateForOutcome, type VibrationNavigatorLike } from './haptics'
import { getOrientationAngle, lockLandscape as requestLandscape, unlockOrientation as releaseOrientation } from './orientationLock'
import { requestSensorPermission as requestBrowserSensor, type SensorConstructorLike, type SensorPermissionStatus } from './sensorPermission'
import { createTiltRecognizer, type TiltRecognizer, type TiltRecognizerStatus } from './tiltInput'
import { createWakeLockManager, type WakeLockManager, type WakeLockLike } from './wakeLock'

interface EventTargetLike {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface VisibilityTargetLike extends EventTargetLike {
  visibilityState: string
}

export interface CharadesDeviceStatus {
  motion: 'off' | 'calibrating-neutral' | 'calibrating-correct' | 'returning-neutral' | 'armed' | 'denied' | 'failed'
  wake: boolean
  landscape: boolean
}

export interface CharadesDeviceStartOptions {
  motionEnabled: boolean
  soundEnabled: boolean
  hapticsEnabled: boolean
}

export interface CharadesDeviceControllerDependencies {
  windowTarget: EventTargetLike
  documentTarget: VisibilityTargetLike
  requestPermission: () => Promise<SensorPermissionStatus>
  getAngle: () => number
  now: () => number
  wakeLock: WakeLockManager
  lockLandscape: () => Promise<boolean>
  unlockOrientation: () => void
  audio: AudioSynth
  vibrationNavigator: VibrationNavigatorLike
  recognizer: TiltRecognizer
  onOutcome: (outcome: CharadesOutcome) => boolean
  onStatus?: (status: CharadesDeviceStatus) => void
}

export interface CharadesDeviceController {
  start(options: CharadesDeviceStartOptions): Promise<CharadesDeviceStatus>
  beginGameplay(): void
  disableMotion(): void
  stop(): Promise<void>
  getStatus(): CharadesDeviceStatus
  playOutcome(outcome: CharadesOutcome): void
  playAnswer(answer: 'yes' | 'no' | 'maybe'): void
  playFoul(): void
  playCountdown(second: number): void
}

export function createCharadesDeviceController(
  dependencies: CharadesDeviceControllerDependencies,
): CharadesDeviceController {
  let status: CharadesDeviceStatus = { motion: 'off', wake: false, landscape: false }
  let started = false
  let hapticsEnabled = true
  let motionListening = false
  let visibilityListening = false
  let lifecycle = 0
  let pendingStart: Promise<CharadesDeviceStatus> | null = null

  function updateStatus(next: Partial<CharadesDeviceStatus>) {
    const nextStatus = { ...status, ...next }
    if (nextStatus.motion === status.motion
      && nextStatus.wake === status.wake
      && nextStatus.landscape === status.landscape) return
    status = nextStatus
    dependencies.onStatus?.(status)
  }

  function publishRecognizerStatus(recognizerStatus: TiltRecognizerStatus) {
    if (recognizerStatus === 'calibrating-neutral'
      || recognizerStatus === 'calibrating-correct'
      || recognizerStatus === 'returning-neutral') {
      updateStatus({ motion: recognizerStatus })
    }
    if (recognizerStatus === 'armed' || recognizerStatus === 'latched') updateStatus({ motion: 'armed' })
    if (recognizerStatus === 'failed') updateStatus({ motion: 'failed' })
  }

  const onMotion: EventListener = (event) => {
    const motion = event as Event & {
      accelerationIncludingGravity?: { x?: number | null; y?: number | null; z?: number | null } | null
    }
    const gravity = motion.accelerationIncludingGravity
    const result = dependencies.recognizer.update({
      x: gravity?.x ?? null,
      y: gravity?.y ?? null,
      z: gravity?.z ?? null,
      angle: dependencies.getAngle(),
    }, dependencies.now())
    publishRecognizerStatus(result.status)
    if (result.action && dependencies.onOutcome(result.action)) {
      dependencies.audio.play(result.action)
      vibrateForOutcome(dependencies.vibrationNavigator, result.action, hapticsEnabled)
    }
  }

  const onVisibilityChange: EventListener = () => {
    if (dependencies.documentTarget.visibilityState === 'visible') {
      void dependencies.wakeLock.acquire().then((wake) => updateStatus({ wake }))
    } else {
      void dependencies.wakeLock.release().then(() => updateStatus({ wake: false }))
    }
  }

  return {
    start(options) {
      if (started) return Promise.resolve(status)
      started = true
      const run = ++lifecycle
      hapticsEnabled = options.hapticsEnabled
      let permissionPromise: Promise<SensorPermissionStatus>
      try {
        permissionPromise = options.motionEnabled
          ? dependencies.requestPermission()
          : Promise.resolve('unavailable')
      } catch {
        permissionPromise = Promise.resolve('denied')
      }
      dependencies.audio.setEnabled(options.soundEnabled)
      const audioPromise = options.soundEnabled ? dependencies.audio.unlock() : Promise.resolve(false)
      const wakePromise = dependencies.wakeLock.acquire()
      const landscapePromise = dependencies.lockLandscape()
      const starting = Promise.all([
        permissionPromise,
        audioPromise,
        wakePromise,
        landscapePromise,
      ]).then(([permission, , wake, landscape]) => {
        if (run !== lifecycle || !started) return status
        updateStatus({ wake, landscape, motion: options.motionEnabled ? 'calibrating-neutral' : 'off' })
        dependencies.documentTarget.addEventListener('visibilitychange', onVisibilityChange)
        visibilityListening = true

        if (options.motionEnabled) {
          if (permission === 'granted') {
            dependencies.recognizer.startCalibration(dependencies.now())
            dependencies.windowTarget.addEventListener('devicemotion', onMotion)
            motionListening = true
          } else {
            updateStatus({ motion: permission === 'denied' ? 'denied' : 'failed' })
          }
        }
        return status
      })
      pendingStart = starting
      const clearPending = () => {
        if (pendingStart === starting) pendingStart = null
      }
      void starting.then(clearPending, clearPending)
      return starting
    },
    beginGameplay() {
      dependencies.recognizer.beginGameplay()
    },
    disableMotion() {
      if (motionListening) {
        dependencies.windowTarget.removeEventListener('devicemotion', onMotion)
        motionListening = false
      }
      updateStatus({ motion: 'off' })
    },
    async stop() {
      const stopRun = ++lifecycle
      started = false
      if (motionListening) {
        dependencies.windowTarget.removeEventListener('devicemotion', onMotion)
        motionListening = false
      }
      if (visibilityListening) {
        dependencies.documentTarget.removeEventListener('visibilitychange', onVisibilityChange)
        visibilityListening = false
      }
      updateStatus({ motion: 'off' })
      const startAtStop = pendingStart
      if (startAtStop) {
        try {
          await startAtStop
        } catch {
          // Cleanup still owns resources acquired by a failed start.
        }
      }
      if (lifecycle !== stopRun || started) return
      await dependencies.wakeLock.release()
      dependencies.unlockOrientation()
      await dependencies.audio.dispose()
      updateStatus({ motion: 'off', wake: false, landscape: false })
    },
    getStatus() {
      return status
    },
    playOutcome(outcome) {
      dependencies.audio.play(outcome)
      vibrateForOutcome(dependencies.vibrationNavigator, outcome, hapticsEnabled)
    },
    playAnswer(answer) {
      dependencies.audio.play(answer as AudioCue)
    },
    playFoul() {
      dependencies.audio.play('foul')
    },
    playCountdown(second) {
      dependencies.audio.playCountdown(second)
    },
  }
}

function browserDependencies(
  onOutcome: (outcome: CharadesOutcome) => boolean,
  onStatus?: (status: CharadesDeviceStatus) => void,
): CharadesDeviceControllerDependencies {
  const orientation = screen.orientation as unknown as { lock?: (value: 'landscape') => Promise<void>; unlock?: () => void; angle?: number } | undefined
  const wakeLock = createWakeLockManager(
    (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock,
    () => document.visibilityState === 'visible',
  )
  const motionConstructor = window.DeviceMotionEvent as unknown as SensorConstructorLike
  return {
    windowTarget: window,
    documentTarget: document,
    requestPermission: () => requestBrowserSensor(motionConstructor),
    getAngle: () => getOrientationAngle(orientation),
    now: () => performance.now(),
    wakeLock,
    lockLandscape: () => requestLandscape(orientation),
    unlockOrientation: () => releaseOrientation(orientation),
    audio: createAudioSynth(),
    vibrationNavigator: navigator,
    recognizer: createTiltRecognizer(),
    onOutcome,
    onStatus,
  }
}

export function useCharadesDevices(
  onOutcome: (outcome: CharadesOutcome) => boolean,
  onStatus?: (status: CharadesDeviceStatus) => void,
): CharadesDeviceController {
  const [controller] = useState(() => createCharadesDeviceController(browserDependencies(onOutcome, onStatus)))
  useEffect(() => () => { void controller.stop() }, [controller])
  return controller
}
