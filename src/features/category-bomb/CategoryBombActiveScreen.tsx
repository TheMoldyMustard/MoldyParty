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
  const [awardVisible, setAwardVisible] = useState(false)
  const [holdingFoul, setHoldingFoul] = useState(false)
  const awardTimer = useRef<number | null>(null)
  const foulTimer = useRef<number | null>(null)
  const currentPlayer = round.settings.players.find((player) => player.id === round.currentPlayerId)!

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
    const before = categoryBombStore.getState().round
    if (!before || before.phase !== 'ACTIVE') return
    categoryBombStore.getState().acceptAnswer(before.actionToken, Date.now())
    const after = categoryBombStore.getState().round
    if (!after || after.actionToken === before.actionToken) return
    devices.playAccept()
    if (after.extensionGrantedMs > before.extensionGrantedMs) {
      setAwardVisible(true)
      if (awardTimer.current !== null) window.clearTimeout(awardTimer.current)
      awardTimer.current = window.setTimeout(() => setAwardVisible(false), 300)
    }
  }, [devices])

  useEffect(() => {
    const sync = () => categoryBombStore.getState().syncClock(Date.now())
    const interval = window.setInterval(sync, 200)
    window.addEventListener('focus', sync)
    window.addEventListener('pageshow', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', sync)
      window.removeEventListener('pageshow', sync)
      document.removeEventListener('visibilitychange', sync)
      if (awardTimer.current !== null) window.clearTimeout(awardTimer.current)
      if (foulTimer.current !== null) window.clearTimeout(foulTimer.current)
    }
  }, [])

  const arrowAngle = getCategoryBombArrowAngle(round)
  return <main className={`category-bomb-active category-bomb-active--${round.displayMode}`}>
    <button className="text-button category-bomb-active__exit" type="button" onClick={onExit}>Exit</button>
    <div className="category-bomb-active__category"><span>Category</span><strong>{round.categoryLabel}</strong></div>

    {round.displayMode === 'radial' ? <div className="category-bomb-board category-bomb-board--active">
      {round.settings.players.map((player) => <div data-testid="category-bomb-active-seat" className={`category-bomb-seat category-bomb-seat--${player.seat}${player.id === round.currentPlayerId ? ' category-bomb-seat--active' : ''}`} key={player.id} aria-label={player.name}>{player.name}</div>)}
      <div data-testid="category-bomb-arrow" className="category-bomb-arrow" style={{ rotate: `${arrowAngle ?? 0}deg` }} aria-hidden="true">➤</div>
      <div className="category-bomb-current-status" role="status">{currentPlayer.name}'s turn</div>
      <button className="category-bomb-button" type="button" aria-label={`Accept ${currentPlayer.name}'s answer and pass`} onClick={accept}>💣<span>Tap after a valid answer</span></button>
    </div> : <div className="category-bomb-name-only">
      <span>Pass to</span>
      <h1 aria-live="polite">{currentPlayer.name}</h1>
      <button className="category-bomb-button" type="button" aria-label={`Accept ${currentPlayer.name}'s answer and pass`} onClick={accept}>💣<span>Tap after a valid answer</span></button>
    </div>}

    <button
      className={`category-bomb-foul${holdingFoul ? ' category-bomb-foul--holding' : ''}`}
      type="button"
      aria-label={`Hold to explode ${currentPlayer.name} for an invalid or repeated answer`}
      onPointerDown={beginFoul}
      onPointerUp={cancelFoul}
      onPointerLeave={cancelFoul}
      onPointerCancel={cancelFoul}
      onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); beginFoul() } }}
      onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') cancelFoul() }}
      onBlur={cancelFoul}
    >{holdingFoul ? 'Keep holding…' : 'Hold: invalid or repeated'}</button>
    {awardVisible && <div className="category-bomb-award" role="status">+1.5s</div>}
  </main>
}
