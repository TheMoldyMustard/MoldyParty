import { useGameStore } from '../../store/gameStore'
import { calculateSpecialRoleOutcomes } from '../../domain/game'
import type { PlayerRole } from '../../domain/types'

interface GameOverScreenProps {
  onChangeCategory: () => void
  onReturnToLobby: () => void
}

export default function GameOverScreen({ onChangeCategory, onReturnToLobby }: GameOverScreenProps) {
  const game = useGameStore((state) => state.game)!
  const playAgain = useGameStore((state) => state.playAgain)
  const result = game.voteResult!
  const eliminated = game.players.find((player) => player.id === result.eliminatedPlayerId)
  const specialOutcomes = calculateSpecialRoleOutcomes(game)
  const heading = result.isTie ? 'The vote was tied' : eliminated ? `${eliminated.name} was voted out` : 'Nobody was voted out'
  const roleLabels: Record<PlayerRole, string> = {
    INNOCENT: 'Innocent',
    IMPOSTOR: 'Impostor',
    JESTER: 'Jester',
    OUTLIER: 'Outlier',
  }
  const eliminatedVerdict = eliminated?.role === 'IMPOSTOR'
    ? 'You caught an impostor.'
    : eliminated?.role === 'JESTER'
      ? 'The Jester got their wish.'
      : 'They were not an impostor.'

  return (
    <main className="screen result-screen">
      <span className="eyebrow">Round complete</span>
      <h1>{heading}</h1>
      {eliminated && <p className={`verdict verdict--${eliminated.role.toLowerCase()}`}>{eliminatedVerdict}</p>}
      {result.isTie && <p className="verdict">No one leaves after a tie.</p>}
      <div className="reveal-summary">
        <div><small>Secret word</small><strong>{game.currentWord}</strong></div>
      </div>
      {specialOutcomes.length > 0 && <section className="special-outcomes" aria-label="Special role outcomes">
        {specialOutcomes.map((outcome) => {
          const player = game.players.find((candidate) => candidate.id === outcome.playerId)!
          const guess = outcome.role === 'OUTLIER'
            ? game.outlierGuesses.find((candidate) => candidate.playerId === player.id)
            : undefined
          return <article className={`special-outcome special-outcome--${outcome.won ? 'win' : 'loss'}`} key={player.id}>
            <strong>{player.name} {outcome.won ? 'won' : 'lost'} as {roleLabels[outcome.role]}</strong>
            <span>{outcome.reason}</span>
            {guess && <small>Guess: {guess.guess}</small>}
          </article>
        })}
      </section>}
      <section className="role-reveal" aria-labelledby="player-roles-title">
        <h2 id="player-roles-title">Everyone’s role</h2>
        <ul className="role-roster" aria-label="Player roles">
          {game.players.map((player) => <li className={`role-roster__item role-roster__item--${player.role.toLowerCase()}`} key={player.id}>
            <strong>{player.name}</strong>
            <span>{roleLabels[player.role]}</span>
            {player.id === result.eliminatedPlayerId && <small>Voted out</small>}
          </li>)}
        </ul>
      </section>
      <div className="result-actions">
        <button className="button button--hero" type="button" onClick={() => playAgain()}>Play again</button>
        <button className="button button--secondary" type="button" onClick={() => playAgain({ absoluteVotingEnabled: true })}>Absolute Voting</button>
        <button className="button button--secondary" type="button" onClick={onChangeCategory}>Change category</button>
        <button className="text-button" type="button" onClick={onReturnToLobby}>Return to lobby</button>
      </div>
    </main>
  )
}
