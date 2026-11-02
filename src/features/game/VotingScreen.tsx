import { useGameStore } from '../../store/gameStore'
import PassDeviceMask from './PassDeviceMask'

export default function VotingScreen() {
  const game = useGameStore((state) => state.game)!
  const isVoteReady = useGameStore((state) => state.isVoteReady)
  const pendingVote = useGameStore((state) => state.pendingVote)
  const showVote = useGameStore((state) => state.showVote)
  const castVote = useGameStore((state) => state.castVote)
  const confirmVote = useGameStore((state) => state.confirmVote)
  const voter = game.players[game.currentVoterIndex]

  if (!isVoteReady) {
    return <PassDeviceMask playerName={voter.name} eyebrow={`Secret vote · ${game.currentVoterIndex + 1} of ${game.players.length}`} actionLabel={`I’m ${voter.name}`} onReady={showVote} />
  }

  return (
    <main className="screen voting-screen">
      <span className="eyebrow">{voter.name}’s secret ballot</span>
      <h1>Who is the impostor?</h1>
      <p>Your choice stays hidden after you lock it in.</p>
      <div className="ballot-grid" role="group" aria-label="Vote for one player">
        {game.players.filter((player) => player.id !== voter.id).map((player) => (
          <button className={pendingVote === player.id ? 'selected' : ''} type="button" key={player.id} onClick={() => castVote(player.id)}>{player.name}</button>
        ))}
        <button className={`skip ${pendingVote === null ? 'selected' : ''}`} type="button" onClick={() => castVote(null)}>Skip vote</button>
      </div>
      <button className="button button--hero" type="button" disabled={pendingVote === undefined} onClick={confirmVote}>Lock in vote</button>
    </main>
  )
}
