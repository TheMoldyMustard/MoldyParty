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
  const eliminatedPlayerIds = result.eliminatedPlayerIds
    ?? (result.eliminatedPlayerId ? [result.eliminatedPlayerId] : [])
  const eliminated = game.players.filter((player) => eliminatedPlayerIds.includes(player.id))
  const specialOutcomes = calculateSpecialRoleOutcomes(game)
  const heading = eliminated.length === 0
    ? 'Nobody was voted out'
    : eliminated.length === 1
      ? `${eliminated[0].name} was voted out`
      : `${eliminated.map((player) => player.name).join(' and ')} were voted out`
  const roleLabels: Record<PlayerRole, string> = {
    INNOCENT: 'Innocent',
    IMPOSTOR: 'Impostor',
    JESTER: 'Jester',
    OUTLIER: 'Outlier',
  }
  const eliminatedVerdict = eliminated.some((player) => player.role === 'IMPOSTOR')
    ? 'You caught an impostor.'
    : eliminated.some((player) => player.role === 'JESTER')
      ? 'The Jester got their wish.'
      : 'They were not an impostor.'

  return (
    <main className="screen result-screen">
      <span className="eyebrow">Round complete</span>
      <h1>{heading}</h1>
      {eliminated.length > 0 && <p className={`verdict verdict--${eliminated[0].role.toLowerCase()}`}>{eliminatedVerdict}</p>}
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
            {eliminatedPlayerIds.includes(player.id) && <small>Voted out</small>}
          </li>)}
        </ul>
      </section>
      <div className="result-actions">
        <button className="button button--hero" type="button" onClick={() => playAgain()}>Play again</button>
        <button className="button button--secondary" type="button" onClick={() => playAgain({ absoluteVotingEnabled: true })}>Group Vote</button>
        <button className="button button--secondary" type="button" onClick={onChangeCategory}>Change category</button>
        <button className="text-button" type="button" onClick={onReturnToLobby}>Return to lobby</button>
      </div>
    </main>
  )
}
