import { useEffect, useState } from 'react'
import type { CharadesOutcome } from '../../domain/charades'
import { createAudioSynth, type AudioCue, type AudioSynth } from './audioSynth'
import { vibrateForOutcome, type VibrationNavigatorLike } from './haptics'
import { createOrientationRecognizer, type OrientationRecognizer } from './orientationInput'
import { getOrientationAngle, lockLandscape as requestLandscape, unlockOrientation as releaseOrientation } from './orientationLock'
import { requestOrientationPermission as requestBrowserOrientation, type OrientationConstructorLike, type OrientationPermissionStatus } from './orientationPermission'
import { createWakeLockManager, type WakeLockManager, type WakeLockLike } from './wakeLock'

interface EventTargetLike {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

interface VisibilityTargetLike extends EventTargetLike {
  visibilityState: string
}

export interface CharadesDeviceStatus {
  motion: 'off' | 'calibrating' | 'armed' | 'denied' | 'failed'
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
  requestPermission: () => Promise<OrientationPermissionStatus>
  getAngle: () => number
  now: () => number
  wakeLock: WakeLockManager
  lockLandscape: () => Promise<boolean>
  unlockOrientation: () => void
  audio: AudioSynth
  vibrationNavigator: VibrationNavigatorLike
  recognizer: OrientationRecognizer
  onOutcome: (outcome: CharadesOutcome) => boolean
  onStatus?: (status: CharadesDeviceStatus) => void
}

export interface CharadesDeviceController {
  start(options: CharadesDeviceStartOptions): Promise<CharadesDeviceStatus>
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
  let orientationListening = false

  function updateStatus(next: Partial<CharadesDeviceStatus>) {
    status = { ...status, ...next }
    dependencies.onStatus?.(status)
  }

  const onOrientation: EventListener = (event) => {
    const orientation = event as Event & { beta?: number | null; gamma?: number | null }
    const result = dependencies.recognizer.update({
      beta: orientation.beta ?? null,
      gamma: orientation.gamma ?? null,
      angle: dependencies.getAngle(),
    }, dependencies.now())
    if (result.status === 'calibrating') updateStatus({ motion: 'calibrating' })
    if (result.status === 'armed' || result.status === 'latched') updateStatus({ motion: 'armed' })
    if (result.status === 'failed') updateStatus({ motion: 'failed' })
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
    async start(options) {
      if (started) return status
      started = true
      hapticsEnabled = options.hapticsEnabled
      let permissionPromise: Promise<OrientationPermissionStatus>
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
      const [permission, , wake, landscape] = await Promise.all([
        permissionPromise,
        audioPromise,
        wakePromise,
        landscapePromise,
      ])
      updateStatus({ wake, landscape, motion: options.motionEnabled ? 'calibrating' : 'off' })
      dependencies.documentTarget.addEventListener('visibilitychange', onVisibilityChange)

      if (options.motionEnabled) {
        if (permission === 'granted') {
          dependencies.recognizer.startCalibration(dependencies.now())
          dependencies.windowTarget.addEventListener('deviceorientation', onOrientation)
          orientationListening = true
        } else {
          updateStatus({ motion: permission === 'denied' ? 'denied' : 'failed' })
        }
      }
      return status
    },
    async stop() {
      if (orientationListening) {
        dependencies.windowTarget.removeEventListener('deviceorientation', onOrientation)
        orientationListening = false
      }
      if (started) dependencies.documentTarget.removeEventListener('visibilitychange', onVisibilityChange)
      started = false
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
  const orientationConstructor = window.DeviceOrientationEvent as unknown as OrientationConstructorLike
  return {
    windowTarget: window,
    documentTarget: document,
    requestPermission: () => requestBrowserOrientation(orientationConstructor),
    getAngle: () => getOrientationAngle(orientation),
    now: () => performance.now(),
    wakeLock,
    lockLandscape: () => requestLandscape(orientation),
    unlockOrientation: () => releaseOrientation(orientation),
    audio: createAudioSynth(),
    vibrationNavigator: navigator,
    recognizer: createOrientationRecognizer(),
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
