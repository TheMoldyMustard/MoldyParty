import { useState } from 'react'
import { deriveCategoryBombDisplayMode, validateCategoryBombSettings, type CategoryBombTurnPolicy } from '../../domain/categoryBomb'
import { categoryBombStore, DEFAULT_CATEGORY_BOMB_PASS_TIME_BONUS } from '../../store/categoryBombStore'
import { appStore } from '../../store/appStore'
import { usePreferencesStore } from '../../store/preferencesStore'

interface CategoryBombSetupScreenProps {
  onBack: () => void
  initialPlayerNames?: string[]
  initialTurnPolicy?: CategoryBombTurnPolicy
  initialPassTimeBonusEnabled?: boolean
  initialPassTimeBonusMinSeconds?: number
  initialPassTimeBonusMaxSeconds?: number
}

export default function CategoryBombSetupScreen({
  onBack,
  initialPlayerNames = ['', '', ''],
  initialTurnPolicy = 'fair-cycle',
  initialPassTimeBonusEnabled = false,
  initialPassTimeBonusMinSeconds = 0.5,
  initialPassTimeBonusMaxSeconds = 3,
}: CategoryBombSetupScreenProps) {
  const [names, setNames] = useState(initialPlayerNames)
  const [turnPolicy, setTurnPolicy] = useState<CategoryBombTurnPolicy>(initialTurnPolicy)
  const [passTimeBonusEnabled, setPassTimeBonusEnabled] = useState(initialPassTimeBonusEnabled)
  const [passTimeBonusMinSeconds, setPassTimeBonusMinSeconds] = useState(String(initialPassTimeBonusMinSeconds))
  const [passTimeBonusMaxSeconds, setPassTimeBonusMaxSeconds] = useState(String(initialPassTimeBonusMaxSeconds))
  const [errors, setErrors] = useState<string[]>([])
  const soundEnabled = usePreferencesStore((state) => state.soundEnabled)
  const hapticsEnabled = usePreferencesStore((state) => state.hapticsEnabled)
  const setSoundEnabled = usePreferencesStore((state) => state.setSoundEnabled)
  const setHapticsEnabled = usePreferencesStore((state) => state.setHapticsEnabled)
  const displayMode = deriveCategoryBombDisplayMode(names.length)

  function start() {
    const enteredMinMs = passTimeBonusMinSeconds.trim() === '' ? Number.NaN : Number(passTimeBonusMinSeconds) * 1_000
    const enteredMaxMs = passTimeBonusMaxSeconds.trim() === '' ? Number.NaN : Number(passTimeBonusMaxSeconds) * 1_000
    const enteredRangeIsValid = [enteredMinMs, enteredMaxMs].every((value) => (
      Number.isFinite(value) && value >= 0 && value <= 10_000 && Number.isInteger(value / 100)
    )) && enteredMinMs <= enteredMaxMs
    const passTimeBonusMinMs = !passTimeBonusEnabled && !enteredRangeIsValid
      ? DEFAULT_CATEGORY_BOMB_PASS_TIME_BONUS.minMs
      : enteredMinMs
    const passTimeBonusMaxMs = !passTimeBonusEnabled && !enteredRangeIsValid
      ? DEFAULT_CATEGORY_BOMB_PASS_TIME_BONUS.maxMs
      : enteredMaxMs
    const settings = {
      turnPolicy,
      passTimeBonusEnabled,
      passTimeBonusMinMs,
      passTimeBonusMaxMs,
      players: names.map((name, index) => ({ id: `category-player-${index + 1}`, name, seat: null })),
    }
    const nextErrors = validateCategoryBombSettings(settings)
    setErrors(nextErrors)
    if (nextErrors.length > 0) return
    categoryBombStore.getState().startSetup(names, turnPolicy, {
      enabled: passTimeBonusEnabled,
      minMs: settings.passTimeBonusMinMs,
      maxMs: settings.passTimeBonusMaxMs,
    })
    appStore.getState().setActiveGame('category-bomb')
  }

  return <main className="screen screen--category-bomb-setup">
    <nav className="topbar"><button className="text-button" type="button" onClick={onBack}>← MoldyParty</button><span>New game</span></nav>
    <header className="screen-heading"><span className="eyebrow">Think fast. Pass faster.</span><h1>Category Bomb</h1><p>Name something that fits, tap the bomb, and pass the phone before it explodes.</p></header>

    <section className="setup-section" aria-labelledby="category-bomb-players">
      <div className="section-heading"><div><span className="step-number">01</span><h2 id="category-bomb-players">Who’s playing?</h2></div><span className="muted">2 minimum · 24 characters</span></div>
      <div className="player-list category-bomb-player-list">
        {names.map((name, index) => <div className="player-input" key={index}>
          <span className="player-number" aria-hidden="true">{index + 1}</span>
          <label className="sr-only" htmlFor={`category-player-${index}`}>Player {index + 1} name</label>
          <input id={`category-player-${index}`} value={name} placeholder={`Player ${index + 1}`} autoComplete="off" onChange={(event) => {
            const nextName = [...event.target.value].slice(0, 24).join('')
            setNames((current) => current.map((item, itemIndex) => itemIndex === index ? nextName : item))
          }} />
          {names.length > 2 && <button className="icon-button" type="button" aria-label={`Remove player ${index + 1}`} onClick={() => setNames((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
        </div>)}
      </div>
      <button className="button button--secondary button--wide" type="button" aria-label="Add player" onClick={() => setNames((current) => [...current, ''])}>＋ Add player</button>
    </section>

    <section className="setup-section" aria-labelledby="category-bomb-layout">
      <div className="section-heading"><div><span className="step-number">02</span><h2 id="category-bomb-layout">Screen layout</h2></div></div>
      <div className={`category-bomb-mode-notice category-bomb-mode-notice--${displayMode}`} aria-live="polite">
        <strong>{displayMode === 'radial' ? 'Radial board' : 'Large group — current name only'}</strong>
        <p>{displayMode === 'radial' ? 'Arrange names around the phone so the arrow points toward each person.' : 'For 13+ players, the arrow and seating board are hidden. Pass the phone to the large name shown.'}</p>
      </div>
    </section>

    <section className="setup-section" aria-labelledby="category-bomb-rules">
      <div className="section-heading"><div><span className="step-number">03</span><h2 id="category-bomb-rules">Turn rules</h2></div></div>
      <fieldset className="rule-group"><legend>Picking players</legend>
        <label className="switch-row"><span><strong>Fair cycle</strong><small>Everyone plays once before the list reshuffles</small></span><input type="radio" name="category-turn-policy" checked={turnPolicy === 'fair-cycle'} onChange={() => setTurnPolicy('fair-cycle')} /></label>
        <label className="switch-row"><span><strong>Chaos</strong><small>Anyone except the current player may be next</small></span><input type="radio" name="category-turn-policy" checked={turnPolicy === 'chaos'} onChange={() => setTurnPolicy('chaos')} /></label>
      </fieldset>
      <fieldset className="rule-group"><legend>Pass timing</legend>
        <label className="switch-row"><span><strong>Add random time on pass</strong><small>Off by default · 15 seconds maximum added per bomb</small></span><input type="checkbox" checked={passTimeBonusEnabled} onChange={(event) => setPassTimeBonusEnabled(event.target.checked)} /></label>
        <label className={!passTimeBonusEnabled ? 'field--disabled' : undefined}>Minimum seconds<input aria-label="Minimum seconds" type="number" min="0" max="10" step="0.1" disabled={!passTimeBonusEnabled} value={passTimeBonusMinSeconds} onChange={(event) => setPassTimeBonusMinSeconds(event.target.value)} /></label>
        <label className={!passTimeBonusEnabled ? 'field--disabled' : undefined}>Maximum seconds<input aria-label="Maximum seconds" type="number" min="0" max="10" step="0.1" disabled={!passTimeBonusEnabled} value={passTimeBonusMaxSeconds} onChange={(event) => setPassTimeBonusMaxSeconds(event.target.value)} /></label>
      </fieldset>
      <fieldset className="rule-group"><legend>Device</legend>
        <label className="switch-row"><span><strong>Sound</strong><small>Generated in the browser</small></span><input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /></label>
        <label className="switch-row"><span><strong>Haptics</strong><small>When supported</small></span><input type="checkbox" checked={hapticsEnabled} onChange={(event) => setHapticsEnabled(event.target.checked)} /></label>
      </fieldset>
    </section>

    {errors.length > 0 && <div className="error-box" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    <button className="button button--hero button--wide" type="button" onClick={start}>{displayMode === 'radial' ? 'Arrange players' : 'Start large-group game'}</button>
  </main>
}
