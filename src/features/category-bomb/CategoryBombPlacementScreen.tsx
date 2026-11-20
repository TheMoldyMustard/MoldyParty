import { useState } from 'react'
import type { CategoryBombRound } from '../../domain/categoryBomb'
import { categoryBombStore } from '../../store/categoryBombStore'

interface CategoryBombPlacementScreenProps {
  round: CategoryBombRound
  onBack: () => void
}

export default function CategoryBombPlacementScreen({ round, onBack }: CategoryBombPlacementScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function choose(playerId: string) {
    if (!selectedId) {
      setSelectedId(playerId)
      return
    }
    categoryBombStore.getState().swapSeats(selectedId, playerId)
    setSelectedId(null)
  }

  return <main className="category-bomb-pre-round">
    <button className="text-button category-bomb-pre-round__back" type="button" onClick={onBack}>← Setup</button>
    <header><span className="eyebrow">Place the phone in the center</span><h1>Point every name</h1><p>Tap one name, then another, to swap where they sit.</p></header>
    <div className="category-bomb-board category-bomb-board--placement">
      <div className="category-bomb-placement-arrow" data-testid="category-bomb-placement-arrow" aria-hidden="true">➤</div>
      <div className="category-bomb-category-preview"><span>Category</span><strong>{round.categoryLabel}</strong></div>
      {round.settings.players.map((player) => <button
        type="button"
        data-testid="category-bomb-seat"
        className={`category-bomb-seat category-bomb-seat--${player.seat}${selectedId === player.id ? ' category-bomb-seat--selected' : ''}`}
        key={player.id}
        aria-label={!selectedId ? `Move ${player.name}` : selectedId === player.id ? `Selected ${player.name}` : `Swap with ${player.name}`}
        aria-pressed={selectedId === player.id}
        onClick={() => choose(player.id)}
      >{player.name}</button>)}
    </div>
    <button className="button button--hero" type="button" onClick={() => categoryBombStore.getState().arm()}>Arm bomb</button>
  </main>
}
