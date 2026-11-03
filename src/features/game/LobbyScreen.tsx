import { useEffect, useMemo, useState } from 'react'
import { builtInPacks } from '../../domain/builtInPacks'
import { validateSetup } from '../../domain/game'
import type { GameSetupInput, WordPack } from '../../domain/types'
import { packRepository } from '../packs/packDb'
import { useGameStore } from '../../store/gameStore'
import CategoryPicker from './CategoryPicker'
import PlayerEditor from './PlayerEditor'

export interface LobbyDraft {
  playerNames: string[]
  impostorCount: number
  hintsEnabled: boolean
  jesterEnabled: boolean
  outlierEnabled: boolean
  outlierHintsEnabled: boolean
  timerEnabled: boolean
  timerMinutes: number
  selectedPackId: string
}

interface LobbyScreenProps {
  draft: LobbyDraft | null
  onDraftChange: (draft: LobbyDraft) => void
  onBack: () => void
  onManagePacks: () => void
}

function draftFromSetup(setup: GameSetupInput | null): LobbyDraft {
  return {
    playerNames: setup?.playerNames ?? ['', '', ''],
    impostorCount: setup?.impostorCount ?? 1,
    hintsEnabled: setup?.hintsEnabled ?? true,
    jesterEnabled: setup?.jesterEnabled ?? false,
    outlierEnabled: setup?.outlierEnabled ?? false,
    outlierHintsEnabled: setup?.outlierHintsEnabled ?? false,
    timerEnabled: setup?.discussionDurationSeconds !== null,
    timerMinutes: Math.max(1, Math.round((setup?.discussionDurationSeconds ?? 180) / 60)),
    selectedPackId: setup?.pack.id ?? builtInPacks[0].id,
  }
}

export default function LobbyScreen({ draft: savedDraft, onDraftChange, onBack, onManagePacks }: LobbyScreenProps) {
  const previousSetup = useGameStore((state) => state.setup)
  const startGame = useGameStore((state) => state.startGame)
  const [draft, setDraft] = useState<LobbyDraft>(() => savedDraft ?? draftFromSetup(previousSetup))
  const [customPacks, setCustomPacks] = useState<WordPack[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const packs = useMemo(() => [...builtInPacks, ...customPacks], [customPacks])

  useEffect(() => {
    let active = true
    void packRepository.list().then((saved) => { if (active) setCustomPacks(saved) })
    return () => { active = false }
  }, [])

  function updateDraft(next: LobbyDraft) {
    setDraft(next)
    onDraftChange(next)
  }

  function updatePlayerNames(playerNames: string[]) {
    updateDraft({
      ...draft,
      playerNames,
      impostorCount: Math.min(draft.impostorCount, Math.max(1, playerNames.length - 1)),
    })
  }

  function submit() {
    const pack = packs.find((candidate) => candidate.id === draft.selectedPackId) ?? packs[0]
    const setup = {
      playerNames: draft.playerNames,
      impostorCount: draft.impostorCount,
      pack,
      hintsEnabled: draft.hintsEnabled,
      jesterEnabled: draft.jesterEnabled,
      outlierEnabled: draft.outlierEnabled,
      outlierHintsEnabled: draft.outlierEnabled && draft.outlierHintsEnabled,
      discussionDurationSeconds: draft.timerEnabled ? draft.timerMinutes * 60 : null,
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
        <PlayerEditor names={draft.playerNames} onChange={updatePlayerNames} />
        <CategoryPicker packs={packs} selectedId={draft.selectedPackId} onSelect={(selectedPackId) => updateDraft({ ...draft, selectedPackId })} onManagePacks={onManagePacks} />
        <section className="setup-section" aria-labelledby="rules-title">
          <div className="section-heading"><div><span className="step-number">03</span><h2 id="rules-title">Round rules</h2></div></div>
          <div className="rule-grid">
            <label>Impostors<select value={draft.impostorCount} onChange={(event) => updateDraft({ ...draft, impostorCount: Number(event.target.value) })}>
              {Array.from({ length: Math.max(1, draft.playerNames.length - 1) }, (_, index) => <option key={index + 1}>{index + 1}</option>)}
            </select></label>
            <label className="switch-row"><span><strong>Impostor hints</strong><small>Show a broad clue</small></span><input type="checkbox" checked={draft.hintsEnabled} onChange={(event) => updateDraft({ ...draft, hintsEnabled: event.target.checked })} /></label>
            <label className="switch-row"><span><strong>Jester</strong><small>Wins by getting voted out</small></span><input aria-label="Jester" type="checkbox" checked={draft.jesterEnabled} onChange={(event) => updateDraft({ ...draft, jesterEnabled: event.target.checked })} /></label>
            <label className="switch-row"><span><strong>Outlier</strong><small>Wins by guessing the word</small></span><input aria-label="Outlier" type="checkbox" checked={draft.outlierEnabled} onChange={(event) => updateDraft({ ...draft, outlierEnabled: event.target.checked, outlierHintsEnabled: event.target.checked ? draft.outlierHintsEnabled : false })} /></label>
            {draft.outlierEnabled && <label className="switch-row"><span><strong>Give Outlier a hint</strong><small>Show the selected broad clue</small></span><input aria-label="Give Outlier a hint" type="checkbox" checked={draft.outlierHintsEnabled} onChange={(event) => updateDraft({ ...draft, outlierHintsEnabled: event.target.checked })} /></label>}
            <label className="switch-row"><span><strong>Discussion timer</strong><small>Manual voting is always available</small></span><input type="checkbox" checked={draft.timerEnabled} onChange={(event) => updateDraft({ ...draft, timerEnabled: event.target.checked })} /></label>
            {draft.timerEnabled && <label>Timer minutes<input type="number" min="1" max="60" value={draft.timerMinutes} onChange={(event) => updateDraft({ ...draft, timerMinutes: Math.max(1, Number(event.target.value)) })} /></label>}
          </div>
        </section>
      </div>
      {errors.length > 0 && <div className="error-box" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
      <button className="button button--hero" type="button" onClick={submit}>Start secret round <span aria-hidden="true">→</span></button>
    </main>
  )
}
