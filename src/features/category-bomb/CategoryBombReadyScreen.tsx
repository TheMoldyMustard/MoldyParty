import type { CategoryBombRound } from '../../domain/categoryBomb'
import { categoryBombStore } from '../../store/categoryBombStore'

interface CategoryBombReadyScreenProps {
  round: CategoryBombRound
  onBack: () => void
}

export default function CategoryBombReadyScreen({ round, onBack }: CategoryBombReadyScreenProps) {
  return <main className="category-bomb-pre-round category-bomb-ready">
    <button className="text-button category-bomb-pre-round__back" type="button" onClick={onBack}>← Setup</button>
    <span className="eyebrow">Large group mode · {round.settings.players.length} players</span>
    <h1>Pass to the name</h1>
    <p>The current player's name will fill the screen. The seating board and arrow stay hidden.</p>
    <div className="category-bomb-ready__category"><span>Your category</span><strong>{round.categoryLabel}</strong></div>
    <p className="muted">Say a valid item, tap the bomb, and hand the phone to whoever appears next.</p>
    <button className="button button--hero" type="button" onClick={() => categoryBombStore.getState().arm()}>Arm bomb</button>
  </main>
}
