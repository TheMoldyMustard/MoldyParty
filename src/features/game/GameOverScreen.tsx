import { useGameStore } from '../../store/gameStore'

interface GameOverScreenProps {
  onChangeCategory: () => void
  onReturnToLobby: () => void
}

export default function GameOverScreen({ onChangeCategory, onReturnToLobby }: GameOverScreenProps) {
  const game = useGameStore((state) => state.game)!
  const playAgain = useGameStore((state) => state.playAgain)
  const result = game.voteResult!
  const eliminated = game.players.find((player) => player.id === result.eliminatedPlayerId)
  const impostors = game.players.filter((player) => player.role === 'IMPOSTOR')
  const heading = result.isTie ? 'The vote was tied' : eliminated ? `${eliminated.name} was voted out` : 'Nobody was voted out'

  return (
    <main className="screen result-screen">
      <span className="eyebrow">Round complete</span>
      <h1>{heading}</h1>
      {eliminated && <p className={`verdict verdict--${eliminated.role.toLowerCase()}`}>{eliminated.role === 'IMPOSTOR' ? 'You caught an impostor.' : 'They were innocent.'}</p>}
      {result.isTie && <p className="verdict">No one leaves after a tie.</p>}
      <div className="reveal-summary">
        <div><small>Secret word</small><strong>{game.currentWord}</strong></div>
        <div><small>{impostors.length === 1 ? 'The impostor' : 'The impostors'}</small><strong>{impostors.map((player) => player.name).join(', ')}</strong></div>
      </div>
      <div className="result-actions">
        <button className="button button--hero" type="button" onClick={playAgain}>Play again</button>
        <button className="button button--secondary" type="button" onClick={onChangeCategory}>Change category</button>
        <button className="text-button" type="button" onClick={onReturnToLobby}>Return to lobby</button>
      </div>
    </main>
  )
}
