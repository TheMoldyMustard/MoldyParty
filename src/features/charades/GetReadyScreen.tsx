import { useEffect, useState } from 'react'
import { getCurrentHolder, type CharadesSession } from '../../domain/charades'
import { charadesStore } from '../../store/charadesStore'
import { usePreferencesStore } from '../../store/preferencesStore'
import type { CharadesDeviceController, CharadesDeviceStatus } from './useCharadesDevices'
import AbortGameDialog from '../game/AbortGameDialog'

interface GetReadyScreenProps {
  session: CharadesSession
  devices: CharadesDeviceController
  deviceStatus: CharadesDeviceStatus
  onExit: () => void
}

export default function GetReadyScreen({ session, devices, deviceStatus, onExit }: GetReadyScreenProps) {
  const [countdown, setCountdown] = useState<number | null>(null)
  const [started, setStarted] = useState(false)
  const [usingTapFallback, setUsingTapFallback] = useState(false)
  const holder = getCurrentHolder(session)
  const soundEnabled = usePreferencesStore((state) => state.soundEnabled)
  const hapticsEnabled = usePreferencesStore((state) => state.hapticsEnabled)

  useEffect(() => {
    if (countdown === null) return
    if (!usingTapFallback && (deviceStatus.motion === 'calibrating-neutral'
      || deviceStatus.motion === 'calibrating-correct'
      || deviceStatus.motion === 'returning-neutral')) {
      const timeout = window.setTimeout(() => setCountdown(null), 0)
      return () => window.clearTimeout(timeout)
    }
    if (countdown === 0) {
      devices.beginGameplay()
      charadesStore.getState().beginTurn(Date.now())
      return
    }
    const timeout = window.setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 1_000)
    return () => window.clearTimeout(timeout)
  }, [countdown, deviceStatus.motion, devices, usingTapFallback])

  useEffect(() => {
    if (!started || countdown !== null) return
    if (deviceStatus.motion === 'armed'
      || deviceStatus.motion === 'denied'
      || deviceStatus.motion === 'failed') {
      const timeout = window.setTimeout(() => setCountdown(3), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [countdown, deviceStatus.motion, started])

  async function start() {
    setStarted(true)
    const status = await devices.start({
      motionEnabled: session.settings.motionEnabled,
      soundEnabled,
      hapticsEnabled,
    })
    if (status.motion === 'armed'
      || status.motion === 'off'
      || status.motion === 'denied'
      || status.motion === 'failed') {
      setCountdown(3)
    }
  }

  function continueWithTaps() {
    devices.disableMotion()
    setUsingTapFallback(true)
    setCountdown(3)
  }

  const calibrationInstruction = deviceStatus.motion === 'calibrating-neutral'
    ? 'Hold the phone neutral on your forehead'
    : deviceStatus.motion === 'calibrating-correct'
      ? 'Tilt the phone face up for Correct'
      : deviceStatus.motion === 'returning-neutral'
        ? 'Return the phone to neutral'
        : 'Preparing tilt controls…'

  return <main className="charades-ready-screen">
    <AbortGameDialog onConfirm={onExit} triggerClassName="text-button charades-exit" />
    <span className="eyebrow">{session.settings.mode === 'team-relay' ? holder.teamName : session.settings.packName}</span>
    <h1>Get ready, {holder.memberName}</h1>
    {session.settings.mode === 'one-word' && <p>Each clue-giver may say exactly one word per card.</p>}
    {session.settings.mode === 'henyo' && <p>Ask questions. Clue-givers answer only Oo, Hindi, or Pwede.</p>}
    {!started ? <button className="button button--hero" type="button" onClick={() => void start()}>Start Get Ready</button> : countdown === null ? <><div className="ready-countdown" role="status" aria-live="polite"><span>{calibrationInstruction}</span></div><button className="button button--secondary" type="button" onClick={continueWithTaps}>Continue with taps</button></> : <div className="ready-countdown" aria-live="polite"><strong>{countdown || 'Go!'}</strong><span>Hold the phone landscape on your forehead</span></div>}
    {deviceStatus.motion === 'denied' || deviceStatus.motion === 'failed' ? <p role="status">Motion unavailable — use the left and right tap controls.</p> : null}
    {!deviceStatus.landscape && started && <p className="rotate-prompt">Rotate to landscape for the clearest view. Portrait still works.</p>}
  </main>
}
