import type { CategoryBombRound } from '../../domain/categoryBomb'
interface CategoryBombExplosionScreenProps {
  round: CategoryBombRound
  onExit: () => void
  onReplay: () => void
  onReturnToPreRound: () => void
}

export default function CategoryBombExplosionScreen({ round, onExit, onReplay, onReturnToPreRound }: CategoryBombExplosionScreenProps) {
  const player = round.settings.players.find((candidate) => candidate.id === round.explodedPlayerId)
  return <main className="category-bomb-explosion">
    <span className="category-bomb-explosion__icon" aria-hidden="true">💥</span>
    <span className="eyebrow">{round.explosionReason === 'foul' ? 'Invalid or repeated answer' : 'The bomb went off'}</span>
    <h1>{player?.name ?? 'Someone'} got exploded!</h1>
    <p>Category: <strong>{round.categoryLabel}</strong></p>
    <div className="action-row">
      <button className="button button--hero" type="button" onClick={onReplay}>New bomb</button>
      <button className="button button--secondary" type="button" onClick={onReturnToPreRound}>{round.displayMode === 'radial' ? 'Rearrange players' : 'Review rules'}</button>
      <button className="text-button" type="button" onClick={onExit}>Exit to MoldyParty</button>
    </div>
  </main>
}
