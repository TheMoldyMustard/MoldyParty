import { useCallback, useEffect, useRef, useState } from 'react'
import type { CharadesOutcome, CharadesSession } from '../../domain/charades'
import { charadesStore } from '../../store/charadesStore'
import type { CharadesDeviceController, CharadesDeviceStatus } from './useCharadesDevices'

const categoryLabels: Record<string, string> = {
  person: 'Person / Tao', place: 'Place / Lugar', object: 'Object / Bagay', animal: 'Animal / Hayop',
  food: 'Food / Pagkain', 'pop-culture': 'Pop Culture', other: 'Other / Iba',
}

interface ActiveRoundScreenProps {
  session: CharadesSession
  devices: CharadesDeviceController
  deviceStatus: CharadesDeviceStatus
  onExit: () => void
}

export default function ActiveRoundScreen({ session, devices, deviceStatus, onExit }: ActiveRoundScreenProps) {
  const [now, setNow] = useState(() => Date.now())
  const [flash, setFlash] = useState<CharadesOutcome | null>(null)
  const flashTimer = useRef<number | null>(null)
  const lastTick = useRef<number | null>(null)
  const remaining = Math.max(0, Math.ceil(((session.deadlineMs ?? now) - now) / 1_000))

  const record = useCallback((outcome: CharadesOutcome) => {
    const before = charadesStore.getState().session
    if (!before || before.phase !== 'ACTIVE') return
    const count = before.currentEvents.length
    charadesStore.getState().submitOutcome(outcome, before.currentCardToken, Date.now())
    const after = charadesStore.getState().session
    if (!after || after.currentEvents.length !== count + 1) return
    devices.playOutcome(outcome)
    setFlash(outcome)
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 160)
  }, [devices])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      charadesStore.getState().syncClock(time)
    }, 200)
    const reconcile = () => charadesStore.getState().syncClock(Date.now())
    window.addEventListener('focus', reconcile)
    window.addEventListener('pageshow', reconcile)
    document.addEventListener('visibilitychange', reconcile)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', reconcile)
      window.removeEventListener('pageshow', reconcile)
      document.removeEventListener('visibilitychange', reconcile)
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') record('pass')
      if (event.key === 'ArrowRight') record('correct')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [record])

  useEffect(() => {
    if (remaining >= 1 && remaining <= 10 && lastTick.current !== remaining) {
      devices.playCountdown(remaining)
      lastTick.current = remaining
    }
  }, [devices, remaining])

  return <main className="charades-active-screen">
    <button className="tap-zone tap-zone--pass" type="button" aria-label="Pass" onClick={() => record('pass')}><span>Pass</span></button>
    <button className="tap-zone tap-zone--correct" type="button" aria-label="Correct" onClick={() => record('correct')}><span>Correct</span></button>
    <div className="charades-hud">
      <button className="text-button" type="button" onClick={onExit}>Exit</button>
      <strong className={remaining <= 10 ? 'charades-timer charades-timer--urgent' : 'charades-timer'}>{remaining}</strong>
      <span>{deviceStatus.motion === 'armed' ? 'Tilt ready' : 'Tap controls'}</span>
    </div>
    <div className="charades-card" aria-live="polite">
      {session.settings.mode === 'henyo' && <span className="charades-category">{categoryLabels[session.currentCard?.category ?? 'other']}</span>}
      <h1>{session.currentCard?.word}</h1>
      {session.settings.mode === 'one-word' && <p>One word per clue-giver</p>}
    </div>
    {session.settings.mode === 'henyo' && <div className="henyo-controls">
      {session.settings.henyoTapAnswersEnabled && <>
        <button type="button" className="henyo-answer henyo-answer--yes" onClick={(event) => { event.stopPropagation(); devices.playAnswer('yes') }}>Oo / Yes</button>
        <button type="button" className="henyo-answer henyo-answer--no" onClick={(event) => { event.stopPropagation(); devices.playAnswer('no') }}>Hindi / No</button>
        <button type="button" className="henyo-answer henyo-answer--maybe" onClick={(event) => { event.stopPropagation(); devices.playAnswer('maybe') }}>Pwede / Maybe</button>
      </>}
      <button type="button" className="henyo-foul" onClick={(event) => { event.stopPropagation(); charadesStore.getState().applyFoul(Date.now()); devices.playFoul() }}>Foul (-5s)</button>
    </div>}
    <div className="portrait-prompt">Rotate to landscape if you can</div>
    {flash && <div className={`charades-flash charades-flash--${flash}`} role="status">{flash === 'correct' ? 'Correct!' : 'Passed'}</div>}
  </main>
}
