import type { CategoryBombRound } from '../../domain/categoryBomb'
interface CategoryBombExplosionScreenProps {
  round: CategoryBombRound
  onExit: () => void
  onReplay: () => void
  onReviewRules: () => void
}

export default function CategoryBombExplosionScreen({ round, onExit, onReplay, onReviewRules }: CategoryBombExplosionScreenProps) {
  const player = round.settings.players.find((candidate) => candidate.id === round.explodedPlayerId)
  const acceptedAnswers = round.acceptedAnswerPlayerIds.length
  return <main className="category-bomb-explosion">
    <span className="category-bomb-explosion__icon" aria-hidden="true">💥</span>
    <span className="eyebrow">{round.explosionReason === 'foul' ? 'Invalid or repeated answer' : 'The bomb went off'}</span>
    <h1>{player?.name ?? 'Someone'} got exploded!</h1>
    <p>Category: <strong>{round.categoryLabel}</strong></p>
    <div className="stats-summary" aria-label="Completed bomb stats">
      <span><strong>{acceptedAnswers}</strong> accepted {acceptedAnswers === 1 ? 'answer' : 'answers'}</span>
      <span><strong>{round.explosionReason === 'foul' ? 'Foul' : 'Timer'}</strong> explosion</span>
    </div>
    <div className="action-row">
      <button className="button button--hero" type="button" onClick={onReplay}>New bomb</button>
      <button className="button button--secondary" type="button" onClick={onReviewRules}>Review rules</button>
      <button className="text-button" type="button" onClick={onExit}>Return to sessions</button>
    </div>
  </main>
}
