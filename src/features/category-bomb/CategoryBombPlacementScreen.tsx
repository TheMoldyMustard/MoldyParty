import { useState } from 'react'
import { getCategoryBombSeatAngle, type CategoryBombRound } from '../../domain/categoryBomb'
import { categoryBombStore } from '../../store/categoryBombStore'

interface CategoryBombPlacementScreenProps {
  round: CategoryBombRound
  onBack: () => void
  onArm?: () => void
}

export default function CategoryBombPlacementScreen({ round, onBack, onArm }: CategoryBombPlacementScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const selectedPlayer = round.settings.players.find((player) => player.id === selectedId)

  function choose(playerId: string) {
    if (!selectedId) {
      setSelectedId(playerId)
      return
    }
    const first = round.settings.players.find((player) => player.id === selectedId)
    const second = round.settings.players.find((player) => player.id === playerId)
    categoryBombStore.getState().swapSeats(selectedId, playerId)
    if (first && second) setAnnouncement(`${first.name} and ${second.name} swapped.`)
    setSelectedId(null)
  }

  return <main className="category-bomb-pre-round">
    <button className="text-button category-bomb-pre-round__back" type="button" onClick={onBack}>← Setup</button>
    <header><span className="eyebrow">Place the phone in the center</span><h1>Point every name</h1><p>Tap one name, then another, to swap where they sit.</p></header>
    <div className="category-bomb-board category-bomb-board--placement">
      <div className="category-bomb-placement-arrow" data-testid="category-bomb-placement-arrow" style={{ rotate: `${selectedPlayer?.seat ? getCategoryBombSeatAngle(selectedPlayer.seat) : 0}deg` }} aria-hidden="true">➤</div>
      <div className="category-bomb-category-preview"><span>Category</span><strong>{round.categoryLabel}</strong></div>
      {round.settings.players.map((player) => <button
        type="button"
        data-testid="category-bomb-seat"
        className={`category-bomb-seat category-bomb-seat--${player.seat}${selectedId === player.id ? ' category-bomb-seat--selected' : ''}`}
        key={player.id}
        aria-label={!selectedId ? `Move ${player.name}` : selectedId === player.id ? `Selected ${player.name}` : `Swap with ${player.name}`}
        aria-pressed={selectedId === player.id}
        onClick={() => choose(player.id)}
        draggable
        onDragStart={() => setSelectedId(player.id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); choose(player.id) }}
      >{player.name}</button>)}
    </div>
    <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    <button className="button button--hero" type="button" onClick={() => onArm ? onArm() : categoryBombStore.getState().arm()}>Arm bomb</button>
  </main>
}
