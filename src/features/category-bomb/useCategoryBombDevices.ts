import { useEffect, useMemo, useRef } from 'react'
import { usePreferencesStore } from '../../store/preferencesStore'
import { createAudioSynth } from '../charades/audioSynth'
import { createWakeLockManager, type WakeLockLike } from '../charades/wakeLock'

export interface CategoryBombDeviceController {
  start(): Promise<void>
  playAccept(): void
  playExplosion(): void
  stop(): Promise<void>
}

export function useCategoryBombDevices(): CategoryBombDeviceController {
  const soundEnabled = usePreferencesStore((state) => state.soundEnabled)
  const hapticsEnabled = usePreferencesStore((state) => state.hapticsEnabled)
  const settings = useRef({ soundEnabled, hapticsEnabled })

  useEffect(() => {
    settings.current = { soundEnabled, hapticsEnabled }
  }, [soundEnabled, hapticsEnabled])

  const controller = useMemo<CategoryBombDeviceController>(() => {
    const audio = createAudioSynth()
    const wakeLock = createWakeLockManager(
      (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock,
      () => document.visibilityState === 'visible',
    )
    return {
      async start() {
        audio.setEnabled(settings.current.soundEnabled)
        await Promise.allSettled([
          settings.current.soundEnabled ? audio.unlock() : Promise.resolve(false),
          wakeLock.acquire(),
        ])
      },
      playAccept() {
        audio.play('bomb-accept')
        if (settings.current.hapticsEnabled) {
          try { navigator.vibrate?.(35) } catch { /* optional API */ }
        }
      },
      playExplosion() {
        audio.play('explode')
        if (settings.current.hapticsEnabled) {
          try { navigator.vibrate?.([100, 50, 180]) } catch { /* optional API */ }
        }
        void wakeLock.release()
      },
      async stop() {
        await wakeLock.release()
        await audio.dispose()
      },
    }
  }, [])

  useEffect(() => () => { void controller.stop() }, [controller])
  return controller
}
