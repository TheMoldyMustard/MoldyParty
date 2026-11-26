import { useEffect, useMemo, useState } from 'react'
import { MODE_POLICIES, validateCharadesSettings, type CharadesMode, type CharadesPlayer, type CharadesSettings } from '../../domain/charades'
import { builtInPacks } from '../../domain/builtInPacks'
import { eligibleItems, getItemCategory, isPackUsableFor } from '../../domain/packCompatibility'
import type { CharadesCategory, CharadesVibe, WordPack } from '../../domain/types'
import { charadesStore } from '../../store/charadesStore'
import { appStore } from '../../store/appStore'
import { usePreferencesStore } from '../../store/preferencesStore'
import { packRepository } from '../packs/packDb'
import { noRepeatHistory } from './noRepeatHistory'

interface CharadesSetupScreenProps {
  onBack: () => void
  onManagePacks: () => void
  preferredPackId?: string | null
  initialSettings?: CharadesSettings
  initialPlayers?: CharadesPlayer[]
  rosterLocked?: boolean
  legacyTrackingNotice?: boolean
}

const categories: Array<[CharadesCategory, string]> = [
  ['person', 'Person / Tao'], ['place', 'Place / Lugar'], ['object', 'Object / Bagay'],
  ['animal', 'Animal / Hayop'], ['food', 'Food / Pagkain'], ['pop-culture', 'Pop Culture'], ['other', 'Other / Iba'],
]
const vibes: Array<[CharadesVibe, string]> = [
  ['casual', 'Casual'], ['pop-culture-local', 'Pop Culture / Local'], ['chaos-hard', 'Chaos / Hard'],
]

export default function CharadesSetupScreen({ onBack, onManagePacks, preferredPackId, initialSettings, initialPlayers, rosterLocked = false, legacyTrackingNotice = false }: CharadesSetupScreenProps) {
  const startingPlayers = initialPlayers?.length ? initialPlayers : [
    { id: 'charades-player-1', name: 'Player 1' },
    { id: 'charades-player-2', name: 'Player 2' },
  ]
  const [players, setPlayers] = useState<CharadesPlayer[]>(startingPlayers)
  const [mode, setMode] = useState<CharadesMode>(initialSettings?.mode ?? 'classic')
  const [duration, setDuration] = useState<60 | 75 | 90 | 120>(initialSettings?.durationSeconds ?? 60)
  const [customPacks, setCustomPacks] = useState<WordPack[]>([])
  const [packsLoaded, setPacksLoaded] = useState(false)
  const [selectedPackId, setSelectedPackId] = useState(preferredPackId ?? initialSettings?.packId ?? builtInPacks[0].id)
  const [selectedCategories, setSelectedCategories] = useState<CharadesCategory[]>(initialSettings?.categories ?? [])
  const [selectedVibes, setSelectedVibes] = useState<CharadesVibe[]>(initialSettings?.vibes ?? [])
  const [motionEnabled, setMotionEnabled] = useState(initialSettings?.motionEnabled ?? true)
  const [henyoTapAnswersEnabled, setHenyoTapAnswersEnabled] = useState(initialSettings?.henyoTapAnswersEnabled ?? true)
  const [noRepeatEnabled, setNoRepeatEnabled] = useState(initialSettings?.noRepeatEnabled ?? true)
  const [relayRounds, setRelayRounds] = useState<3 | 4 | 5>(initialSettings?.relayRounds ?? 3)
  const [teams, setTeams] = useState([
    { id: initialSettings?.teams?.[0].id ?? 'team-1', name: initialSettings?.teams?.[0].name ?? 'Team A', memberPlayerIds: initialSettings?.teams?.[0].memberPlayerIds ?? startingPlayers.filter((_, index) => index % 2 === 0).map((player) => player.id) },
    { id: initialSettings?.teams?.[1].id ?? 'team-2', name: initialSettings?.teams?.[1].name ?? 'Team B', memberPlayerIds: initialSettings?.teams?.[1].memberPlayerIds ?? startingPlayers.filter((_, index) => index % 2 === 1).map((player) => player.id) },
  ])
  const [errors, setErrors] = useState<string[]>([])
  const soundEnabled = usePreferencesStore((state) => state.soundEnabled)
  const hapticsEnabled = usePreferencesStore((state) => state.hapticsEnabled)
  const setSoundEnabled = usePreferencesStore((state) => state.setSoundEnabled)
  const setHapticsEnabled = usePreferencesStore((state) => state.setHapticsEnabled)

  useEffect(() => {
    let active = true
    void packRepository.list().then((packs) => {
      if (!active) return
      setCustomPacks(packs)
      setPacksLoaded(true)
    })
    return () => { active = false }
  }, [])

  const packs = useMemo(
    () => [...builtInPacks, ...customPacks].filter((pack) => isPackUsableFor(pack, 'charades')),
    [customPacks],
  )

  const packNotice = packsLoaded && !preferredPackId && initialSettings && selectedPackId === initialSettings.packId
    && !packs.some((pack) => pack.id === initialSettings.packId)
    ? `${initialSettings.packName} is no longer available. Choose another pack to start the next game; your session and statistics are still saved.`
    : ''
  const selectedPack = packs.find((pack) => pack.id === selectedPackId)
  const filteredItems = selectedPack ? eligibleItems(selectedPack, 'charades', {
    categories: selectedCategories,
    vibes: selectedVibes,
  }) : []

  function chooseMode(nextMode: CharadesMode) {
    setMode(nextMode)
    setDuration(nextMode === 'henyo' ? 120 : duration === 120 ? 60 : duration)
    setErrors([])
  }

  function toggleValue<T>(value: T, values: T[], update: (next: T[]) => void) {
    update(values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value])
  }

  function start() {
    if (!selectedPack) return
    const settings: CharadesSettings = {
      mode,
      packId: selectedPack.id,
      packName: selectedPack.packName,
      durationSeconds: duration,
      categories: selectedCategories,
      vibes: selectedVibes,
      motionEnabled,
      henyoTapAnswersEnabled: mode === 'henyo' && henyoTapAnswersEnabled,
      noRepeatEnabled,
      players,
      ...(mode === 'team-relay' ? {
        teams: teams.map((team) => ({
          id: team.id,
          name: team.name.trim(),
          memberPlayerIds: team.memberPlayerIds,
          members: team.memberPlayerIds.map((playerId) => players.find((player) => player.id === playerId)?.name ?? '').filter(Boolean),
        })) as CharadesSettings['teams'],
        relayRounds,
      } : {}),
    }
    const nextErrors = validateCharadesSettings(settings, filteredItems.length)
    setErrors(nextErrors)
    if (nextErrors.length > 0) return
    const itemsWithCategories = filteredItems.map((item) => ({
      ...item,
      category: getItemCategory(item, selectedPack.category),
    }))
    charadesStore.getState().startSession(settings, itemsWithCategories)
    appStore.getState().setActiveGame('charades')
  }

  return <main className="screen screen--charades-setup">
    <nav className="topbar"><button className="text-button" type="button" onClick={onBack}>← MoldyParty</button><span>New game</span></nav>
    <header className="screen-heading"><span className="eyebrow">Hold it high. Guess it fast.</span><h1>Forehead Charades</h1><p>Choose a rule set, a shared pack, and how the phone should respond.</p></header>
    {legacyTrackingNotice && <p className="error-box" role="status">This recovered game did not contain player identities. Review and name the roster now; statistics begin with the next completed turn.</p>}
    {packNotice && <p className="error-box" role="status">{packNotice}</p>}

    <section className="setup-section" aria-labelledby="charades-players"><div className="section-heading"><div><span className="step-number">01</span><h2 id="charades-players">Who’s playing?</h2></div></div>
      {rosterLocked && <p className="muted">The roster is locked for this saved session. Modes, teams, packs, and rules can still change.</p>}
      <div className="player-list">{players.map((player, index) => <div className="player-input" key={player.id}>
        <span className="player-number" aria-hidden="true">{index + 1}</span>
        <label className="sr-only" htmlFor={`charades-player-${index}`}>Player {index + 1} name</label>
        <input id={`charades-player-${index}`} value={player.name} disabled={rosterLocked} onChange={(event) => setPlayers((current) => current.map((candidate) => candidate.id === player.id ? { ...candidate, name: [...event.target.value].slice(0, 24).join('') } : candidate))} />
        {!rosterLocked && players.length > 2 && <button className="icon-button" type="button" aria-label={`Remove player ${index + 1}`} onClick={() => {
          setPlayers((current) => current.filter((candidate) => candidate.id !== player.id))
          setTeams((current) => current.map((team) => ({ ...team, memberPlayerIds: team.memberPlayerIds.filter((id) => id !== player.id) })))
        }}>×</button>}
      </div>)}</div>
      {!rosterLocked && <button className="button button--secondary button--wide" type="button" aria-label="Add player" onClick={() => {
        let nextIndex = players.length + 1
        while (players.some((player) => player.id === `charades-player-${nextIndex}`)) nextIndex += 1
        const player = { id: `charades-player-${nextIndex}`, name: `Player ${nextIndex}` }
        setPlayers((current) => [...current, player])
        setTeams((current) => current.map((team, index) => index === players.length % 2 ? { ...team, memberPlayerIds: [...team.memberPlayerIds, player.id] } : team))
      }}>＋ Add player</button>}
    </section>

    <section className="setup-section"><div className="section-heading"><div><span className="step-number">02</span><h2>Choose a mode</h2></div></div>
      <div className="charades-mode-grid">
        {(['classic', 'henyo', 'one-word', 'team-relay'] as CharadesMode[]).map((value) => <label className={mode === value ? 'charades-mode charades-mode--selected' : 'charades-mode'} key={value}>
          <input type="radio" name="charades-mode" checked={mode === value} onChange={() => chooseMode(value)} />
          <strong>{MODE_POLICIES[value].label}</strong>
          <small>{value === 'classic' ? 'Freeform clues and acting' : value === 'henyo' ? 'Oo, Hindi, or Pwede only' : value === 'one-word' ? 'One word from each clue-giver' : 'Two teams, rotating holders'}</small>
        </label>)}
      </div>
    </section>

    <section className="setup-section"><div className="section-heading"><div><span className="step-number">02</span><h2>Pick words</h2></div><button className="text-button" type="button" onClick={onManagePacks}>Manage packs</button></div>
      <div className="charades-pack-grid">{packs.map((pack) => <label className={selectedPack?.id === pack.id ? 'category-option category-option--selected' : 'category-option'} key={pack.id}>
        <input type="radio" name="charades-pack" checked={selectedPack?.id === pack.id} onChange={() => setSelectedPackId(pack.id)} />
        <strong>{pack.packName}</strong><small>{eligibleItems(pack, 'charades').length} cards</small>
      </label>)}</div>
      <fieldset className="filter-pills"><legend>Henyo categories</legend>{categories.map(([value, label]) => <label key={value}><input type="checkbox" aria-label={label} checked={selectedCategories.includes(value)} onChange={() => toggleValue(value, selectedCategories, setSelectedCategories)} /><span>{label}</span></label>)}</fieldset>
      <fieldset className="filter-pills"><legend>Difficulty & vibe</legend>{vibes.map(([value, label]) => <label key={value}><input type="checkbox" aria-label={label} checked={selectedVibes.includes(value)} onChange={() => toggleValue(value, selectedVibes, setSelectedVibes)} /><span>{label}</span></label>)}</fieldset>
      <p className="muted">{filteredItems.length} eligible cards</p>
    </section>

    <section className="setup-section"><div className="section-heading"><div><span className="step-number">03</span><h2>Round controls</h2></div></div>
      {mode === 'henyo' ? <p className="fixed-duration">2:00 fixed</p> : <label>Turn duration<select aria-label="Turn duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as 60 | 75 | 90)}><option value="60">60 seconds</option><option value="75">75 seconds</option><option value="90">90 seconds</option></select></label>}
      <div className="rule-groups">
        <fieldset className="rule-group"><legend>Device</legend>
          <label className="switch-row"><span><strong>Tilt controls</strong><small>Tap controls always remain available</small></span><input aria-label="Tilt controls" type="checkbox" checked={motionEnabled} onChange={(event) => setMotionEnabled(event.target.checked)} /></label>
          <label className="switch-row"><span><strong>Sound</strong><small>Generated in the browser</small></span><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /></label>
          <label className="switch-row"><span><strong>Haptics</strong><small>When supported</small></span><input type="checkbox" checked={hapticsEnabled} onChange={(event) => setHapticsEnabled(event.target.checked)} /></label>
          <label className="switch-row"><span><strong>No repeat words</strong><small>Remember used cards on this device</small></span><input type="checkbox" checked={noRepeatEnabled} onChange={(event) => setNoRepeatEnabled(event.target.checked)} /></label>
          {selectedPack && <button className="text-button" type="button" onClick={() => noRepeatHistory.clear(selectedPack.id)}>Reset used words</button>}
        </fieldset>
        {mode === 'henyo' && <fieldset className="rule-group"><legend>Henyo helpers</legend><label className="switch-row"><span><strong>Tap-to-answer buttons</strong><small>Oo, Hindi, and Pwede chimes</small></span><input type="checkbox" checked={henyoTapAnswersEnabled} onChange={(event) => setHenyoTapAnswersEnabled(event.target.checked)} /></label></fieldset>}
      </div>
      {mode === 'team-relay' && <div className="relay-editor">
        {teams.map((team, index) => <fieldset className="rule-group" key={team.id}><legend>Team {index + 1}</legend>
          <label>Team {index + 1} name<input value={team.name} onChange={(event) => setTeams((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, name: event.target.value } : candidate))} /></label>
        </fieldset>)}
        <fieldset className="rule-group"><legend>Player assignments</legend>{players.map((player) => <label key={player.id}>{player.name} team<select aria-label={`${player.name} team`} value={teams.find((team) => team.memberPlayerIds.includes(player.id))?.id ?? ''} onChange={(event) => setTeams((current) => current.map((team) => ({ ...team, memberPlayerIds: team.id === event.target.value ? [...team.memberPlayerIds.filter((id) => id !== player.id), player.id] : team.memberPlayerIds.filter((id) => id !== player.id) })))}><option value="">Choose team</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>)}</fieldset>
        <label>Relay rounds<select aria-label="Relay rounds" value={relayRounds} onChange={(event) => setRelayRounds(Number(event.target.value) as 3 | 4 | 5)}><option value="3">3 rounds</option><option value="4">4 rounds</option><option value="5">5 rounds</option></select></label>
      </div>}
    </section>
    {errors.length > 0 && <div className="error-box" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    <button className="button button--hero button--wide" type="button" onClick={start}>Start game</button>
  </main>
}
