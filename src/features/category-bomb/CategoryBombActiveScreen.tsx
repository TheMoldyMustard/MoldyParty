import { useCallback, useEffect, useRef, useState } from 'react'
import { getCategoryBombArrowAngle, type CategoryBombRound } from '../../domain/categoryBomb'
import { categoryBombStore } from '../../store/categoryBombStore'
import type { CategoryBombDeviceController } from './useCategoryBombDevices'

interface CategoryBombActiveScreenProps {
  round: CategoryBombRound
  devices: CategoryBombDeviceController
  onExit: () => void
}

export default function CategoryBombActiveScreen({ round, devices, onExit }: CategoryBombActiveScreenProps) {
  const [awardMs, setAwardMs] = useState(0)
  const [holdingFoul, setHoldingFoul] = useState(false)
  const awardTimer = useRef<number | null>(null)
  const foulTimer = useRef<number | null>(null)
  const acceptLocked = useRef(false)
  const acceptLockTimer = useRef<number | null>(null)
  const currentPlayer = round.settings.players.find((player) => player.id === round.currentPlayerId)

  const cancelFoul = useCallback(() => {
    if (foulTimer.current !== null) window.clearTimeout(foulTimer.current)
    foulTimer.current = null
    setHoldingFoul(false)
  }, [])

  const beginFoul = useCallback(() => {
    if (foulTimer.current !== null) return
    setHoldingFoul(true)
    const token = round.actionToken
    foulTimer.current = window.setTimeout(() => {
      foulTimer.current = null
      setHoldingFoul(false)
      categoryBombStore.getState().callFoul(token, Date.now())
    }, 600)
  }, [round.actionToken])

  const accept = useCallback(() => {
    if (acceptLocked.current) return
    const before = categoryBombStore.getState().round
    if (!before || before.phase !== 'ACTIVE' || before.actionToken !== round.actionToken) return
    acceptLocked.current = true
    if (acceptLockTimer.current !== null) window.clearTimeout(acceptLockTimer.current)
    acceptLockTimer.current = window.setTimeout(() => { acceptLocked.current = false }, 350)
    categoryBombStore.getState().acceptAnswer(round.actionToken, Date.now())
    const after = categoryBombStore.getState().round
    if (!after || after.actionToken === before.actionToken) return
    devices.playAccept()
    if (after.lastAppliedPassBonusMs > 0) {
      setAwardMs(after.lastAppliedPassBonusMs)
      if (awardTimer.current !== null) window.clearTimeout(awardTimer.current)
      awardTimer.current = window.setTimeout(() => setAwardMs(0), 300)
    }
  }, [devices, round.actionToken])

  useEffect(() => {
    const sync = () => categoryBombStore.getState().syncClock(Date.now())
    const syncVisibility = () => {
      sync()
      if (document.visibilityState !== 'visible') cancelFoul()
    }
    const interval = window.setInterval(sync, 200)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    document.addEventListener('visibilitychange', syncVisibility)
    window.addEventListener('blur', cancelFoul)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
      document.removeEventListener('visibilitychange', syncVisibility)
      window.removeEventListener('blur', cancelFoul)
      if (awardTimer.current !== null) window.clearTimeout(awardTimer.current)
      if (foulTimer.current !== null) window.clearTimeout(foulTimer.current)
      if (acceptLockTimer.current !== null) window.clearTimeout(acceptLockTimer.current)
    }
  }, [cancelFoul])

  if (!currentPlayer) return null
  const arrowAngle = getCategoryBombArrowAngle(round)
  return <main className={`category-bomb-active category-bomb-active--${round.displayMode}`}>
    <button className="text-button category-bomb-active__exit" type="button" onClick={onExit}>Exit</button>
    <div className="category-bomb-active__category"><span>Category</span><strong>{round.categoryLabel}</strong></div>

    {round.displayMode === 'radial' ? <div className="category-bomb-board category-bomb-board--active">
      {round.settings.players.map((player) => <div data-testid="category-bomb-active-seat" className={`category-bomb-seat category-bomb-seat--${player.seat}${player.id === round.currentPlayerId ? ' category-bomb-seat--active' : ''}`} key={player.id} aria-label={player.name}>{player.name}</div>)}
      <div data-testid="category-bomb-arrow" className="category-bomb-arrow" style={{ rotate: `${arrowAngle ?? 0}deg` }} aria-hidden="true" />
      <button className="category-bomb-button" type="button" aria-label={`Accept ${currentPlayer.name}'s answer and pass`} onClick={accept}>
        <span className="category-bomb-button__icon" aria-hidden="true">💣</span>
        <strong className="category-bomb-current-status" role="status">{currentPlayer.name}'s turn</strong>
        <span className="category-bomb-button__prompt">Tap after a valid answer</span>
      </button>
    </div> : <div className="category-bomb-name-only">
      <span>Pass to</span>
      <h1 aria-live="polite">{currentPlayer.name}</h1>
      <button className="category-bomb-button" type="button" aria-label={`Accept ${currentPlayer.name}'s answer and pass`} onClick={accept}><span className="category-bomb-button__icon" aria-hidden="true">💣</span><span className="category-bomb-button__prompt">Tap after a valid answer</span></button>
    </div>}

    <button
      className={`category-bomb-foul${holdingFoul ? ' category-bomb-foul--holding' : ''}`}
      type="button"
      aria-label={`Hold to explode ${currentPlayer.name} for an invalid or repeated answer`}
      onPointerDown={beginFoul}
      onPointerUp={cancelFoul}
      onPointerLeave={cancelFoul}
      onPointerCancel={cancelFoul}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cancelFoul()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); cancelFoul(); return }
        if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); beginFoul() }
      }}
      onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') cancelFoul() }}
      onBlur={cancelFoul}
    >{holdingFoul ? 'Keep holding…' : 'Hold: invalid or repeated'}</button>
    {awardMs > 0 && <div className="category-bomb-award" role="status">+{awardMs / 1_000}s</div>}
  </main>
}
