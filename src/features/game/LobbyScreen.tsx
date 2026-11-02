import { useEffect, useMemo, useState } from 'react'
import { builtInPacks } from '../../domain/builtInPacks'
import { validateSetup } from '../../domain/game'
import type { WordPack } from '../../domain/types'
import { packRepository } from '../packs/packDb'
import { useGameStore } from '../../store/gameStore'
import CategoryPicker from './CategoryPicker'
import PlayerEditor from './PlayerEditor'

interface LobbyScreenProps {
  onBack: () => void
  onManagePacks: () => void
}

export default function LobbyScreen({ onBack, onManagePacks }: LobbyScreenProps) {
  const previousSetup = useGameStore((state) => state.setup)
  const startGame = useGameStore((state) => state.startGame)
  const [playerNames, setPlayerNames] = useState(previousSetup?.playerNames ?? ['', '', ''])
  const [impostorCount, setImpostorCount] = useState(previousSetup?.impostorCount ?? 1)
  const [hintsEnabled, setHintsEnabled] = useState(previousSetup?.hintsEnabled ?? true)
  const [timerEnabled, setTimerEnabled] = useState(previousSetup?.discussionDurationSeconds !== null)
  const [timerMinutes, setTimerMinutes] = useState(Math.max(1, Math.round((previousSetup?.discussionDurationSeconds ?? 180) / 60)))
  const [customPacks, setCustomPacks] = useState<WordPack[]>([])
  const [selectedPackId, setSelectedPackId] = useState(previousSetup?.pack.id ?? builtInPacks[0].id)
  const [errors, setErrors] = useState<string[]>([])
  const packs = useMemo(() => [...builtInPacks, ...customPacks], [customPacks])

  useEffect(() => {
    let active = true
    void packRepository.list().then((saved) => { if (active) setCustomPacks(saved) })
    return () => { active = false }
  }, [])

  function updatePlayerNames(names: string[]) {
    setPlayerNames(names)
    setImpostorCount((current) => Math.min(current, Math.max(1, names.length - 1)))
  }

  function submit() {
    const pack = packs.find((candidate) => candidate.id === selectedPackId) ?? packs[0]
    const setup = {
      playerNames,
      impostorCount,
      pack,
      hintsEnabled,
      discussionDurationSeconds: timerEnabled ? timerMinutes * 60 : null,
    }
    const nextErrors = validateSetup(setup)
    setErrors(nextErrors)
    if (nextErrors.length === 0) startGame(setup)
  }

  return (
    <main className="screen screen--lobby">
      <nav className="topbar"><button className="text-button" type="button" onClick={onBack}>← MoldyParty</button><span>Impostor setup</span></nav>
      <header className="screen-heading"><span className="eyebrow">Build your round</span><h1>Who can you trust?</h1><p>Set up the table, then pass the device around.</p></header>
      <div className="setup-layout">
        <PlayerEditor names={playerNames} onChange={updatePlayerNames} />
        <CategoryPicker packs={packs} selectedId={selectedPackId} onSelect={setSelectedPackId} onManagePacks={onManagePacks} />
        <section className="setup-section" aria-labelledby="rules-title">
          <div className="section-heading"><div><span className="step-number">03</span><h2 id="rules-title">Round rules</h2></div></div>
          <div className="rule-grid">
            <label>Impostors<select value={impostorCount} onChange={(event) => setImpostorCount(Number(event.target.value))}>
              {Array.from({ length: Math.max(1, playerNames.length - 1) }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
            </select></label>
            <label className="switch-row"><span><strong>Impostor hints</strong><small>Show a broad clue</small></span><input type="checkbox" checked={hintsEnabled} onChange={(event) => setHintsEnabled(event.target.checked)} /></label>
            <label className="switch-row"><span><strong>Discussion timer</strong><small>Manual voting is always available</small></span><input type="checkbox" checked={timerEnabled} onChange={(event) => setTimerEnabled(event.target.checked)} /></label>
            {timerEnabled && <label>Timer minutes<input type="number" min="1" max="60" value={timerMinutes} onChange={(event) => setTimerMinutes(Math.max(1, Number(event.target.value)))} /></label>}
          </div>
        </section>
      </div>
      {errors.length > 0 && <div className="error-box" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
      <button className="button button--hero" type="button" onClick={submit}>Start secret round <span aria-hidden="true">→</span></button>
    </main>
  )
}
