import { useEffect, useState } from 'react'
import { getCurrentHolder, type CharadesSession } from '../../domain/charades'
import { charadesStore } from '../../store/charadesStore'
import { usePreferencesStore } from '../../store/preferencesStore'
import type { CharadesDeviceController, CharadesDeviceStatus } from './useCharadesDevices'

interface GetReadyScreenProps {
  session: CharadesSession
  devices: CharadesDeviceController
  deviceStatus: CharadesDeviceStatus
  onExit: () => void
}

export default function GetReadyScreen({ session, devices, deviceStatus, onExit }: GetReadyScreenProps) {
  const [countdown, setCountdown] = useState<number | null>(null)
  const holder = getCurrentHolder(session)
  const soundEnabled = usePreferencesStore((state) => state.soundEnabled)
  const hapticsEnabled = usePreferencesStore((state) => state.hapticsEnabled)

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      charadesStore.getState().beginTurn(Date.now())
      return
    }
    const timeout = window.setTimeout(() => setCountdown((value) => value === null ? null : value - 1), 1_000)
    return () => window.clearTimeout(timeout)
  }, [countdown])

  async function start() {
    await devices.start({
      motionEnabled: session.settings.motionEnabled,
      soundEnabled,
      hapticsEnabled,
    })
    setCountdown(3)
  }

  return <main className="charades-ready-screen">
    <button className="text-button charades-exit" type="button" onClick={onExit}>Exit</button>
    <span className="eyebrow">{session.settings.mode === 'team-relay' ? holder.teamName : session.settings.packName}</span>
    <h1>Get ready, {holder.memberName}</h1>
    {session.settings.mode === 'one-word' && <p>Each clue-giver may say exactly one word per card.</p>}
    {session.settings.mode === 'henyo' && <p>Ask questions. Clue-givers answer only Oo, Hindi, or Pwede.</p>}
    {countdown === null ? <button className="button button--hero" type="button" onClick={() => void start()}>Start Get Ready</button> : <div className="ready-countdown" aria-live="polite"><strong>{countdown || 'Go!'}</strong><span>{countdown === 3 ? 'Calibrating neutral pose…' : 'Hold the phone landscape on your forehead'}</span></div>}
    {deviceStatus.motion === 'denied' || deviceStatus.motion === 'failed' ? <p role="status">Motion unavailable — use the left and right tap controls.</p> : null}
    {!deviceStatus.landscape && countdown !== null && <p className="rotate-prompt">Rotate to landscape for the clearest view. Portrait still works.</p>}
  </main>
}
