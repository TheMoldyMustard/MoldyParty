import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_ROULETTE_NAMES,
  nextRouletteRotationDegrees,
  rouletteSectorCenterDegrees,
  selectRouletteIndex,
  validateRouletteNames,
} from '../../domain/roulette'
import type { RouletteRosterOption } from './sessionRosters'

interface RouletteScreenProps {
  onBack: () => void
  rosterOptions?: RouletteRosterOption[]
  random?: () => number
  spinDurationMs?: number
}

interface NameDraft {
  id: number
  name: string
}

const WHEEL_COLORS = ['#c7f36b', '#ff8d83', '#b59cff', '#ffcf70', '#7fd9c4', '#f398d0', '#8fc7ff', '#f4efcf']
const NUMBERED_SECTOR_THRESHOLD = 8

function pointOnWheel(angleDegrees: number, radius: number) {
  const radians = (angleDegrees - 90) * Math.PI / 180
  return { x: 100 + radius * Math.cos(radians), y: 100 + radius * Math.sin(radians) }
}

function sectorPath(index: number, count: number) {
  const step = 360 / count
  const start = pointOnWheel(index * step, 94)
  const end = pointOnWheel((index + 1) * step, 94)
  const largeArc = step > 180 ? 1 : 0
  return `M 100 100 L ${start.x} ${start.y} A 94 94 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

function visibleWheelLabel(name: string, index: number, count: number) {
  if (count > NUMBERED_SECTOR_THRESHOLD) return String(index + 1)
  return Array.from(name).length > 12 ? `${Array.from(name).slice(0, 11).join('')}…` : name
}

export default function RouletteScreen({
  onBack,
  rosterOptions = [],
  random = Math.random,
  spinDurationMs = 3_500,
}: RouletteScreenProps) {
  const nextDraftId = useRef(2)
  const completionTimer = useRef<number | null>(null)
  const spinToken = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const winnerRef = useRef<HTMLHeadingElement>(null)
  const [drafts, setDrafts] = useState<NameDraft[]>([{ id: 0, name: '' }, { id: 1, name: '' }])
  const [selectedRosterId, setSelectedRosterId] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)

  const validation = useMemo(() => validateRouletteNames(drafts.map((draft) => draft.name)), [drafts])
  const wheelNames = validation.errors.length === 0 ? validation.names : []

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, left: 0 })
  }, [])

  useEffect(() => () => {
    spinToken.current += 1
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current)
  }, [])

  useEffect(() => {
    if (errors.length > 0) errorRef.current?.focus()
  }, [errors])

  useEffect(() => {
    if (winner) winnerRef.current?.focus()
  }, [winner])

  function clearResult() {
    spinToken.current += 1
    if (completionTimer.current !== null) window.clearTimeout(completionTimer.current)
    completionTimer.current = null
    setSpinning(false)
    setWinner(null)
    setErrors([])
    setAnnouncement('')
  }

  function replaceNames(names: string[]) {
    clearResult()
    setDrafts(names.map((name) => ({ id: nextDraftId.current++, name })))
  }

  function importRoster() {
    const option = rosterOptions.find((candidate) => candidate.id === selectedRosterId)
    if (!option) return
    replaceNames(option.names)
    setErrors(validateRouletteNames(option.names).errors)
    setAnnouncement(`Copied ${option.names.length} names from ${option.label}.`)
  }

  function updateName(id: number, value: string) {
    clearResult()
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, name: value } : draft))
  }

  function addName() {
    if (drafts.length >= MAX_ROULETTE_NAMES) return
    clearResult()
    setDrafts((current) => [...current, { id: nextDraftId.current++, name: '' }])
  }

  function removeName(id: number) {
    if (drafts.length <= 2) return
    clearResult()
    setDrafts((current) => current.filter((draft) => draft.id !== id))
  }

  function finishSpin(token: number, selectedName: string) {
    if (token !== spinToken.current) return
    completionTimer.current = null
    setSpinning(false)
    setWinner(selectedName)
    setAnnouncement(`The wheel picked ${selectedName}.`)
  }

  function spin() {
    if (spinning) return
    const result = validateRouletteNames(drafts.map((draft) => draft.name))
    if (result.errors.length > 0) {
      setErrors(result.errors)
      setAnnouncement('Fix the name list before spinning.')
      return
    }

    setErrors([])
    setWinner(null)
    setAnnouncement('The wheel is spinning.')
    const selectedIndex = selectRouletteIndex(result.names.length, random)
    setRotation((current) => nextRouletteRotationDegrees(current, selectedIndex, result.names.length))
    setSpinning(true)
    const token = ++spinToken.current
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    completionTimer.current = window.setTimeout(
      () => finishSpin(token, result.names[selectedIndex]),
      reducedMotion ? 0 : spinDurationMs,
    )
  }

  return <main className="screen screen--roulette">
    <nav className="topbar"><button className="text-button" type="button" onClick={onBack}>← MoldyParty</button><span>Quick picker</span></nav>
    <header className="screen-heading"><span className="eyebrow">Leave it to chance</span><h1 ref={headingRef} tabIndex={-1}>Name Roulette</h1><p>Enter names or borrow a saved session roster, then spin to pick one.</p></header>

    <div className="roulette-layout">
      <section className="roulette-setup" aria-labelledby="roulette-names-title">
        {rosterOptions.length > 0 && <div className="roulette-session-picker">
          <label htmlFor="roulette-session-roster">Pick names from a saved session</label>
          <div className="roulette-session-picker__controls">
            <select id="roulette-session-roster" aria-label="Saved session roster" value={selectedRosterId} disabled={spinning} onChange={(event) => setSelectedRosterId(event.target.value)}>
              <option value="">Choose a session</option>
              {rosterOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <button className="button button--secondary" type="button" disabled={!selectedRosterId || spinning} onClick={importRoster}>Use session names</button>
          </div>
        </div>}

        <div className="section-heading"><div><span className="step-number">01</span><h2 id="roulette-names-title">Who’s on the wheel?</h2></div><span className="muted">2–{MAX_ROULETTE_NAMES} names</span></div>
        <div className="player-list roulette-name-list">
          {drafts.map((draft, index) => <div className="player-input" key={draft.id}>
            <span className="player-number" aria-hidden="true">{index + 1}</span>
            <label className="sr-only" htmlFor={`roulette-name-${draft.id}`}>Name {index + 1}</label>
            <input
              id={`roulette-name-${draft.id}`}
              value={draft.name}
              placeholder={`Name ${index + 1}`}
              autoComplete="off"
              disabled={spinning}
              onChange={(event) => updateName(draft.id, event.target.value)}
            />
            {drafts.length > 2 && <button className="icon-button" type="button" disabled={spinning} aria-label={`Remove name ${index + 1}`} onClick={() => removeName(draft.id)}>×</button>}
          </div>)}
        </div>
        <button className="button button--secondary button--wide" type="button" aria-label="Add name" disabled={spinning || drafts.length >= MAX_ROULETTE_NAMES} onClick={addName}>＋ Add name</button>
        {errors.length > 0 && <div className="error-box" role="alert" tabIndex={-1} ref={errorRef}>{errors.map((error) => <p key={error}>{error}</p>)}</div>}
      </section>

      <section className="roulette-stage" aria-labelledby="roulette-wheel-title">
        <div className="section-heading"><div><span className="step-number">02</span><h2 id="roulette-wheel-title">Spin the wheel</h2></div></div>
        {wheelNames.length >= 2 ? <div className="roulette-wheel-wrap">
          <span className="roulette-pointer" aria-hidden="true" />
          <svg className={`roulette-wheel${spinning ? ' roulette-wheel--spinning' : ''}`} viewBox="0 0 200 200" role="img" aria-label={`Roulette wheel with ${wheelNames.length} names`} style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${spinDurationMs}ms` }}>
            {wheelNames.map((name, index) => {
              const center = rouletteSectorCenterDegrees(index, wheelNames.length)
              const useNumberLabels = wheelNames.length > NUMBERED_SECTOR_THRESHOLD
              const labelPoint = pointOnWheel(center, useNumberLabels ? 73 : 61)
              return <g key={`${index}-${name}`}>
                <path d={sectorPath(index, wheelNames.length)} fill={WHEEL_COLORS[index % WHEEL_COLORS.length]} stroke="#24112f" strokeWidth="1"><title>{name}</title></path>
                <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" className={useNumberLabels ? 'roulette-wheel__number' : 'roulette-wheel__label'}>{visibleWheelLabel(name, index, wheelNames.length)}</text>
              </g>
            })}
            <circle cx="100" cy="100" r="13" fill="#24112f" />
            <circle cx="100" cy="100" r="6" fill="#fff5d7" />
          </svg>
        </div> : <div className="roulette-placeholder"><span aria-hidden="true">◌</span><p>Fill in at least two unique names to build the wheel.</p></div>}

        {winner && <div className="roulette-winner"><span>Winner</span><h2 tabIndex={-1} ref={winnerRef}>{winner} wins!</h2></div>}
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
        <button className="button button--hero button--wide" type="button" disabled={spinning} onClick={spin}>{winner ? 'Spin again' : spinning ? 'Spinning…' : 'Spin the wheel'}</button>
      </section>
    </div>
  </main>
}
