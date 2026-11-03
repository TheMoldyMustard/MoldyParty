import { useGameStore } from '../../store/gameStore'
import PassDeviceMask from './PassDeviceMask'

export default function VotingScreen() {
  const game = useGameStore((state) => state.game)!
  const isVoteReady = useGameStore((state) => state.isVoteReady)
  const pendingVote = useGameStore((state) => state.pendingVote)
  const showVote = useGameStore((state) => state.showVote)
  const enableAbsoluteVoting = useGameStore((state) => state.enableAbsoluteVoting)
  const castVote = useGameStore((state) => state.castVote)
  const confirmVote = useGameStore((state) => state.confirmVote)
  const voter = game.players[game.currentVoterIndex]
  const selectedIds = Array.isArray(pendingVote) ? pendingVote : []
  const isGroupVote = game.absoluteVotingEnabled

  if (!isVoteReady && !isGroupVote) {
    return <PassDeviceMask
      playerName={voter.name}
      eyebrow={`Secret vote · ${game.currentVoterIndex + 1} of ${game.players.length}`}
      actionLabel={`I’m ${voter.name}`}
      onReady={showVote}
      secondaryActionLabel="Proceed to Group Vote"
      onSecondaryAction={enableAbsoluteVoting}
    />
  }

  return (
    <main className="screen voting-screen">
      <span className="eyebrow">{isGroupVote ? 'Group Vote' : `${voter.name}’s secret ballot`}</span>
      <h1>Who should be voted out?</h1>
      <p>{isGroupVote
        ? `Everyone chooses together. Select up to ${game.impostorCount} player${game.impostorCount === 1 ? '' : 's'}, then lock in the result.`
        : `Choose up to ${game.impostorCount} player${game.impostorCount === 1 ? '' : 's'}. Your choice stays hidden after you lock it in.`}</p>
      <div className="ballot-grid" role="group" aria-label={`Vote for up to ${game.impostorCount} player${game.impostorCount === 1 ? '' : 's'}`}>
        {game.players.filter((player) => isGroupVote || player.id !== voter.id).map((player) => (
          <button aria-pressed={selectedIds.includes(player.id)} className={selectedIds.includes(player.id) ? 'selected' : ''} type="button" key={player.id} onClick={() => castVote(player.id)}>{player.name}</button>
        ))}
        {!isGroupVote && <button aria-pressed={pendingVote === null} className={`skip ${pendingVote === null ? 'selected' : ''}`} type="button" onClick={() => castVote(null)}>Skip vote</button>}
      </div>
      <button className="button button--hero" type="button" disabled={pendingVote === undefined || (Array.isArray(pendingVote) && pendingVote.length === 0)} onClick={confirmVote}>{isGroupVote ? 'Decide the vote' : 'Lock in vote'}</button>
    </main>
  )
}
